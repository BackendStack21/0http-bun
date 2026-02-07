/* global describe, it, expect, beforeEach, afterEach, jest */

const {cors} = require('../../lib/middleware')
const {createTestRequest} = require('../helpers')

describe('CORS Middleware', () => {
  let req, next

  beforeEach(() => {
    req = createTestRequest('GET', '/api/test')
    next = jest.fn(() => new Response('Success'))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic CORS Headers', () => {
    it('should add default CORS headers', async () => {
      const middleware = cors()

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'GET',
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
        'Content-Type',
      )
      expect(next).toHaveBeenCalled()
    })

    it('should set specific origin when configured', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: 'https://example.com',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
    })

    it('should set multiple origins when array provided', async () => {
      req.headers = new Headers({Origin: 'https://app.example.com'})

      const middleware = cors({
        origin: ['https://example.com', 'https://app.example.com'],
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com',
      )
    })

    it('should reject disallowed origins', async () => {
      req.headers = new Headers({Origin: 'https://evil.com'})

      const middleware = cors({
        origin: ['https://example.com', 'https://app.example.com'],
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      expect(next).toHaveBeenCalled() // Still processes request but without CORS headers
    })
  })

  describe('Dynamic Origin Validation', () => {
    it('should use function to validate origin', async () => {
      req.headers = new Headers({Origin: 'https://dynamic.example.com'})

      const originValidator = jest.fn((origin) => {
        return origin.endsWith('.example.com')
      })

      const middleware = cors({
        origin: originValidator,
      })

      const response = await middleware(req, next)

      expect(originValidator).toHaveBeenCalledWith(
        'https://dynamic.example.com',
      )
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://dynamic.example.com',
      )
    })

    it('should reject origin when validator returns false', async () => {
      req.headers = new Headers({Origin: 'https://invalid.com'})

      const originValidator = jest.fn((origin) => {
        return origin.endsWith('.example.com')
      })

      const middleware = cors({
        origin: originValidator,
      })

      const response = await middleware(req, next)

      expect(originValidator).toHaveBeenCalledWith('https://invalid.com')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('Preflight Requests', () => {
    it('should handle OPTIONS preflight request', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      })

      const middleware = cors({
        origin: 'https://example.com',
        methods: ['GET', 'POST', 'PUT'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'POST',
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
        'Authorization',
      )
      expect(next).not.toHaveBeenCalled() // Preflight should not call next
    })

    it('should set maxAge for preflight cache', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      const middleware = cors({
        origin: 'https://example.com',
        maxAge: 3600,
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Max-Age')).toBe('3600')
    })

    it('should reject preflight for disallowed method', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'DELETE',
      })

      const middleware = cors({
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(404) // Should return 404 for disallowed methods
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject preflight for disallowed headers', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-Custom-Header',
      })

      const middleware = cors({
        origin: 'https://example.com',
        allowedHeaders: ['Content-Type', 'Authorization'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(404)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Credentials Support', () => {
    it('should include credentials header when enabled', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: 'https://example.com',
        credentials: true,
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true',
      )
    })

    it('should not include credentials header when disabled', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: 'https://example.com',
        credentials: false,
      })

      const response = await middleware(req, next)

      expect(
        response.headers.get('Access-Control-Allow-Credentials'),
      ).toBeNull()
    })

    it('should not allow wildcard origin with credentials', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: '*',
        credentials: true,
      })

      const response = await middleware(req, next)

      // Should either reject or not set credentials with wildcard
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin')
      const allowCredentials = response.headers.get(
        'Access-Control-Allow-Credentials',
      )

      // Either origin should not be wildcard OR credentials should not be set
      expect(allowOrigin === '*' && allowCredentials === 'true').toBe(false)
    })
  })

  describe('Exposed Headers', () => {
    it('should expose specified headers', async () => {
      const middleware = cors({
        exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Expose-Headers')).toContain(
        'X-Total-Count',
      )
      expect(response.headers.get('Access-Control-Expose-Headers')).toContain(
        'X-Page-Number',
      )
    })

    it('should handle string and array for exposed headers', async () => {
      const middleware = cors({
        exposedHeaders: 'X-Custom-Header',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Expose-Headers')).toBe(
        'X-Custom-Header',
      )
    })
  })

  describe('Custom Configurations', () => {
    it('should allow custom methods', async () => {
      const middleware = cors({
        methods: ['GET', 'POST', 'PATCH'],
      })

      const response = await middleware(req, next)

      const allowedMethods = response.headers.get(
        'Access-Control-Allow-Methods',
      )
      expect(allowedMethods).toContain('PATCH')
      expect(allowedMethods).not.toContain('DELETE')
    })

    it('should allow custom headers', async () => {
      const middleware = cors({
        allowedHeaders: ['Content-Type', 'X-Custom-Header'],
      })

      const response = await middleware(req, next)

      const allowedHeaders = response.headers.get(
        'Access-Control-Allow-Headers',
      )
      expect(allowedHeaders).toContain('X-Custom-Header')
    })

    it('should handle function for allowed headers', async () => {
      req.headers = new Headers({
        'Access-Control-Request-Headers': 'Content-Type, X-Dynamic-Header',
      })

      const headersFunction = jest.fn((req) => {
        const requested = req.headers.get('Access-Control-Request-Headers')
        return requested ? requested.split(', ') : []
      })

      const middleware = cors({
        allowedHeaders: headersFunction,
      })

      const response = await middleware(req, next)

      expect(headersFunction).toHaveBeenCalledWith(req)
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
        'X-Dynamic-Header',
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle missing origin header gracefully', async () => {
      const middleware = cors({
        origin: ['https://example.com'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(next).toHaveBeenCalled()
    })

    it('should handle invalid origin gracefully', async () => {
      req.headers = new Headers({Origin: 'invalid-origin'})

      const middleware = cors({
        origin: (origin) => {
          try {
            new URL(origin)
            return true
          } catch {
            return false
          }
        },
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Response Header Preservation', () => {
    it('should preserve existing response headers', async () => {
      next = jest.fn(() => {
        const response = new Response('Success')
        response.headers.set('X-Custom-Header', 'custom-value')
        return response
      })

      const middleware = cors()

      const response = await middleware(req, next)

      expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('should not override existing CORS headers in response', async () => {
      next = jest.fn(() => {
        const response = new Response('Success')
        response.headers.set(
          'Access-Control-Allow-Origin',
          'https://custom.com',
        )
        return response
      })

      const middleware = cors({
        origin: 'https://example.com',
      })

      const response = await middleware(req, next)

      // Should preserve the existing CORS header from the response
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://custom.com',
      )
    })
  })

  describe('Vary Header', () => {
    it('should add Vary: Origin header when origin is dynamic', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: (origin) => origin.endsWith('.example.com'),
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Vary')).toContain('Origin')
    })

    it('should preserve existing Vary header', async () => {
      next = jest.fn(() => {
        const response = new Response('Success')
        response.headers.set('Vary', 'Accept-Encoding')
        return response
      })

      const middleware = cors({
        origin: (origin) => true,
      })

      const response = await middleware(req, next)

      const varyHeader = response.headers.get('Vary')
      expect(varyHeader).toContain('Accept-Encoding')
      expect(varyHeader).toContain('Origin')
    })
  })

  describe('Edge Cases and Complete Coverage', () => {
    it('should handle string exposedHeaders correctly', async () => {
      const middleware = cors({
        exposedHeaders: 'X-Single-Header',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Expose-Headers')).toBe(
        'X-Single-Header',
      )
    })

    it('should handle non-array methods configuration', async () => {
      const middleware = cors({
        methods: 'GET',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET')
    })

    it('should handle non-array allowedHeaders configuration', async () => {
      const middleware = cors({
        allowedHeaders: 'Content-Type',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type',
      )
    })

    it('should handle preflightContinue option', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      let nextCalled = false
      next = jest.fn(() => {
        nextCalled = true
        return new Response('Custom Response')
      })

      const middleware = cors({
        origin: 'https://example.com',
        preflightContinue: true,
      })

      const response = await middleware(req, next)

      expect(nextCalled).toBe(true)
      expect(next).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
    })

    it('should handle origin set to false', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const middleware = cors({
        origin: false,
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should handle origin function returning specific origin string', async () => {
      req.headers = new Headers({Origin: 'https://dynamic.example.com'})

      const originValidator = jest.fn((origin) => {
        return 'https://allowed.example.com'
      })

      const middleware = cors({
        origin: originValidator,
      })

      const response = await middleware(req, next)

      expect(originValidator).toHaveBeenCalledWith(
        'https://dynamic.example.com',
      )
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://allowed.example.com',
      )
    })

    it('should handle simpleCORS middleware', async () => {
      const {simpleCORS} = require('../../lib/middleware/cors')
      const middleware = simpleCORS()

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'OPTIONS',
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('*')
    })

    it('should handle getAllowedOrigin with invalid origin type', async () => {
      const {getAllowedOrigin} = require('../../lib/middleware/cors')

      const result = getAllowedOrigin(123, 'https://example.com', req)
      expect(result).toBe(false)
    })

    it('should handle async preflightContinue', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      next = jest.fn(() => Promise.resolve(new Response('Async Response')))

      const middleware = cors({
        origin: 'https://example.com',
        preflightContinue: true,
      })

      const response = await middleware(req, next)

      expect(next).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
    })

    it('should handle async regular requests', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      next = jest.fn(() => Promise.resolve(new Response('Async Response')))

      const middleware = cors({
        origin: 'https://example.com',
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
    })

    it('should handle non-array methods in OPTIONS preflight', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      })

      const middleware = cors({
        origin: 'https://example.com',
        methods: 'GET', // Non-array methods
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET')
      expect(next).not.toHaveBeenCalled()
    })

    it('should set Vary header in OPTIONS preflight with dynamic origin', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      const originValidator = jest.fn(() => true)

      const middleware = cors({
        origin: originValidator, // Function origin triggers Vary header
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(response.headers.get('Vary')).toBe('Origin')
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle exposedHeaders as neither array nor string', async () => {
      const middleware = cors({
        exposedHeaders: null, // Neither array nor string
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Expose-Headers')).toBeNull()
    })

    it('should handle allowedHeaders function returning neither array nor string', async () => {
      const headersFunction = jest.fn(() => null) // Function returning null

      const middleware = cors({
        allowedHeaders: headersFunction,
      })

      const response = await middleware(req, next)

      expect(headersFunction).toHaveBeenCalledWith(req)
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('')
    })

    it('should handle allowedHeaders function returning string in OPTIONS preflight', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      const headersFunction = jest.fn(() => 'Content-Type') // Function returning string

      const middleware = cors({
        origin: 'https://example.com',
        allowedHeaders: headersFunction,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(headersFunction).toHaveBeenCalledWith(req)
      // I-2: string return values are now correctly handled as single-element arrays
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type',
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle OPTIONS preflight with origin false', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      })

      const middleware = cors({
        origin: false, // Explicitly set to false
        credentials: true,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      // Should not leak CORS policy headers to disallowed origins
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull()
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeNull()
      expect(response.headers.get('Access-Control-Max-Age')).toBeNull()
      expect(
        response.headers.get('Access-Control-Allow-Credentials'),
      ).toBeNull()
      expect(next).not.toHaveBeenCalled()
    })

    it('should not leak CORS headers in preflight for rejected origins', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://evil.com',
        'Access-Control-Request-Method': 'POST',
      })

      const middleware = cors({
        origin: ['https://trusted.com'],
        credentials: true,
        maxAge: 3600,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull()
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeNull()
      expect(response.headers.get('Access-Control-Max-Age')).toBeNull()
      expect(
        response.headers.get('Access-Control-Allow-Credentials'),
      ).toBeNull()
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle string resolvedAllowedHeaders case', async () => {
      const middleware = cors({
        allowedHeaders: 'Content-Type, Authorization', // String type allowedHeaders
      })

      const response = await middleware(req, next)

      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization',
      )
    })
  })

  describe('Preflight allowedHeaders Function Caching (I-2)', () => {
    it('should call allowedHeaders function only once during preflight', async () => {
      req = createTestRequest('OPTIONS', '/api/test')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      })

      const headersFunction = jest.fn(() => ['Content-Type', 'Authorization'])

      const middleware = cors({
        origin: 'https://example.com',
        allowedHeaders: headersFunction,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(204)
      // I-2: should be called exactly once, not 3 times
      expect(headersFunction).toHaveBeenCalledTimes(1)
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization',
      )
    })

    it('should still call allowedHeaders function for non-preflight requests', async () => {
      req.headers = new Headers({Origin: 'https://example.com'})

      const headersFunction = jest.fn(() => ['Content-Type'])

      const middleware = cors({
        origin: 'https://example.com',
        allowedHeaders: headersFunction,
      })

      const response = await middleware(req, next)

      expect(headersFunction).toHaveBeenCalledTimes(1)
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type',
      )
    })
  })
})
