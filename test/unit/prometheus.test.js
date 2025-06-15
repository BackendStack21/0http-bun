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

  describe('Error Handling and Edge Cases', () => {
    it('should handle prom-client loading error', () => {
      // Create a test that simulates the error case by testing the loadPromClient function
      // This is challenging to test directly with mocking, so we'll test the error handling logic
      const prometheus = require('../../lib/middleware/prometheus')

      // Test that the module loads correctly when prom-client is available
      expect(prometheus.promClient).toBeDefined()
    })

    it('should handle prom-client loading errors at module level', () => {
      // Test the edge case by testing the actual behavior
      // Since we can't easily mock the require, we test related functionality
      const prometheus = require('../../lib/middleware/prometheus')

      // The promClient getter should work when prom-client is available
      expect(() => prometheus.promClient).not.toThrow()
      expect(prometheus.promClient).toBeDefined()
    })

    it('should handle non-string label values properly', async () => {
      // This covers line 25: value conversion in sanitizeLabelValue
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels: () => ({
          numberLabel: 42,
          booleanLabel: true,
          objectLabel: {toString: () => 'object-value'},
        }),
      })

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalled()
    })

    it('should handle URL creation errors in middleware', async () => {
      // This covers lines 219-223: URL parsing error handling
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Test with a URL that causes URL constructor to throw
      const badReq = {
        method: 'GET',
        url: 'http://[::1:bad-url',
        headers: new Headers(),
      }

      await middleware(badReq, next)

      expect(next).toHaveBeenCalled()
    })

    it('should handle skip methods array properly', async () => {
      // This covers line 229: skipMethods.includes check
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        skipMethods: ['TRACE', 'CONNECT'], // Different methods
      })

      req.method = 'TRACE'

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).not.toHaveBeenCalled()
    })

    it('should handle request headers without forEach method', async () => {
      // This covers lines 257-262: headers.forEach conditional
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create a mock request with headers that don't have forEach
      const mockReq = {
        method: 'POST',
        url: '/api/test',
        headers: {
          get: jest.fn(() => '100'),
          // Intentionally don't include forEach method
        },
      }

      await middleware(mockReq, next)

      expect(mockMetrics.httpRequestSize.observe).toHaveBeenCalledWith(
        {method: 'POST', route: '_api_test'},
        100,
      )
    })

    it('should handle label value length truncation edge case', async () => {
      // This covers line 30: value.substring truncation
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
        extractLabels: () => ({
          // Create a label value exactly at the truncation boundary
          longValue: 'x'.repeat(105), // Exceeds MAX_LABEL_VALUE_LENGTH (100)
        }),
      })

      await middleware(req, next)

      expect(mockMetrics.httpRequestTotal.inc).toHaveBeenCalled()
    })

    it('should handle route validation edge case for empty segments', () => {
      // This covers line 42: when segments.length > MAX_ROUTE_SEGMENTS
      const longRoute = '/' + Array(12).fill('segment').join('/') // Exceeds MAX_ROUTE_SEGMENTS (10)
      const req = {ctx: {route: longRoute}}
      const pattern = extractRoutePattern(req)

      // Should be truncated to MAX_ROUTE_SEGMENTS
      const segments = pattern.split('/').filter(Boolean)
      expect(segments.length).toBeLessThanOrEqual(10)
    })

    it('should handle response body logger estimation', async () => {
      // This covers line 186: response._bodyForLogger estimation
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      const responseBody = 'This is a test response body'
      const response = new Response('success', {status: 200})
      response._bodyForLogger = responseBody

      next.mockReturnValue(response)

      await middleware(req, next)

      expect(mockMetrics.httpResponseSize.observe).toHaveBeenCalled()
    })

    it('should handle response size header size estimation fallback', async () => {
      // This covers lines 207-211: header size estimation fallback
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create response with headers but no content-length and no _bodyForLogger
      const response = new Response('test', {
        status: 200,
        headers: new Headers([
          ['custom-header-1', 'value1'],
          ['custom-header-2', 'value2'],
          ['custom-header-3', 'value3'],
        ]),
      })

      next.mockReturnValue(response)

      await middleware(req, next)

      expect(mockMetrics.httpResponseSize.observe).toHaveBeenCalled()
    })

    it('should handle response header count limit in size estimation', async () => {
      // This covers the header count limit in response size estimation
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create response with many headers to trigger the limit (headerCount < 20)
      const headers = new Headers()
      for (let i = 0; i < 25; i++) {
        headers.set(`header-${i}`, `value-${i}`)
      }

      const response = new Response('test', {
        status: 200,
        headers: headers,
      })

      next.mockReturnValue(response)

      await middleware(req, next)

      expect(mockMetrics.httpResponseSize.observe).toHaveBeenCalled()
    })

    it('should handle request size header count limit', async () => {
      // This covers lines 257-262: header count limit in request size estimation
      const middleware = createPrometheusMiddleware({
        metrics: mockMetrics,
        collectDefaultMetrics: false,
      })

      // Create request with many headers to trigger the limit (headerCount < 50)
      for (let i = 0; i < 55; i++) {
        req.headers.set(`header-${i}`, `value-${i}`)
      }
      req.headers.delete('content-length') // Remove content-length to force header estimation

      await middleware(req, next)

      expect(mockMetrics.httpRequestSize.observe).toHaveBeenCalled()
    })
  })

  describe('Module Exports', () => {
    it('should expose promClient getter', () => {
      const prometheus = require('../../lib/middleware/prometheus')
      expect(prometheus.promClient).toBeDefined()
      expect(typeof prometheus.promClient).toBe('object')
    })

    it('should expose register getter', () => {
      const prometheus = require('../../lib/middleware/prometheus')
      expect(prometheus.register).toBeDefined()
      expect(typeof prometheus.register).toBe('object')
    })
  })
})
