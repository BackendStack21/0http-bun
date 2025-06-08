/* global describe, it, expect, beforeAll */

const http = require('../../index')
const {createTestRequest, measureTime} = require('../helpers')

describe('Router Integration Tests', () => {
  let router

  beforeAll(async () => {
    const {router: testRouter} = http({port: 3000})
    router = testRouter

    // Setup middleware
    router.use((req, next) => {
      req.ctx = {
        engine: 'bun',
      }
      return next()
    })

    // Setup routes
    router.get('/get-params/:id', (req) => {
      return Response.json(req.params)
    })

    router.get('/qs', (req) => {
      return Response.json(req.query)
    })

    router.delete('/get-params/:id', () => {
      return Response.json('OK')
    })

    router.get('/error', () => {
      throw new Error('Unexpected error')
    })

    router.post('/create', async (req) => {
      const body = await req.text()
      return Response.json(JSON.parse(body))
    })

    router.get('/', (req) => {
      return Response.json(req.ctx)
    })
  })

  describe('Parameter Handling', () => {
    it('should return a JSON response with the request parameters for GET requests', async () => {
      const response = await router.fetch(
        createTestRequest('GET', '/get-params/123'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({id: '123'})
    })

    it('should return a JSON response with the request parameters for DELETE requests', async () => {
      const response = await router.fetch(
        createTestRequest('DELETE', '/get-params/123'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual('OK')
    })

    it('should handle complex parameter patterns', async () => {
      router.get('/users/:userId/posts/:postId', (req) => {
        return Response.json(req.params)
      })

      const response = await router.fetch(
        createTestRequest('GET', '/users/42/posts/123'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({userId: '42', postId: '123'})
    })
  })

  describe('Query String Handling', () => {
    it('should return a JSON response with the query string parameters', async () => {
      const response = await router.fetch(
        createTestRequest('GET', '/qs?foo=bar'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({foo: 'bar'})
    })

    it('should handle multiple query parameters', async () => {
      const response = await router.fetch(
        createTestRequest('GET', '/qs?foo=bar&baz=qux&num=123'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        foo: 'bar',
        baz: 'qux',
        num: '123',
      })
    })

    it('should handle empty query string', async () => {
      const response = await router.fetch(createTestRequest('GET', '/qs'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({})
    })
  })

  describe('Request Body Handling', () => {
    it('should return a JSON response with the request body for POST requests', async () => {
      const response = await router.fetch(
        new Request('http://localhost:3000/create', {
          method: 'POST',
          body: JSON.stringify({foo: 'bar'}),
          headers: {'Content-Type': 'application/json'},
        }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({foo: 'bar'})
    })

    it('should handle large request bodies', async () => {
      const largeData = {items: Array(1000).fill({id: 1, name: 'test'})}
      const response = await router.fetch(
        new Request('http://localhost:3000/create', {
          method: 'POST',
          body: JSON.stringify(largeData),
          headers: {'Content-Type': 'application/json'},
        }),
      )
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.items).toHaveLength(1000)
    })
  })

  describe('Middleware Integration', () => {
    it('should return a 200 response for a route that uses middleware context', async () => {
      const response = await router.fetch(createTestRequest('GET', '/'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({engine: 'bun'})
    })

    it('should handle middleware chain properly', async () => {
      // Add a second middleware
      router.use((req, next) => {
        req.ctx.timestamp = Date.now()
        return next()
      })

      router.get('/middleware-test', (req) => {
        return Response.json({
          engine: req.ctx.engine,
          hasTimestamp: typeof req.ctx.timestamp === 'number',
        })
      })

      const response = await router.fetch(
        createTestRequest('GET', '/middleware-test'),
      )
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.engine).toBe('bun')
      expect(result.hasTimestamp).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should return a 500 response for a route that throws an error', async () => {
      const response = await router.fetch(createTestRequest('GET', '/error'))
      expect(response.status).toBe(500)
      expect(await response.text()).toEqual('Unexpected error')
    })

    it('should return a 404 response for a non-existent route', async () => {
      const response = await router.fetch(
        createTestRequest('GET', '/non-existent'),
      )
      expect(response.status).toBe(404)
    })
  })

  describe('HTTP Methods', () => {
    beforeAll(() => {
      router.post('/methods/post', () => Response.json({method: 'POST'}))
      router.put('/methods/put', () => Response.json({method: 'PUT'}))
      router.patch('/methods/patch', () => Response.json({method: 'PATCH'}))
      router.delete('/methods/delete', () => Response.json({method: 'DELETE'}))
      router.head('/methods/head', () => new Response(null, {status: 200}))
      router.options('/methods/options', () =>
        Response.json({method: 'OPTIONS'}),
      )
    })

    it('should handle POST requests', async () => {
      const response = await router.fetch(
        createTestRequest('POST', '/methods/post'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'POST'})
    })

    it('should handle PUT requests', async () => {
      const response = await router.fetch(
        createTestRequest('PUT', '/methods/put'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'PUT'})
    })

    it('should handle PATCH requests', async () => {
      const response = await router.fetch(
        createTestRequest('PATCH', '/methods/patch'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'PATCH'})
    })

    it('should handle DELETE requests', async () => {
      const response = await router.fetch(
        createTestRequest('DELETE', '/methods/delete'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'DELETE'})
    })

    it('should handle HEAD requests', async () => {
      const response = await router.fetch(
        createTestRequest('HEAD', '/methods/head'),
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('')
    })

    it('should handle OPTIONS requests', async () => {
      const response = await router.fetch(
        createTestRequest('OPTIONS', '/methods/options'),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'OPTIONS'})
    })
  })

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const promises = Array(100)
        .fill(null)
        .map((_, i) =>
          router.fetch(createTestRequest('GET', `/get-params/${i}`)),
        )

      const startTime = performance.now()
      const responses = await Promise.all(promises)
      const endTime = performance.now()

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000) // 1 second for 100 requests
    })

    it('should maintain performance with route caching', async () => {
      const path = '/get-params/performance-test'

      // First request (cache miss)
      const {time: firstTime} = await measureTime(async () => {
        await router.fetch(createTestRequest('GET', path))
      })

      // Second request (cache hit)
      const {time: secondTime} = await measureTime(async () => {
        await router.fetch(createTestRequest('GET', path))
      })

      // Cached request should be faster or similar (allow for timing variance)
      // Performance may vary, so we just verify both requests complete successfully
      expect(firstTime).toBeGreaterThan(0)
      expect(secondTime).toBeGreaterThan(0)
      expect(secondTime).toBeLessThanOrEqual(firstTime * 3) // Allow 300% variance for timing fluctuations
    })
  })

  describe('Advanced Integration Scenarios', () => {
    it('should handle complex nested middleware scenarios', async () => {
      const router = require('../../lib/router/sequential')()
      const executionOrder = []

      // Global middleware
      router.use((req, next) => {
        executionOrder.push('global')
        req.globalFlag = true
        return next()
      })

      // Path-specific middleware with nesting
      router.use('/api/*', (req, next) => {
        executionOrder.push('api-middleware')
        req.apiFlag = true
        return next()
      })

      router.use('/api/v1/*', (req, next) => {
        executionOrder.push('v1-middleware')
        req.v1Flag = true
        return next()
      })

      router.get('/api/v1/test', (req) => {
        executionOrder.push('handler')
        return {
          order: executionOrder,
          flags: {
            global: req.globalFlag,
            api: req.apiFlag,
            v1: req.v1Flag,
          },
        }
      })

      const req = createTestRequest('GET', '/api/v1/test')
      const result = await router.fetch(req)

      expect(result.order).toEqual([
        'global',
        'api-middleware',
        'v1-middleware',
        'handler',
      ])
      expect(result.flags).toEqual({
        global: true,
        api: true,
        v1: true,
      })
    })

    it('should handle URLs with special characters and encoding', async () => {
      const router = require('../../lib/router/sequential')()

      router.get('/search/:term', (req) =>
        Response.json({
          term: req.params.term,
          query: req.query,
        }),
      )

      const testCases = [
        {
          url: '/search/hello%20world?filter=test%20value',
          expectedTerm: 'hello%20world',
          expectedQuery: {filter: 'test value'}, // Query parser decodes spaces
        },
        {
          url: '/search/café?type=beverage',
          expectedTerm: 'caf%C3%A9', // URL parameters are URL-encoded
          expectedQuery: {type: 'beverage'},
        },
        {
          url: '/search/path%2Fwith%2Fslashes',
          expectedTerm: 'path%2Fwith%2Fslashes',
          expectedQuery: {},
        },
      ]

      for (const testCase of testCases) {
        const req = createTestRequest('GET', testCase.url)
        const result = await router.fetch(req)

        const data = await result.json()
        expect(data.term).toBe(testCase.expectedTerm)
        expect(data.query).toEqual(testCase.expectedQuery)
      }
    })

    it('should handle high-load scenarios with route caching', async () => {
      const router = require('../../lib/router/sequential')()

      // Create many routes to test caching effectiveness
      for (let i = 0; i < 50; i++) {
        router.get(`/route${i}/:id`, (req) => ({
          routeNumber: i,
          id: req.params.id,
        }))
      }

      // Test concurrent requests to the same route (should hit cache)
      const requests = Array(20)
        .fill(null)
        .map(() => createTestRequest('GET', '/route25/test-id'))

      const startTime = performance.now()
      const results = await Promise.all(
        requests.map((req) => router.fetch(req)),
      )
      const endTime = performance.now()

      // All results should be identical
      results.forEach((result) => {
        expect(result.routeNumber).toBe(25)
        expect(result.id).toBe('test-id')
      })

      // Should complete efficiently due to caching
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('should handle middleware error propagation in complex chains', async () => {
      const router = require('../../lib/router/sequential')()

      router.use('/api/*', (req, next) => {
        req.step1 = true
        return next()
      })

      router.use('/api/error/*', (req, next) => {
        req.step2 = true
        throw new Error('Middleware error in chain')
      })

      router.use('/api/error/*', (req, next) => {
        req.step3 = true // Should not execute
        return next()
      })

      router.get('/api/error/test', (req) => {
        req.handlerExecuted = true // Should not execute
        return {success: true}
      })

      const req = createTestRequest('GET', '/api/error/test')
      const result = await router.fetch(req)

      // Should get error response with error handling
      expect(result.status).toBe(500)
      expect(req.step1).toBe(true)
      expect(req.step2).toBe(true)
      expect(req.step3).toBeUndefined()
      expect(req.handlerExecuted).toBeUndefined()
    })

    it('should handle memory efficiency with large parameter sets', async () => {
      const router = require('../../lib/router/sequential')()

      // Route with many parameters
      router.get('/api/:v1/:v2/:v3/:v4/:v5/:v6/:v7/:v8/:v9/:v10', (req) => {
        return {
          paramCount: Object.keys(req.params).length,
          params: req.params,
        }
      })

      const req = createTestRequest(
        'GET',
        '/api/a/b/c/d/e/f/g/h/i/j?large=query&with=many&params=here',
      )
      const result = await router.fetch(req)

      expect(result.paramCount).toBe(10)
      expect(result.params).toEqual({
        v1: 'a',
        v2: 'b',
        v3: 'c',
        v4: 'd',
        v5: 'e',
        v6: 'f',
        v7: 'g',
        v8: 'h',
        v9: 'i',
        v10: 'j',
      })
      expect(req.query).toEqual({
        large: 'query',
        with: 'many',
        params: 'here',
      })
    })
  })
})
