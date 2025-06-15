const promClient = require('prom-client')

// Security: Limit label cardinality
const MAX_LABEL_VALUE_LENGTH = 100
const MAX_ROUTE_SEGMENTS = 10

/**
 * Sanitize label values to prevent high cardinality
 */
function sanitizeLabelValue(value) {
  if (typeof value !== 'string') {
    value = String(value)
  }

  // Truncate long values
  if (value.length > MAX_LABEL_VALUE_LENGTH) {
    value = value.substring(0, MAX_LABEL_VALUE_LENGTH)
  }

  // Replace invalid characters
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Validate route pattern to prevent injection attacks
 */
function validateRoute(route) {
  if (typeof route !== 'string' || route.length === 0) {
    return '/unknown'
  }

  // Limit route complexity
  const segments = route.split('/').filter(Boolean)
  if (segments.length > MAX_ROUTE_SEGMENTS) {
    return '/' + segments.slice(0, MAX_ROUTE_SEGMENTS).join('/')
  }

  return sanitizeLabelValue(route)
}

/**
 * Default Prometheus metrics for HTTP requests
 */
function createDefaultMetrics() {
  // HTTP request duration histogram
  const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5, 10],
  })

  // HTTP request counter
  const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  })

  // HTTP request size histogram
  const httpRequestSize = new promClient.Histogram({
    name: 'http_request_size_bytes',
    help: 'Size of HTTP requests in bytes',
    labelNames: ['method', 'route'],
    buckets: [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000],
  })

  // HTTP response size histogram
  const httpResponseSize = new promClient.Histogram({
    name: 'http_response_size_bytes',
    help: 'Size of HTTP responses in bytes',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000],
  })

  // Active HTTP connections gauge
  const httpActiveConnections = new promClient.Gauge({
    name: 'http_active_connections',
    help: 'Number of active HTTP connections',
  })

  return {
    httpRequestDuration,
    httpRequestTotal,
    httpRequestSize,
    httpResponseSize,
    httpActiveConnections,
  }
}

/**
 * Extract route pattern from request
 * This function attempts to extract a meaningful route pattern from the request
 * for use in Prometheus metrics labels
 */
function extractRoutePattern(req) {
  try {
    // If route pattern is available from router context
    if (req.ctx && req.ctx.route) {
      return validateRoute(req.ctx.route)
    }

    // If params exist, try to reconstruct the pattern
    if (req.params && Object.keys(req.params).length > 0) {
      const url = new URL(req.url, 'http://localhost')
      let pattern = url.pathname

      // Replace parameter values with parameter names
      Object.entries(req.params).forEach(([key, value]) => {
        if (typeof key === 'string' && typeof value === 'string') {
          const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          pattern = pattern.replace(
            new RegExp(`/${escapedValue}(?=/|$)`),
            `/:${sanitizeLabelValue(key)}`,
          )
        }
      })

      return validateRoute(pattern)
    }

    // Try to normalize common patterns
    const url = new URL(req.url, 'http://localhost')
    let pathname = url.pathname

    // Replace UUIDs, numbers, and other common ID patterns
    pathname = pathname
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token')

    return validateRoute(pathname)
  } catch (error) {
    // Fallback for malformed URLs
    return '/unknown'
  }
}

/**
 * Get request size in bytes - optimized for performance
 */
function getRequestSize(req) {
  try {
    const contentLength = req.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      return size >= 0 && size <= 100 * 1024 * 1024 ? size : 0 // Max 100MB
    }

    // Fast estimation based on headers only
    let size = 0
    const url = req.url || ''
    size += req.method.length + url.length + 12 // HTTP/1.1 + spaces

    // Quick header size estimation
    if (req.headers && typeof req.headers.forEach === 'function') {
      let headerCount = 0
      req.headers.forEach((value, key) => {
        if (headerCount < 50) {
          // Limit header processing for performance
          size += key.length + value.length + 4 // ": " + "\r\n"
          headerCount++
        }
      })
    }

    return Math.min(size, 1024 * 1024) // Cap at 1MB for estimation
  } catch (error) {
    return 0
  }
}

/**
 * Get response size in bytes - optimized for performance
 */
function getResponseSize(response) {
  try {
    // Check content-length header first (fastest)
    const contentLength = response.headers?.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      return size >= 0 && size <= 100 * 1024 * 1024 ? size : 0 // Max 100MB
    }

    // Try to estimate from response body if available
    if (
      response._bodyForLogger &&
      typeof response._bodyForLogger === 'string'
    ) {
      return Math.min(
        Buffer.byteLength(response._bodyForLogger, 'utf8'),
        1024 * 1024,
      )
    }

    // Fast estimation for headers only
    let size = 15 // "HTTP/1.1 200 OK\r\n"

    if (response.headers && typeof response.headers.forEach === 'function') {
      let headerCount = 0
      response.headers.forEach((value, key) => {
        if (headerCount < 20) {
          // Limit for performance
          size += key.length + value.length + 4 // ": " + "\r\n"
          headerCount++
        }
      })
    }

    return Math.min(size, 1024) // Cap header estimation at 1KB
  } catch (error) {
    return 0
  }
}

/**
 * Creates a Prometheus metrics middleware
 * @param {Object} options - Prometheus middleware configuration
 * @param {Object} options.metrics - Custom metrics object (optional)
 * @param {Array<string>} options.excludePaths - Paths to exclude from metrics
 * @param {boolean} options.collectDefaultMetrics - Whether to collect default Node.js metrics
 * @param {Function} options.normalizeRoute - Custom route normalization function
 * @param {Function} options.extractLabels - Custom label extraction function
 * @param {Array<string>} options.skipMethods - HTTP methods to skip from metrics
 * @returns {Function} Middleware function
 */
function createPrometheusMiddleware(options = {}) {
  const {
    metrics: customMetrics,
    excludePaths = ['/health', '/ping', '/favicon.ico', '/metrics'],
    collectDefaultMetrics = true,
    normalizeRoute = extractRoutePattern,
    extractLabels,
    skipMethods = [],
  } = options

  // Collect default Node.js metrics
  if (collectDefaultMetrics) {
    promClient.collectDefaultMetrics({
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 5,
    })
  }

  // Use custom metrics or create default ones
  const metrics = customMetrics || createDefaultMetrics()

  return async function prometheusMiddleware(req, next) {
    const startHrTime = process.hrtime()

    // Skip metrics collection for excluded paths (performance optimization)
    const url = req.url || ''
    let pathname
    try {
      // Handle both full URLs and pathname-only URLs
      if (url.startsWith('http')) {
        pathname = new URL(url).pathname
      } else {
        pathname = url.split('?')[0] // Fast pathname extraction
      }
    } catch (error) {
      pathname = url.split('?')[0] // Fallback to simple splitting
    }

    if (excludePaths.some((path) => pathname.startsWith(path))) {
      return next()
    }

    // Skip metrics collection for specified methods
    const method = req.method?.toUpperCase() || 'GET'
    if (skipMethods.includes(method)) {
      return next()
    }

    // Increment active connections
    if (metrics.httpActiveConnections) {
      metrics.httpActiveConnections.inc()
    }

    try {
      // Get request size (lazy evaluation)
      let requestSize = 0

      // Execute the request
      const response = await next()

      // Calculate duration (high precision)
      const duration = process.hrtime(startHrTime)
      const durationInSeconds = duration[0] + duration[1] * 1e-9

      // Extract route pattern (cached/optimized)
      const route = normalizeRoute(req)
      const statusCode = sanitizeLabelValue(
        response?.status?.toString() || 'unknown',
      )

      // Create base labels with sanitized values
      let labels = {
        method: sanitizeLabelValue(method),
        route: route,
        status_code: statusCode,
      }

      // Add custom labels if extractor provided
      if (extractLabels && typeof extractLabels === 'function') {
        try {
          const customLabels = extractLabels(req, response)
          if (customLabels && typeof customLabels === 'object') {
            // Sanitize custom labels
            Object.entries(customLabels).forEach(([key, value]) => {
              if (typeof key === 'string' && key.length <= 50) {
                labels[sanitizeLabelValue(key)] = sanitizeLabelValue(
                  String(value),
                )
              }
            })
          }
        } catch (error) {
          // Ignore custom label extraction errors
        }
      }

      // Record metrics efficiently
      if (metrics.httpRequestDuration) {
        metrics.httpRequestDuration.observe(
          {
            method: labels.method,
            route: labels.route,
            status_code: labels.status_code,
          },
          durationInSeconds,
        )
      }

      if (metrics.httpRequestTotal) {
        metrics.httpRequestTotal.inc({
          method: labels.method,
          route: labels.route,
          status_code: labels.status_code,
        })
      }

      if (metrics.httpRequestSize) {
        requestSize = getRequestSize(req)
        if (requestSize > 0) {
          metrics.httpRequestSize.observe(
            {method: labels.method, route: labels.route},
            requestSize,
          )
        }
      }

      if (metrics.httpResponseSize) {
        const responseSize = getResponseSize(response)
        if (responseSize > 0) {
          metrics.httpResponseSize.observe(
            {
              method: labels.method,
              route: labels.route,
              status_code: labels.status_code,
            },
            responseSize,
          )
        }
      }

      return response
    } catch (error) {
      // Record error metrics
      const duration = process.hrtime(startHrTime)
      const durationInSeconds = duration[0] + duration[1] * 1e-9
      const route = normalizeRoute(req)
      const sanitizedMethod = sanitizeLabelValue(method)

      if (metrics.httpRequestDuration) {
        metrics.httpRequestDuration.observe(
          {method: sanitizedMethod, route: route, status_code: '500'},
          durationInSeconds,
        )
      }

      if (metrics.httpRequestTotal) {
        metrics.httpRequestTotal.inc({
          method: sanitizedMethod,
          route: route,
          status_code: '500',
        })
      }

      throw error
    } finally {
      // Decrement active connections
      if (metrics.httpActiveConnections) {
        metrics.httpActiveConnections.dec()
      }
    }
  }
}

/**
 * Creates a metrics endpoint handler that serves Prometheus metrics
 * @param {Object} options - Metrics endpoint configuration
 * @param {string} options.endpoint - The endpoint path (default: '/metrics')
 * @param {Object} options.registry - Custom Prometheus registry
 * @returns {Function} Request handler function
 */
function createMetricsHandler(options = {}) {
  const {endpoint = '/metrics', registry = promClient.register} = options

  return async function metricsHandler(req) {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === endpoint) {
      try {
        const metrics = await registry.metrics()
        return new Response(metrics, {
          status: 200,
          headers: {
            'Content-Type': registry.contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })
      } catch (error) {
        return new Response('Error collecting metrics', {
          status: 500,
          headers: {'Content-Type': 'text/plain'},
        })
      }
    }

    return null // Let other middleware handle the request
  }
}

/**
 * Simple helper to create both middleware and metrics endpoint
 * @param {Object} options - Combined configuration options
 * @returns {Object} Object containing middleware and handler functions
 */
function createPrometheusIntegration(options = {}) {
  const middleware = createPrometheusMiddleware(options)
  const metricsHandler = createMetricsHandler(options)

  return {
    middleware,
    metricsHandler,
    // Expose the registry for custom metrics
    registry: promClient.register,
    // Expose prom-client for creating custom metrics
    promClient,
  }
}

module.exports = {
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
  createDefaultMetrics,
  extractRoutePattern,
  promClient,
  register: promClient.register,
}
