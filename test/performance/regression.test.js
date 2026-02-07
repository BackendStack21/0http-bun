/* global describe, it, expect, beforeAll */

const http = require('../../index')
const {measureTime, createTestRequest} = require('../helpers')

describe('Performance Regression Tests', () => {
  let router

  beforeAll(async () => {
    const {router: testRouter} = http({port: 3000})
    router = testRouter

    // Setup routes for performance testing
    router.get('/simple', () => new Response('OK'))
    router.get('/params/:id', (req) => Response.json({id: req.params.id}))
    router.get('/multi-params/:userId/posts/:postId', (req) =>
      Response.json(req.params),
    )
    router.get('/query', (req) => Response.json(req.query))

    // Add middleware for middleware performance tests
    router.use((req, next) => {
      req.timestamp = Date.now()
      return next()
    })

    router.get('/with-middleware', (req) =>
      Response.json({timestamp: req.timestamp}),
    )

    // Setup routes for cache performance
    for (let i = 0; i < 50; i++) {
      router.get(`/route${i}/:id`, (req) =>
        Response.json({route: i, id: req.params.id}),
      )
    }
  })

  describe('Route Resolution Performance', () => {
    it('should resolve simple routes quickly', async () => {
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', '/simple'))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(1) // Less than 1ms per request on average
    })

    it('should resolve parameterized routes efficiently', async () => {
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', `/params/${i}`))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(2) // Less than 2ms per request with parameter extraction
    })

    it('should handle complex parameterized routes within performance bounds', async () => {
      const iterations = 500
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(
            createTestRequest('GET', `/multi-params/user${i}/posts/post${i}`),
          )
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(3) // Less than 3ms per request with multiple parameters
    })
  })

  describe('Cache Performance', () => {
    it('should benefit from route caching', async () => {
      const path = '/params/cached-test'

      // Warm up cache
      await router.fetch(createTestRequest('GET', path))

      // Measure cache hit performance
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', path))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(0.5) // Cached requests should be very fast
    })

    it('should handle cache misses efficiently', async () => {
      const iterations = 100
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(
            createTestRequest('GET', `/params/unique-${i}-${Date.now()}`),
          )
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(2) // Cache misses should still be fast
    })

    it('should maintain performance with large route sets', async () => {
      const iterations = 200
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          const routeIndex = i % 50
          await router.fetch(
            createTestRequest('GET', `/route${routeIndex}/test${i}`),
          )
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(2) // Should handle many routes efficiently
    })
  })

  describe('Query String Performance', () => {
    it('should parse query strings efficiently', async () => {
      const iterations = 1000
      const queryString =
        'param1=value1&param2=value2&param3=value3&param4=value4&param5=value5'

      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', `/query?${queryString}`))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(1.5) // Query parsing should be fast
    })

    it('should handle empty query strings quickly', async () => {
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', '/query'))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(0.5) // Empty query handling should be very fast
    })
  })

  describe('Middleware Performance', () => {
    it('should execute middleware efficiently', async () => {
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', '/with-middleware'))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(1.5) // Middleware overhead should be minimal
    })

    it('should handle multiple middlewares without significant overhead', async () => {
      // Create a router with multiple middlewares
      const {router: multiMiddlewareRouter} = http({port: 3001})

      for (let i = 0; i < 5; i++) {
        multiMiddlewareRouter.use((req, next) => {
          req[`middleware${i}`] = true
          return next()
        })
      }

      multiMiddlewareRouter.get('/multi-middleware', (req) =>
        Response.json({ok: true}),
      )

      const iterations = 500
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await multiMiddlewareRouter.fetch(
            createTestRequest('GET', '/multi-middleware'),
          )
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(3) // Multiple middlewares should still be reasonably fast
    })
  })

  describe('Error Handling Performance', () => {
    it('should handle 404 errors efficiently', async () => {
      const iterations = 1000
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', `/nonexistent-${i}`))
        }
      })

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(1) // 404 handling should be fast
    })

    it('should handle thrown errors without significant performance impact', async () => {
      router.get('/error-test', () => {
        throw new Error('Test error')
      })

      // Suppress console.error during perf test (default error handler logs errors)
      const originalError = console.error
      console.error = () => {}

      const iterations = 500
      const {time} = await measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          await router.fetch(createTestRequest('GET', '/error-test'))
        }
      })

      console.error = originalError

      const avgTime = time / iterations
      expect(avgTime).toBeLessThan(3) // Error handling should not be too slow
    })
  })

  describe('Concurrent Request Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrency = 50
      const requestsPerBatch = 10

      const {time} = await measureTime(async () => {
        const batches = Array(concurrency)
          .fill(null)
          .map(() =>
            Promise.all(
              Array(requestsPerBatch)
                .fill(null)
                .map((_, i) =>
                  router.fetch(
                    createTestRequest('GET', `/params/concurrent-${i}`),
                  ),
                ),
            ),
          )

        await Promise.all(batches)
      })

      const totalRequests = concurrency * requestsPerBatch
      const avgTime = time / totalRequests

      expect(avgTime).toBeLessThan(5) // Should handle concurrent load well
      expect(time).toBeLessThan(5000) // Total time should be reasonable
    })
  })

  describe('Memory Usage Performance', () => {
    it('should not create excessive objects during route resolution', async () => {
      // This test measures if we're reusing objects effectively
      const iterations = 1000
      const path = '/params/memory-test'

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const startMemory = process.memoryUsage().heapUsed

      for (let i = 0; i < iterations; i++) {
        await router.fetch(createTestRequest('GET', path))
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory
      const memoryPerRequest = memoryIncrease / iterations

      // Should not use more than 1KB per request on average (generous threshold)
      expect(memoryPerRequest).toBeLessThan(1024)
    })
  })

  describe('Performance Baseline Validation', () => {
    it('should meet baseline performance requirements', async () => {
      const testCases = [
        {name: 'Simple route', path: '/simple', maxTime: 0.5},
        {name: 'Parameterized route', path: '/params/123', maxTime: 1.0},
        {name: 'Query string route', path: '/query?test=value', maxTime: 1.0},
        {name: 'Middleware route', path: '/with-middleware', maxTime: 1.5},
      ]

      for (const testCase of testCases) {
        const iterations = 100
        const {time} = await measureTime(async () => {
          for (let i = 0; i < iterations; i++) {
            await router.fetch(createTestRequest('GET', testCase.path))
          }
        })

        const avgTime = time / iterations
        expect(avgTime).toBeLessThan(testCase.maxTime)
      }
    })
  })

  describe('Advanced Performance Scenarios', () => {
    it('should handle URL parsing performance with various formats', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/test', () => ({message: 'success'}))

      const urlFormats = [
        'http://example.com/test',
        'https://api.example.com/test?query=value',
        'ftp://files.example.com/test',
        '/test',
        '//cdn.example.com/test',
        'http://localhost:3000/test?complex=query&with=multiple&params=here',
      ]

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const url of urlFormats) {
          const req = {method: 'GET', url, headers: {}}
          await router.fetch(req)
        }
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / (iterations * urlFormats.length)

      expect(avgTime).toBeLessThan(1) // Should parse URLs very quickly
    })

    it('should maintain performance with deep middleware nesting', async () => {
      const router = require('../../lib/router/sequential')()

      // Create deep middleware chain - all on same path to ensure they all execute
      const middlewareDepth = 20
      for (let i = 0; i < middlewareDepth; i++) {
        router.use('/deep/*', (req, next) => {
          req[`middleware${i}`] = true
          return next()
        })
      }

      router.get('/deep/endpoint', (req) =>
        Response.json({
          middlewareCount: Object.keys(req).filter((k) =>
            k.startsWith('middleware'),
          ).length,
        }),
      )

      const iterations = 50
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const req = {
          method: 'GET',
          url: '/deep/endpoint',
          headers: {},
        }
        const result = await router.fetch(req)
        const data = await result.json()
        expect(data.middlewareCount).toBe(middlewareDepth)
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(10) // Should handle deep nesting efficiently
    })

    it('should optimize parameter extraction performance', async () => {
      const router = require('../../lib/router/sequential')()

      // Routes with various parameter patterns
      router.get('/simple/:id', (req) => req.params)
      router.get('/complex/:a/:b/:c/:d/:e', (req) => req.params)
      router.get('/mixed/:id/static/:name/more/:value', (req) => req.params)

      const testRoutes = [
        {url: '/simple/123', expectedParams: {id: '123'}},
        {
          url: '/complex/1/2/3/4/5',
          expectedParams: {a: '1', b: '2', c: '3', d: '4', e: '5'},
        },
        {
          url: '/mixed/abc/static/test/more/xyz',
          expectedParams: {id: 'abc', name: 'test', value: 'xyz'},
        },
      ]

      const iterations = 200
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const route of testRoutes) {
          const req = {method: 'GET', url: route.url, headers: {}}
          const result = await router.fetch(req)
          expect(result).toEqual(route.expectedParams)
        }
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / (iterations * testRoutes.length)

      expect(avgTime).toBeLessThan(0.5) // Parameter extraction should be very fast
    })

    it('should handle edge case URLs without performance degradation', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/test', () => ({message: 'success'}))

      const edgeCaseUrls = [
        'http://example.com', // No path
        'https://example.com/', // Root path only
        'http://localhost:8080', // With port, no path
        'https://api.example.com/test?a=1&b=2&c=3&d=4&e=5', // Many query params
        '/test?query=value%20with%20spaces&other=%20%20', // Encoded spaces
        '//cdn.example.com/test', // Protocol-relative
        'ftp://files.example.com/test?large=data', // Different protocol
      ]

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const url of edgeCaseUrls) {
          const req = {method: 'GET', url, headers: {}}
          await router.fetch(req)
        }
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / (iterations * edgeCaseUrls.length)

      expect(avgTime).toBeLessThan(1) // Edge cases should not degrade performance
    })
  })
})
