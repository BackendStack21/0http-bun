/**
 * Creates CORS (Cross-Origin Resource Sharing) middleware
 * @param {Object} options - CORS configuration options
 * @param {string|Array<string>|Function} options.origin - Allowed origins
 * @param {Array<string>} options.methods - Allowed HTTP methods
 * @param {Array<string>} options.allowedHeaders - Allowed request headers
 * @param {Array<string>} options.exposedHeaders - Headers exposed to the client
 * @param {boolean} options.credentials - Whether to include credentials
 * @param {number} options.maxAge - Preflight cache time in seconds
 * @param {boolean} options.preflightContinue - Pass control to next handler after preflight
 * @param {number} options.optionsSuccessStatus - Status code for successful OPTIONS requests
 * @returns {Function} Middleware function
 */
function applyVaryOrigin(response) {
  const existingVary = response.headers.get('Vary')
  if (existingVary) {
    if (!existingVary.includes('Origin')) {
      response.headers.set('Vary', `${existingVary}, Origin`)
    }
  } else {
    response.headers.set('Vary', 'Origin')
  }
}

function createCORS(options = {}) {
  const {
    origin = '*',
    methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400, // 24 hours
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = options

  const methodsList = Array.isArray(methods) ? methods : [methods]
  const methodsHeader = methodsList.join(', ')
  const methodsUpper = new Set(
    methodsList.map((m) => String(m).toUpperCase()),
  )

  return function corsMiddleware(req, next) {
    const requestOrigin = req.headers.get('origin')
    const allowedOrigin = getAllowedOrigin(origin, requestOrigin, req)

    const addCorsHeaders = (response) => {
      if (!response || !response.headers) return response

      // Add Vary header for non-wildcard origins to prevent CDN cache poisoning
      if (origin !== '*') {
        applyVaryOrigin(response)
      }

      if (allowedOrigin !== false) {
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin)

        // Don't allow wildcard origin with credentials
        if (credentials && allowedOrigin !== '*') {
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }

        // Handle exposedHeaders (can be string or array)
        const exposedHeadersList = Array.isArray(exposedHeaders)
          ? exposedHeaders
          : typeof exposedHeaders === 'string'
            ? [exposedHeaders]
            : []
        if (exposedHeadersList.length > 0) {
          response.headers.set(
            'Access-Control-Expose-Headers',
            exposedHeadersList.join(', '),
          )
        }

        // Add method and header info
        response.headers.set('Access-Control-Allow-Methods', methodsHeader)

        const resolvedAllowedHeaders =
          typeof allowedHeaders === 'function'
            ? allowedHeaders(req)
            : allowedHeaders
        const allowedHeadersList = Array.isArray(resolvedAllowedHeaders)
          ? resolvedAllowedHeaders
          : typeof resolvedAllowedHeaders === 'string'
            ? [resolvedAllowedHeaders]
            : []
        response.headers.set(
          'Access-Control-Allow-Headers',
          allowedHeadersList.join(', '),
        )
      }

      return response
    }

    if (req.method === 'OPTIONS') {
      // I-2: Resolve allowedHeaders once for the entire preflight handling
      const resolvedAllowedHeaders =
        typeof allowedHeaders === 'function'
          ? allowedHeaders(req)
          : allowedHeaders
      const allowedHeadersList = Array.isArray(resolvedAllowedHeaders)
        ? resolvedAllowedHeaders
        : typeof resolvedAllowedHeaders === 'string'
          ? [resolvedAllowedHeaders]
          : []

      // Handle preflight request
      const requestMethod = req.headers.get('access-control-request-method')
      const requestHeaders = req.headers.get('access-control-request-headers')

      // Check if requested method is allowed (case-insensitive)
      if (
        requestMethod &&
        !methodsUpper.has(requestMethod.toUpperCase())
      ) {
        return new Response(null, {status: 404})
      }

      // Check if requested headers are allowed
      if (requestHeaders) {
        const requestedHeaders = requestHeaders.split(',').map((h) => h.trim())

        const hasDisallowedHeaders = requestedHeaders.some(
          (header) =>
            !allowedHeadersList.some(
              (allowed) => allowed.toLowerCase() === header.toLowerCase(),
            ),
        )

        if (hasDisallowedHeaders) {
          return new Response(null, {status: 404})
        }
      }

      const response = new Response(null, {status: optionsSuccessStatus})

      // Vary on all non-wildcard origins (including static strings) to prevent cache poisoning
      if (origin !== '*') {
        applyVaryOrigin(response)
      }

      if (allowedOrigin !== false) {
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin)

        // Don't allow wildcard origin with credentials
        if (credentials && allowedOrigin !== '*') {
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }

        response.headers.set('Access-Control-Allow-Methods', methodsHeader)

        response.headers.set(
          'Access-Control-Allow-Headers',
          allowedHeadersList.join(', '),
        )

        response.headers.set('Access-Control-Max-Age', maxAge.toString())
      }

      if (preflightContinue) {
        const result = next()
        if (result instanceof Promise) {
          return result.then(addCorsHeaders)
        }
        return addCorsHeaders(result)
      } else {
        return response
      }
    }

    const result = next()
    if (result instanceof Promise) {
      return result.then(addCorsHeaders)
    }
    return addCorsHeaders(result)
  }
}

/**
 * Determines the allowed origin for CORS
 * @param {string|Array<string>|Function} origin - Origin configuration
 * @param {string} requestOrigin - Origin from request header
 * @param {Request} req - Request object
 * @returns {string|false} Allowed origin or false if not allowed
 */
function getAllowedOrigin(origin, requestOrigin, req) {
  if (origin === '*') {
    return '*'
  }

  if (origin === false) {
    return false
  }

  // Reject null/missing origins for all non-wildcard configs (sandboxed iframe / file:// bypass)
  if (!requestOrigin || requestOrigin === 'null') {
    return false
  }

  if (typeof origin === 'string') {
    return origin === requestOrigin ? requestOrigin : false
  }

  if (Array.isArray(origin)) {
    return origin.includes(requestOrigin) ? requestOrigin : false
  }

  if (typeof origin === 'function') {
    // Pass req as documented so validators can inspect the request
    const result = origin(requestOrigin, req)
    return result === true ? requestOrigin : result || false
  }

  return false
}

/**
 * Simple CORS middleware for development
 * Allows all origins, methods, and headers
 * @returns {Function} Middleware function
 */
function simpleCORS() {
  return createCORS({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: false,
  })
}

module.exports = {
  createCORS,
  simpleCORS,
  getAllowedOrigin,
}
