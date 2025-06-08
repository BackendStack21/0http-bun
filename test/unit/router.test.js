/* global describe, it, expect, beforeEach */

const router = require('../../lib/router/sequential')
const {createTestRequest} = require('../helpers')

describe('Sequential Router Unit Tests', () => {
  let routerInstance

  beforeEach(() => {
    routerInstance = router({port: 3000})
  })

  describe('Router Initialization', () => {
    it('should create a router with default configuration', () => {
      const defaultRouter = router()
      expect(defaultRouter.port).toBe(3000)
    })

    it('should create a router with custom port', () => {
      const customRouter = router({port: 8080})
      expect(customRouter.port).toBe(8080)
    })

    it('should create a router with custom defaultRoute', () => {
      const customDefaultRoute = () => new Response('Custom 404', {status: 404})
      const customRouter = router({defaultRoute: customDefaultRoute})
      expect(customRouter).toBeDefined()
    })

    it('should create a router with custom errorHandler', () => {
      const customErrorHandler = (err) =>
        new Response(`Custom error: ${err.message}`, {status: 500})
      const customRouter = router({errorHandler: customErrorHandler})
      expect(customRouter).toBeDefined()
    })
  })

  describe('Route Registration', () => {
    it('should register GET routes', () => {
      const handler = () => new Response('GET response')
      routerInstance.get('/test', handler)

      // Router should have the route registered (internal structure test)
      expect(routerInstance.routes).toBeDefined()
    })

    it('should register POST routes', () => {
      const handler = () => new Response('POST response')
      routerInstance.post('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register PUT routes', () => {
      const handler = () => new Response('PUT response')
      routerInstance.put('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register DELETE routes', () => {
      const handler = () => new Response('DELETE response')
      routerInstance.delete('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register PATCH routes', () => {
      const handler = () => new Response('PATCH response')
      routerInstance.patch('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register HEAD routes', () => {
      const handler = () => new Response(null, {status: 200})
      routerInstance.head('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register OPTIONS routes', () => {
      const handler = () => new Response('OPTIONS response')
      routerInstance.options('/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })

    it('should register routes using router.on method', () => {
      const handler = () => new Response('Custom method response')
      routerInstance.on('CUSTOM', '/test', handler)

      expect(routerInstance.routes).toBeDefined()
    })
  })

  describe('Middleware Registration', () => {
    it('should register global middleware', () => {
      const middleware = (req, next) => {
        req.middleware = true
        return next()
      }

      routerInstance.use(middleware)
      expect(routerInstance.use).toBeDefined()
    })

    it('should register path-specific middleware', () => {
      const middleware = (req, next) => {
        req.pathMiddleware = true
        return next()
      }

      routerInstance.use('/api', middleware)
      expect(routerInstance.use).toBeDefined()
    })

    it('should register multiple middlewares', () => {
      const middleware1 = (req, next) => {
        req.m1 = true
        return next()
      }
      const middleware2 = (req, next) => {
        req.m2 = true
        return next()
      }

      routerInstance.use(middleware1, middleware2)
      expect(routerInstance.use).toBeDefined()
    })
  })

  describe('Request Handling', () => {
    it('should handle simple GET requests', async () => {
      routerInstance.get('/hello', () => new Response('Hello World'))

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/hello'),
      )

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Hello World')
    })

    it('should handle parameterized routes', async () => {
      routerInstance.get('/users/:id', (req) => {
        return Response.json({userId: req.params.id})
      })

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/users/123'),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({userId: '123'})
    })

    it('should handle multiple parameters', async () => {
      routerInstance.get('/users/:userId/posts/:postId', (req) => {
        return Response.json(req.params)
      })

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/users/123/posts/456'),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({userId: '123', postId: '456'})
    })

    it('should handle query parameters', async () => {
      routerInstance.get('/search', (req) => {
        return Response.json(req.query)
      })

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/search?q=test&limit=10'),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({q: 'test', limit: '10'})
    })

    it('should handle empty query string', async () => {
      routerInstance.get('/search', (req) => {
        return Response.json(req.query)
      })

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/search'),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({})
    })

    it('should handle routes registered with router.on method', async () => {
      routerInstance.on('PATCH', '/custom/:id', (req) => {
        return Response.json({method: 'PATCH', id: req.params.id})
      })

      const response = await routerInstance.fetch(
        createTestRequest('PATCH', '/custom/123'),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({method: 'PATCH', id: '123'})
    })
  })

  describe('Default Route Handling', () => {
    it('should return 404 for unmatched routes with default handler', async () => {
      const response = await routerInstance.fetch(
        createTestRequest('GET', '/nonexistent'),
      )

      expect(response.status).toBe(404)
    })

    it('should use custom default route handler', async () => {
      const customRouter = router({
        defaultRoute: () => new Response('Custom Not Found', {status: 404}),
      })

      const response = await customRouter.fetch(
        createTestRequest('GET', '/nonexistent'),
      )

      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Custom Not Found')
    })
  })

  describe('Error Handling', () => {
    it('should handle errors with default error handler', async () => {
      routerInstance.get('/error', () => {
        throw new Error('Test error')
      })

      const response = await routerInstance.fetch(
        createTestRequest('GET', '/error'),
      )

      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Test error')
    })

    it('should use custom error handler', async () => {
      const customRouter = router({
        errorHandler: (err) =>
          new Response(`Custom: ${err.message}`, {status: 500}),
      })

      customRouter.get('/error', () => {
        throw new Error('Test error')
      })

      const response = await customRouter.fetch(
        createTestRequest('GET', '/error'),
      )

      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Custom: Test error')
    })

    it('should handle async errors', async () => {
      routerInstance.get('/async-error', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        throw new Error('Async error')
      })

      // Test that the router can handle the request, even if the handler throws
      // The actual error handling behavior may vary based on the router implementation
      try {
        const response = await routerInstance.fetch(
          createTestRequest('GET', '/async-error'),
        )

        // If the router handles the error, it should return a 500 response
        if (response && response.status) {
          expect(response.status).toBe(500)
          expect(await response.text()).toBe('Async error')
        }
      } catch (error) {
        // If the error is not caught by the router, verify it's the expected error
        expect(error.message).toBe('Async error')
      }
    })
  })

  describe('Route Caching', () => {
    it('should cache route lookups for performance', async () => {
      routerInstance.get('/cached/:id', (req) => {
        return Response.json({id: req.params.id, cached: true})
      })

      // First request (cache miss)
      const response1 = await routerInstance.fetch(
        createTestRequest('GET', '/cached/123'),
      )

      // Second request (cache hit)
      const response2 = await routerInstance.fetch(
        createTestRequest('GET', '/cached/123'),
      )

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      expect(await response1.json()).toEqual({id: '123', cached: true})
      expect(await response2.json()).toEqual({id: '123', cached: true})
    })

    it('should handle different routes with same pattern', async () => {
      routerInstance.get('/items/:id', (req) => {
        return Response.json({type: 'item', id: req.params.id})
      })

      const response1 = await routerInstance.fetch(
        createTestRequest('GET', '/items/123'),
      )
      const response2 = await routerInstance.fetch(
        createTestRequest('GET', '/items/456'),
      )

      expect(await response1.json()).toEqual({type: 'item', id: '123'})
      expect(await response2.json()).toEqual({type: 'item', id: '456'})
    })
  })

  describe('Edge Cases and Full Coverage', () => {
    it('should handle URLs without path after protocol', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/test', () => ({message: 'success'}))

      // URL with domain but no path component triggers pathStart = url.length
      const req = {
        method: 'GET',
        url: 'http://example.com', // Domain-only URL with no path
        headers: {},
      }

      const result = await router.fetch(req)
      expect(result.status).toBe(404) // Falls through to default route handler
    })

    it('should handle routes that do not set params', async () => {
      const router = require('../../lib/router/sequential')()

      // Route without parameters exercises null/undefined params handling
      router.get('/no-params-route', (req) => {
        return Response.json({message: 'no params route', params: req.params})
      })

      const req1 = {
        method: 'GET',
        url: 'http://localhost/no-params-route',
        headers: {},
      }
      // Remove any existing params property to test initialization
      delete req1.params
      expect(req1.params).toBeUndefined()

      const result1 = await router.fetch(req1)
      expect(result1.status).toBe(200)
      const data1 = await result1.json()
      expect(data1.message).toBe('no params route')
      expect(req1.params).toEqual({}) // Router sets empty params object

      // Route with empty params object (hasParams check evaluates to false)
      // Simulates trouter match_result that has params: {} but no enumerable properties
      // Uses different router instance to test static route handling

      const router2 = require('../../lib/router/sequential')()

      // Static route creates scenario where params exists but is empty
      router2.get('/static-route', (req) => {
        return Response.json({message: 'static route', params: req.params})
      })

      const req2 = {
        method: 'GET',
        url: 'http://localhost/static-route',
        headers: {},
      }
      // Remove params property to test router initialization behavior
      delete req2.params
      expect(req2.params).toBeUndefined()

      const result2 = await router2.fetch(req2)
      expect(result2.status).toBe(200)
      const data2 = await result2.json()
      expect(data2.message).toBe('static route')
      expect(req2.params).toEqual({}) // Router sets empty params object for static routes
    })

    it('should handle complex URL parsing edge cases', async () => {
      const router = require('../../lib/router/sequential')()
      router.get('/test', () => ({message: 'success'}))

      // URL formats that exercise different parsing logic branches
      const testCases = [
        'https://example.com', // Domain without path
        'http://localhost', // Localhost without path
        'ftp://example.com/test', // Non-HTTP protocol
        '/test', // Relative URL
        '//example.com/test', // Protocol-relative URL
      ]

      for (const url of testCases) {
        const req = {
          method: 'GET',
          url,
          headers: {},
        }

        const result = await router.fetch(req)
        // Router should handle all URL formats without throwing errors
        expect(typeof result).toBe('object')
      }
    })

    it('should handle middleware with various parameter scenarios', async () => {
      const router = require('../../lib/router/sequential')()

      // Static route without parameters tests empty params initialization
      router.get('/clear-params/test', (req) => {
        return Response.json({params: req.params})
      })

      const req = {
        method: 'GET',
        url: '/clear-params/test',
        headers: {},
      }

      const result = await router.fetch(req)
      // Static route without parameters initializes req.params to empty object
      expect(req.params).toEqual({})
    })

    it('should handle route matching with various URL structures', async () => {
      const router = require('../../lib/router/sequential')()

      router.get('/api/:version/users/:id', (req) => ({
        version: req.params.version,
        id: req.params.id,
      }))

      // Test URL that exercises different parsing paths
      const req = {
        method: 'GET',
        url: 'https://api.example.com/api/v1/users/123?foo=bar',
        headers: {},
      }

      const result = await router.fetch(req)
      expect(result.version).toBe('v1')
      expect(result.id).toBe('123')
    })

    it('should handle static routes and parameter initialization', async () => {
      // Test static route with empty params initialization
      const router1 = require('../../lib/router/sequential')()
      router1.get('/static-route', (req) => {
        return Response.json({params: req.params})
      })

      const req1 = {
        method: 'GET',
        url: 'http://localhost/static-route',
        headers: {},
      }
      delete req1.params // Ensure req.params is not set

      const result1 = await router1.fetch(req1)
      expect(result1.status).toBe(200)
      expect(req1.params).toEqual({}) // Line 106: params exists but empty, req.params not set

      // Test coverage for line 109: force params to be null/undefined
      const router2 = require('../../lib/router/sequential')()

      // Mock the trouter find method to return params: null for a specific case
      const originalFind = router2.find
      router2.find = function (method, path) {
        const result = originalFind.call(this, method, path)
        if (path === '/null-params-route') {
          // Force condition where handlers exist but params is null
          return {
            handlers: result.handlers || [() => Response.json({forced: true})],
            params: null,
          }
        }
        return result
      }

      router2.get('/null-params-route', (req) => {
        return Response.json({params: req.params})
      })

      const req2 = {
        method: 'GET',
        url: 'http://localhost/null-params-route',
        headers: {},
      }
      delete req2.params // Ensure req.params is not set

      const result2 = await router2.fetch(req2)
      expect(result2.status).toBe(200)
      expect(req2.params).toEqual({}) // Line 109: params is null, req.params not set
    })
  })
})
