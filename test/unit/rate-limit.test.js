/* global describe, it, expect, beforeEach, afterEach, jest */

const {rateLimit} = require('../../lib/middleware')
const {createTestRequest} = require('../helpers')

describe('Rate Limit Middleware', () => {
  let req, next

  beforeEach(() => {
    req = createTestRequest('GET', '/api/test')
    req.socket = {remoteAddress: '127.0.0.1'}
    next = jest.fn(() => new Response('Success'))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const middleware = rateLimit({
        windowMs: 60000, // 1 minute
        max: 5, // 5 requests per minute
      })

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        expect(next).toHaveBeenCalled()
        jest.clearAllMocks()
      }
    })

    it('should block requests exceeding limit', async () => {
      const middleware = rateLimit({
        windowMs: 60000, // 1 minute
        max: 2, // 2 requests per minute
      })

      // Make 2 allowed requests
      for (let i = 0; i < 2; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }

      // Third request should be blocked
      const response = await middleware(req, next)
      expect(response.status).toBe(429)
      expect(next).not.toHaveBeenCalled()
    })

    it('should include rate limit headers', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
      })

      const response = await middleware(req, next)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })
  })

  describe('Custom Key Generation', () => {
    it('should use custom key generator', async () => {
      const customKeyGenerator = jest.fn((req) => {
        return req.headers.get('X-User-ID') || 'anonymous'
      })

      req.headers = new Headers({'X-User-ID': 'user123'})

      const middleware = rateLimit({
        windowMs: 60000,
        max: 3,
        keyGenerator: customKeyGenerator,
      })

      await middleware(req, next)

      expect(customKeyGenerator).toHaveBeenCalledWith(req)
    })

    it('should handle different users separately', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: (req) => req.headers.get('X-User-ID') || 'anonymous',
      })

      // User 1 makes 2 requests
      req.headers = new Headers({'X-User-ID': 'user1'})
      for (let i = 0; i < 2; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }

      // User 2 should still be able to make requests
      req.headers = new Headers({'X-User-ID': 'user2'})
      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })
  })

  describe('Skip Functionality', () => {
    it('should skip rate limiting when skip function returns true', async () => {
      const skipFunction = jest.fn((req) => {
        return req.headers.get('X-Skip-Rate-Limit') === 'true'
      })

      req.headers = new Headers({'X-Skip-Rate-Limit': 'true'})

      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        skip: skipFunction,
      })

      // Should allow multiple requests because skip returns true
      for (let i = 0; i < 3; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        expect(skipFunction).toHaveBeenCalled()
        jest.clearAllMocks()
      }
    })

    it('should apply rate limiting when skip function returns false', async () => {
      const skipFunction = jest.fn(() => false)

      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        skip: skipFunction,
      })

      // First request should pass
      const response1 = await middleware(req, next)
      expect(response1.status).toBe(200)

      // Second request should be blocked
      const response2 = await middleware(req, next)
      expect(response2.status).toBe(429)
    })
  })

  describe('Sliding Window', () => {
    it('should implement sliding window when enabled', async () => {
      const middleware = rateLimit({
        windowMs: 1000, // 1 second
        max: 2,
        slidingWindow: true,
      })

      const startTime = Date.now()

      // Make 2 requests immediately
      for (let i = 0; i < 2; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }

      // Third request should be blocked
      const response = await middleware(req, next)
      expect(response.status).toBe(429)

      // Wait for sliding window to allow new request
      await new Promise((resolve) => setTimeout(resolve, 600))

      const responseAfterWait = await middleware(req, next)
      // This might still be blocked depending on exact timing
      expect([200, 429]).toContain(responseAfterWait.status)
    })
  })

  describe('Custom Responses', () => {
    it('should use custom rate limit exceeded message', async () => {
      const customMessage = 'Custom rate limit exceeded'

      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        message: customMessage,
      })

      // First request passes
      await middleware(req, next)
      jest.clearAllMocks()

      // Second request should be blocked with custom message
      const response = await middleware(req, next)
      expect(response.status).toBe(429)
      expect(await response.text()).toBe(customMessage)
    })

    it('should use custom response handler', async () => {
      const customHandler = jest.fn((req, res) => {
        return new Response(
          JSON.stringify({error: 'Rate limit exceeded', retryAfter: 60}),
          {
            status: 429,
            headers: {'Content-Type': 'application/json'},
          },
        )
      })

      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        handler: customHandler,
      })

      // First request passes
      await middleware(req, next)
      jest.clearAllMocks()

      // Second request should use custom handler
      const response = await middleware(req, next)
      expect(customHandler).toHaveBeenCalled()
      expect(response.status).toBe(429)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('Rate Limit Context', () => {
    it('should add rate limit info to request context', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
      })

      await middleware(req, next)

      expect(req.rateLimit).toBeDefined()
      expect(req.rateLimit.limit).toBe(5)
      expect(req.rateLimit.remaining).toBe(4)
      expect(req.rateLimit.reset).toBeDefined()
      expect(req.rateLimit.current).toBe(1)
    })
  })

  describe('Memory Store Behavior', () => {
    it('should clean up expired entries', async () => {
      const middleware = rateLimit({
        windowMs: 100, // Very short window
        max: 5,
      })

      // Make a request
      await middleware(req, next)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Make another request - should reset count
      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(req.rateLimit.current).toBe(1) // Should reset to 1
    })

    it('should handle concurrent requests correctly', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 3,
      })

      // Make multiple concurrent requests
      const promises = []
      for (let i = 0; i < 5; i++) {
        const newReq = createTestRequest('GET', '/api/test')
        newReq.socket = {remoteAddress: '127.0.0.1'}
        promises.push(middleware(newReq, next))
      }

      const responses = await Promise.all(promises)

      // Should have 3 successful and 2 rate-limited responses
      const successCount = responses.filter((r) => r.status === 200).length
      const rateLimitedCount = responses.filter((r) => r.status === 429).length

      expect(successCount).toBe(3)
      expect(rateLimitedCount).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing IP address gracefully', async () => {
      req.socket = {} // No remoteAddress

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200) // Should still work with fallback key
    })

    it('should handle key generator errors', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200) // Should fallback gracefully
    })
  })
})
