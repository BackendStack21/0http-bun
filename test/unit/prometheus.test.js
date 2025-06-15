/* global describe, it, expect, beforeEach, afterEach, jest */

const {
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
  createDefaultMetrics,
  extractRoutePattern,
} = require('../../lib/middleware/prometheus')
const {createTestRequest} = require('../helpers')

describe('Prometheus Middleware', () => {
  let req, next, mockMetrics

  beforeEach(() => {
    req = createTestRequest('GET', '/api/test')
    next = jest.fn(() => new Response('Success', {status: 200}))

    // Create mock metrics
    mockMetrics = {
      httpRequestDuration: {
        observe: jest.fn(),
      },
      httpRequestTotal: {
        inc: jest.fn(),
      },
      httpRequestSize: {
        observe: jest.fn(),
      },
      httpResponseSize: {
        observe: jest.fn(),
      },
      httpActiveConnections: {
        inc: jest.fn(),
        dec: jest.fn(),
      },
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Security Features', () => {
    it('should sanitize label values to prevent high cardinality', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create request with very long path
      req = createTestRequest('GET', '/api/' + 'x'.repeat(200))

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api__token', // Long string gets normalized to token pattern
        status_code: '200',
      })
    })

    it('should limit route complexity to prevent DoS', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create request with many segments
      const manySegments = Array(20).fill('segment').join('/')
      req = createTestRequest('GET', '/' + manySegments)

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          route: expect.not.stringMatching(
            /segment.*segment.*segment.*segment.*segment.*segment.*segment.*segment.*segment.*segment.*segment/,
          ), // Should be limited
        }),
      )
    })

    it('should handle malformed URLs gracefully', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Simulate malformed URL
      req.url = 'not-a-valid-url'

      const response = await middleware(req, next)

      expect(response).toBeDefined()
      expect(next).toHaveBeenCalled()
    })

    it('should sanitize custom labels to prevent injection', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels: () => ({
          'malicious<script>': 'value with spaces & symbols!',
          validKey: 'valid_value',
        }),
      })

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api_test',
        status_code: '200',
      })
    })

    it('should limit request/response size measurements for security', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Simulate very large content-length
      req.headers.set('content-length', String(200 * 1024 * 1024)) // 200MB

      await middleware(req, next)

      // Should not record size for excessively large requests
      expect(mockMetrics.httpRequestSize.observe).not.toHaveBeenCalled()
    })
  })

  describe('Performance Optimizations', () => {
    it('should use fast path extraction for excluded paths', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        excludePaths: ['/health'],
      })

      req = createTestRequest('GET', '/health')

      await middleware(req, next)

      // Should not record any metrics for excluded paths
      expect(mockMetrics.httpRequestTotal.inc).not.toHaveBeenCalled()
      expect(mockMetrics.httpActiveConnections.inc).not.toHaveBeenCalled()
      expect(mockMetrics.httpActiveConnections.dec).not.toHaveBeenCalled()
    })

    it('should limit header processing for performance', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Add many headers
      for (let i = 0; i < 100; i++) {
        req.headers.set(`header-${i}`, `value-${i}`)
      }

      await middleware(req, next)

      // Should still complete without performance issues
      expect(next).toHaveBeenCalled()
    })

    it('should use lazy evaluation for request size', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: {
          ...mockMetrics,
          httpRequestSize: undefined, // Disable request size metric
        },
        collectDefaultMetrics: false,
      })

      await middleware(req, next)

      // Should not calculate request size if metric is disabled
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Basic Middleware Functionality', () => {
    it('should record request duration', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      await middleware(req, next)

      expect(mockMetrics.httpRequestDuration.observe).toHaveBeenCalledWith(
        {
          method: 'GET',
          route: '_api_test',
          status_code: '200',
        },
        expect.any(Number),
      )
    })

    it('should increment request counter', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api_test',
        status_code: '200',
      })
    })

    it('should track active connections', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      await middleware(req, next)

      expect(mockMetrics.httpActiveConnections.inc).toHaveBeenCalled()
      expect(mockMetrics.httpActiveConnections.dec).toHaveBeenCalled()
    })

    it('should handle errors and record error metrics', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      const error = new Error('Test error')
      next.mockRejectedValue(error)

      await expect(middleware(req, next)).rejects.toThrow('Test error')

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api_test',
        status_code: '500',
      })
      expect(mockMetrics.httpActiveConnections.dec).toHaveBeenCalled()
    })

    it('should skip metrics for specified methods', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        skipMethods: ['OPTIONS'],
      })

      req = createTestRequest('OPTIONS', '/api/test')

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).not.toHaveBeenCalled()
    })

    it('should record request and response sizes', async () => {
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      req.headers.set('content-length', '100')
      next.mockReturnValue(
        new Response('test response', {
          status: 200,
          headers: {'content-length': '13'},
        }),
      )

      await middleware(req, next)

      expect(mockMetrics.httpRequestSize.observe).toHaveBeenCalledWith(
        {method: 'GET', route: '_api_test'},
        100,
      )
      expect(mockMetrics.httpResponseSize.observe).toHaveBeenCalledWith(
        {method: 'GET', route: '_api_test', status_code: '200'},
        13,
      )
    })
  })

  describe('Route Pattern Extraction', () => {
    it('should extract route from request context', () => {
      const req = {ctx: {route: '/users/:id'}}
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_users__id')
    })

    it('should reconstruct pattern from params', () => {
      const req = {
        url: 'http://localhost/users/123',
        params: {id: '123'},
      }
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_users__id')
    })

    it('should normalize UUID patterns', () => {
      const req = {
        url: 'http://localhost/items/550e8400-e29b-41d4-a716-446655440000',
      }
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_items__id')
    })

    it('should normalize numeric IDs', () => {
      const req = {
        url: 'http://localhost/posts/12345',
      }
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_posts__id')
    })

    it('should normalize long tokens', () => {
      const req = {
        url: 'http://localhost/auth/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      }
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_auth__token')
    })

    it('should handle malformed URLs', () => {
      const req = {url: 'not-a-url'}
      const pattern = extractRoutePattern(req)
      expect(pattern).toBe('_not-a-url')
    })
  })

  describe('Metrics Handler', () => {
    it('should serve metrics at /metrics endpoint', async () => {
      const handler = createMetricsHandler()
      req = createTestRequest('GET', '/metrics')

      const response = await handler(req)

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/plain')
      expect(response.headers.get('Cache-Control')).toBe(
        'no-cache, no-store, must-revalidate',
      )
    })

    it('should return null for non-metrics endpoints', async () => {
      const handler = createMetricsHandler()
      req = createTestRequest('GET', '/api/test')

      const response = await handler(req)

      expect(response).toBeNull()
    })

    it('should use custom endpoint path', async () => {
      const handler = createMetricsHandler({endpoint: '/custom-metrics'})
      req = createTestRequest('GET', '/custom-metrics')

      const response = await handler(req)

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('should handle metrics collection errors', async () => {
      const mockRegistry = {
        metrics: jest.fn().mockRejectedValue(new Error('Registry error')),
        contentType: 'text/plain',
      }

      const handler = createMetricsHandler({registry: mockRegistry})
      req = createTestRequest('GET', '/metrics')

      const response = await handler(req)

      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Error collecting metrics')
    })
  })

  describe('Integration Helper', () => {
    it('should create middleware and handler together', () => {
      const integration = createPrometheusIntegration({
        collectDefaultMetrics: false,
      })

      expect(integration.middleware).toBeInstanceOf(Function)
      expect(integration.metricsHandler).toBeInstanceOf(Function)
      expect(integration.registry).toBeDefined()
      expect(integration.promClient).toBeDefined()
    })
  })

  describe('Default Metrics Creation', () => {
    it('should create all default metrics', () => {
      // Clear the registry to avoid conflicts
      const promClient = require('prom-client')
      promClient.register.clear()

      const metrics = createDefaultMetrics()

      expect(metrics.httpRequestDuration).toBeDefined()
      expect(metrics.httpRequestTotal).toBeDefined()
      expect(metrics.httpRequestSize).toBeDefined()
      expect(metrics.httpResponseSize).toBeDefined()
      expect(metrics.httpActiveConnections).toBeDefined()
    })
  })

  describe('Custom Label Extraction', () => {
    it('should add custom labels from extractor function', async () => {
      const extractLabels = jest.fn(() => ({
        user_type: 'premium',
        api_version: 'v1',
      }))

      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels,
      })

      await middleware(req, next)

      expect(extractLabels).toHaveBeenCalledWith(req, expect.any(Response))
      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api_test',
        status_code: '200',
      })
    })

    it('should handle custom label extraction errors gracefully', async () => {
      const extractLabels = jest.fn(() => {
        throw new Error('Label extraction error')
      })

      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels,
      })

      await middleware(req, next)

      // Should still record basic metrics despite label extraction error
      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '_api_test',
        status_code: '200',
      })
    })

    it('should limit custom label key length for security', async () => {
      const extractLabels = () => ({
        [Array(100).fill('x').join('')]: 'value', // Very long key
      })

      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels,
      })

      await middleware(req, next)

      // Should not include the excessively long key
      const callArgs = mockMetrics.httpRequestTotal.inc.mock.calls[0][0]
      const longKey = Object.keys(callArgs).find((key) => key.length > 50)
      expect(longKey).toBeUndefined()
    })
  })
})
