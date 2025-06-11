/* global describe, it, expect, beforeEach, afterEach, jest */

const {
  logger,
  jwtAuth,
  rateLimit,
  cors,
  bodyParser,
} = require('../../lib/middleware')
const {createTestRequest} = require('../helpers')

describe('Middleware Integration Tests', () => {
  let req, next, mockLog

  beforeEach(() => {
    mockLog = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => mockLog),
    }
    next = jest.fn(() => new Response('Success'))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Middleware Chain Execution', () => {
    it('should execute middleware chain in order', async () => {
      const executionOrder = []

      const middleware1 = (req, next) => {
        executionOrder.push('middleware1-start')
        const response = next()
        executionOrder.push('middleware1-end')
        return response
      }

      const middleware2 = (req, next) => {
        executionOrder.push('middleware2-start')
        const response = next()
        executionOrder.push('middleware2-end')
        return response
      }

      const middleware3 = (req, next) => {
        executionOrder.push('middleware3-start')
        const response = next()
        executionOrder.push('middleware3-end')
        return response
      }

      req = createTestRequest('GET', '/test')

      // Chain middleware execution
      await middleware1(req, () =>
        middleware2(req, () => middleware3(req, next)),
      )

      expect(executionOrder).toEqual([
        'middleware1-start',
        'middleware2-start',
        'middleware3-start',
        'middleware3-end',
        'middleware2-end',
        'middleware1-end',
      ])
    })
  })

  describe('Logger + JWT Authentication', () => {
    it('should log authenticated requests', async () => {
      req = createTestRequest('GET', '/protected')
      req.headers = new Headers({
        Authorization: 'Bearer valid.jwt.token',
      })

      const loggerMiddleware = logger({logger: mockLog})

      // Mock JWT validation to pass
      const jwtMiddleware = jwtAuth({
        secret: 'test-secret',
        algorithms: ['HS256'],
        optional: true, // For testing purposes
      })

      // Simulate middleware chain
      await loggerMiddleware(req, () => jwtMiddleware(req, next))

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request started',
          method: 'GET',
          url: '/protected',
        }),
      )

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request completed',
          status: 200,
        }),
      )
    })

    it('should log authentication failures', async () => {
      req = createTestRequest('GET', '/protected')
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const loggerMiddleware = logger({logger: mockLog})
      const jwtMiddleware = jwtAuth({
        secret: 'test-secret',
        algorithms: ['HS256'],
      })

      const response = await loggerMiddleware(req, () =>
        jwtMiddleware(req, next),
      )

      expect(response.status).toBe(401)
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request completed',
          status: 401,
        }),
      )
    })
  })

  describe('Rate Limiting + Authentication', () => {
    it('should rate limit per authenticated user', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: (req) =>
          req.user?.sub || req.socket?.remoteAddress || 'anonymous',
      })

      const jwtMiddleware = jwtAuth({
        secret: 'test-secret',
        algorithms: ['HS256'],
        optional: true,
      })

      // Simulate user1
      req = createTestRequest('GET', '/api/data')
      req.user = {sub: 'user1'}
      req.socket = {remoteAddress: '127.0.0.1'}

      // First two requests should pass
      for (let i = 0; i < 2; i++) {
        const response = await rateLimitMiddleware(req, () =>
          jwtMiddleware(req, next),
        )
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }

      // Third request should be rate limited
      const response = await rateLimitMiddleware(req, () =>
        jwtMiddleware(req, next),
      )
      expect(response.status).toBe(429)

      // Different user should still be allowed
      req.user = {sub: 'user2'}
      const user2Response = await rateLimitMiddleware(req, () =>
        jwtMiddleware(req, next),
      )
      expect(user2Response.status).toBe(200)
    })
  })

  describe('CORS + Body Parser', () => {
    it('should handle CORS preflight for POST request with JSON body', async () => {
      req = createTestRequest('OPTIONS', '/api/users')
      req.headers = new Headers({
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      })

      const corsMiddleware = cors({
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
      })

      const bodyParserMiddleware = bodyParser()

      const response = await corsMiddleware(req, () =>
        bodyParserMiddleware(req, next),
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'POST',
      )
      expect(next).not.toHaveBeenCalled() // Preflight should not reach the handler
    })

    it('should parse body and add CORS headers for actual request', async () => {
      const jsonData = {name: 'John', email: 'john@example.com'}
      req = createTestRequest('POST', '/api/users', {
        headers: {
          Origin: 'https://example.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      })

      const corsMiddleware = cors({
        origin: 'https://example.com',
      })

      const bodyParserMiddleware = bodyParser()

      const response = await corsMiddleware(req, () =>
        bodyParserMiddleware(req, next),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com',
      )
      expect(req.body).toEqual(jsonData)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Full Stack Integration', () => {
    it('should handle complete request lifecycle with all middleware', async () => {
      const jsonData = {message: 'Hello World'}
      req = createTestRequest('POST', '/api/messages', {
        headers: {
          Origin: 'https://app.example.com',
          'Content-Type': 'application/json',
          Authorization: 'Bearer test.jwt.token',
        },
        body: JSON.stringify(jsonData),
      })
      req.socket = {remoteAddress: '192.168.1.100'}

      // Set up all middleware
      const loggerMiddleware = logger({logger: mockLog})
      const corsMiddleware = cors({
        origin: 'https://app.example.com',
        credentials: true,
      })
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        max: 10,
      })
      const bodyParserMiddleware = bodyParser()
      const jwtMiddleware = jwtAuth({
        secret: 'test-secret',
        algorithms: ['HS256'],
        optional: true, // For testing
      })

      // Execute middleware chain
      const response = await loggerMiddleware(req, () =>
        corsMiddleware(req, () =>
          rateLimitMiddleware(req, () =>
            bodyParserMiddleware(req, () => jwtMiddleware(req, next)),
          ),
        ),
      )

      // Verify response
      expect(response.status).toBe(200)

      // Verify CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com',
      )
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true',
      )

      // Verify rate limiting headers
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')

      // Verify body parsing
      expect(req.body).toEqual(jsonData)

      // Verify rate limiting context
      expect(req.rateLimit).toBeDefined()
      expect(req.rateLimit.current).toBe(1)

      // Verify logging
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request started',
          method: 'POST',
          url: '/api/messages',
        }),
      )

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request completed',
          status: 200,
          duration: expect.any(Number),
        }),
      )
    })
  })

  describe('Error Handling Across Middleware', () => {
    it('should handle errors in middleware chain', async () => {
      req = createTestRequest('POST', '/api/data')

      const errorMiddleware = (req, next) => {
        throw new Error('Middleware error')
      }

      const loggerMiddleware = logger({logger: mockLog})

      try {
        await loggerMiddleware(req, () => errorMiddleware(req, next))
      } catch (error) {
        expect(error.message).toBe('Middleware error')
      }

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request failed',
          error: 'Middleware error',
        }),
      )
    })

    it('should handle body parser errors with logging', async () => {
      req = createTestRequest('POST', '/api/data', {
        headers: {'Content-Type': 'application/json'},
        body: '{invalid json}',
      })

      const loggerMiddleware = logger({logger: mockLog})
      const bodyParserMiddleware = bodyParser()

      const response = await loggerMiddleware(req, () =>
        bodyParserMiddleware(req, next),
      )

      expect(response.status).toBe(400)
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Request completed',
          status: 400,
        }),
      )
    })
  })

  describe('Middleware Context Sharing', () => {
    it('should share context between middleware', async () => {
      req = createTestRequest('GET', '/api/test')
      req.socket = {remoteAddress: '127.0.0.1'}

      const middleware1 = (req, next) => {
        req.customContext = {step: 1}
        return next()
      }

      const middleware2 = (req, next) => {
        req.customContext.step = 2
        req.customContext.processed = true
        return next()
      }

      const loggerMiddleware = logger({logger: mockLog})

      next = jest.fn(() => {
        expect(req.customContext).toEqual({
          step: 2,
          processed: true,
        })
        return new Response('Success')
      })

      await loggerMiddleware(req, () =>
        middleware1(req, () => middleware2(req, next)),
      )

      expect(next).toHaveBeenCalled()
      expect(req.log).toBeDefined() // Logger context
      expect(req.requestId).toBeDefined() // Request ID from logger
      expect(req.customContext.processed).toBe(true) // Custom context preserved
    })
  })

  describe('Performance Impact', () => {
    it('should measure performance impact of middleware chain', async () => {
      req = createTestRequest('POST', '/api/perf', {
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: '{"test": true}',
      })
      req.socket = {remoteAddress: '127.0.0.1'}

      const loggerMiddleware = logger({logger: mockLog})
      const corsMiddleware = cors({origin: 'https://example.com'})
      const rateLimitMiddleware = rateLimit({windowMs: 60000, max: 100})
      const bodyParserMiddleware = bodyParser()

      const startTime = performance.now()

      await loggerMiddleware(req, () =>
        corsMiddleware(req, () =>
          rateLimitMiddleware(req, () => bodyParserMiddleware(req, next)),
        ),
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly (under 100ms for simple test)
      expect(duration).toBeLessThan(100)

      // Verify all middleware executed
      expect(req.body).toEqual({test: true})
      expect(req.rateLimit).toBeDefined()
      expect(req.log).toBeDefined()
    })
  })
})
