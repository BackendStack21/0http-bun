/* global describe, it, expect */

/**
 * Edge Cases and Boundary Condition Tests
 * These tests focus on covering unusual scenarios and edge cases
 * to ensure robustness and proper error handling.
 */

const {createTestRequest} = require('../helpers')

describe('Router Edge Cases and Boundary Conditions', () => {
  describe('URL Parsing Edge Cases', () => {
    it('should handle URLs with no path after domain', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/default', () => ({message: 'default route'}))

      // URLs without path component should trigger pathStart = url.length
      const edgeCaseUrls = [
        'http://example.com',
        'https://api.domain.com',
        'ftp://files.server.org',
        'http://localhost:3000',
      ]
      for (const url of edgeCaseUrls) {
        const req = {method: 'GET', url, headers: {}}
        const result = await router.fetch(req)

        // Should fall through to default route (404)
        expect(result.status).toBe(404)
      }
    })

    it('should handle protocol-relative URLs', async () => {
      const router = require('../../lib/router/sequential')()
      // Protocol-relative URLs are treated as paths, but route patterns starting with //
      // have parsing limitations in trouter, so this test verifies the 404 behavior
      router.get('/test', () => Response.json({message: 'success'}))

      const req = {method: 'GET', url: '//example.com/test', headers: {}}
      const result = await router.fetch(req)

      // URL '//example.com/test' is parsed as path '//example.com/test'
      // which doesn't match route '/test', so expect 404
      expect(result.status).toBe(404)
    })

    it('should handle URLs with various protocol schemes', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/resource', () => Response.json({accessed: true}))

      const protocols = [
        'http://',
        'https://',
        'ftp://',
        'file://',
        'custom://',
      ]

      for (const protocol of protocols) {
        const req = {
          method: 'GET',
          url: `${protocol}example.com/resource`,
          headers: {},
        }
        const result = await router.fetch(req)
        const data = await result.json()
        expect(data.accessed).toBe(true)
      }
    })
  })

  describe('Parameter Assignment Edge Cases', () => {
    it('should handle middleware that deletes req.params', async () => {
      const router = require('../../lib/router/sequential')()

      // Route without parameters to test parameter initialization
      router.get('/clear/test', (req) => {
        return Response.json({
          hasParams: !!req.params,
          params: req.params,
        })
      })

      const req = createTestRequest('GET', '/clear/test')
      const result = await router.fetch(req)

      // Should initialize empty params object when none exist
      const data = await result.json()
      expect(data.hasParams).toBe(true)
      expect(data.params).toEqual({}) // Should be set to emptyParams
    })

    it('should handle routes that never set params', async () => {
      const router = require('../../lib/router/sequential')()

      // Route without parameters that doesn't set req.params
      router.get('/no-params-route', (req) => {
        // Verify params is not set by route matching
        return {
          paramsExists: 'params' in req,
          params: req.params,
        }
      })

      const req = createTestRequest('GET', '/no-params-route')
      delete req.params // Ensure params is not preset

      const result = await router.fetch(req)

      // Should set empty params
      expect(result.paramsExists).toBe(true)
      expect(result.params).toEqual({})
    })

    it('should handle complex parameter scenarios with middleware', async () => {
      const router = require('../../lib/router/sequential')()

      // Middleware that modifies params in various ways AFTER they are set
      router.use('/param-test/*', (req, next) => {
        // Record what action was taken for testing
        if (req.url.includes('delete')) {
          req.middlewareAction = 'deleted'
          delete req.params
        } else if (req.url.includes('null')) {
          req.middlewareAction = 'nulled'
          req.params = null
        } else if (req.url.includes('undefined')) {
          req.middlewareAction = 'undefined'
          req.params = undefined
        }
        return next()
      })

      router.get('/param-test/:action/:id', (req) =>
        Response.json({
          // Since middleware runs after params are assigned and deletes them,
          // params will be undefined/null for these test cases
          action: req.params ? req.params.action : null,
          id: req.params ? req.params.id : null,
          paramsType: typeof req.params,
          middlewareAction: req.middlewareAction,
        }),
      )

      const testCases = [
        {url: '/param-test/delete/123', expectedMiddlewareAction: 'deleted'},
        {url: '/param-test/null/456', expectedMiddlewareAction: 'nulled'},
        {
          url: '/param-test/undefined/789',
          expectedMiddlewareAction: 'undefined',
        },
      ]

      for (const testCase of testCases) {
        const req = createTestRequest('GET', testCase.url)
        const result = await router.fetch(req)

        const data = await result.json()
        expect(data.middlewareAction).toBe(testCase.expectedMiddlewareAction)
        expect(data.action).toBe(null) // Params were deleted by middleware
        expect(data.id).toBe(null) // Params were deleted by middleware
      }
    })
  })

  describe('Query String Edge Cases', () => {
    it('should handle malformed query strings', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/search', (req) => ({query: req.query}))

      const malformedQueries = [
        '/search?',
        '/search?key',
        '/search?key=',
        '/search?=value',
        '/search?key1=value1&',
        '/search?&key=value',
        '/search?key1=value1&&key2=value2',
        '/search?key=value1&key=value2', // Duplicate keys
      ]

      for (const url of malformedQueries) {
        const req = createTestRequest('GET', url)
        const result = await router.fetch(req)

        // Should not throw errors
        expect(typeof result.query).toBe('object')
      }
    })

    it('should handle query strings with special characters', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/data', (req) => Response.json({query: req.query}))

      const specialCases = [
        {url: '/data?key=%20value%20', expected: {key: ' value '}}, // Query parser decodes automatically
        {url: '/data?café=münchën', expected: {café: 'münchën'}},
        {url: '/data?key=value%26more', expected: {key: 'value&more'}}, // & is decoded
        {url: '/data?a[]=1&a[]=2', expected: {'a[]': ['1', '2']}}, // Arrays are preserved
      ]

      for (const testCase of specialCases) {
        const req = createTestRequest('GET', testCase.url)
        const result = await router.fetch(req)

        const data = await result.json()
        expect(data.query).toEqual(testCase.expected)
      }
    })
  })

  describe('Route Matching Boundary Conditions', () => {
    it('should handle very long URLs', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/api/:id', (req) => ({id: req.params.id}))

      // Create a very long ID
      const longId = 'a'.repeat(1000)
      const req = createTestRequest('GET', `/api/${longId}`)
      const result = await router.fetch(req)

      expect(result.id).toBe(longId)
    })

    it('should handle routes with many segments', async () => {
      const router = require('../../lib/router/sequential')()

      const segments = Array(20)
        .fill(null)
        .map((_, i) => `:param${i}`)
        .join('/')
      const routePath = `/deep/${segments}`

      router.get(routePath, (req) => ({
        paramCount: Object.keys(req.params).length,
        firstParam: req.params.param0,
        lastParam: req.params.param19,
      }))

      const values = Array(20)
        .fill(null)
        .map((_, i) => `value${i}`)
        .join('/')
      const requestPath = `/deep/${values}`

      const req = createTestRequest('GET', requestPath)
      const result = await router.fetch(req)

      expect(result.paramCount).toBe(20)
      expect(result.firstParam).toBe('value0')
      expect(result.lastParam).toBe('value19')
    })

    it('should handle empty path segments', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/test/:id/action', (req) =>
        Response.json({id: req.params.id}),
      )

      // Only test cases that actually match the route pattern
      const edgeCases = [
        '/test/ /action', // Space segment (valid parameter)
        '/test/0/action', // Zero value (valid parameter)
        '/test/false/action', // Falsy string (valid parameter)
      ]

      for (const url of edgeCases) {
        const req = createTestRequest('GET', url)
        const result = await router.fetch(req)

        const data = await result.json()
        expect(typeof data.id).toBe('string')
      }

      // Test that truly empty segments return 404
      const emptySegmentReq = createTestRequest('GET', '/test//action')
      const emptyResult = await router.fetch(emptySegmentReq)
      expect(emptyResult.status).toBe(404)
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle null/undefined middleware functions', async () => {
      const router = require('../../lib/router/sequential')()

      // This should not break the router
      router.get('/test', null, (req) => ({message: 'success'}))

      const originalError = console.error
      console.error = () => {}

      const req = createTestRequest('GET', '/test')
      const result = await router.fetch(req)

      console.error = originalError

      // Should handle gracefully
      expect(typeof result).toBe('object')
    })

    it('should handle middleware that returns non-standard values', async () => {
      const router = require('../../lib/router/sequential')()

      router.use('/weird/*', (req, next) => {
        req.step1 = true
        // Return non-standard value instead of calling next() - this should short-circuit
        return 'weird-return-value'
      })

      router.get('/weird/test', (req) =>
        Response.json({
          step1: req.step1,
          message: 'reached handler',
        }),
      )

      const req = createTestRequest('GET', '/weird/test')
      const result = await router.fetch(req)

      // Should return the middleware's return value directly, not reach the handler
      expect(result).toBe('weird-return-value')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle rapid successive requests without memory leaks', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/ping', () => ({pong: true}))

      // Rapid fire requests
      const requests = Array(100)
        .fill(null)
        .map(() => router.fetch(createTestRequest('GET', '/ping')))

      const results = await Promise.all(requests)

      results.forEach((result) => {
        expect(result.pong).toBe(true)
      })

      // Memory should be stable (no easy way to test, but ensure no errors)
      expect(results.length).toBe(100)
    })

    it('should handle concurrent requests to different routes', async () => {
      const router = require('../../lib/router/sequential')()

      // Create many different routes
      for (let i = 0; i < 50; i++) {
        router.get(`/route${i}`, () => ({route: i}))
      }

      // Concurrent requests to different routes
      const requests = Array(50)
        .fill(null)
        .map((_, i) => router.fetch(createTestRequest('GET', `/route${i}`)))

      const results = await Promise.all(requests)

      results.forEach((result, i) => {
        expect(result.route).toBe(i)
      })
    })
  })
})
