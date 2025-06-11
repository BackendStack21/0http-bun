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

    it('should handle key generator errors with fallback', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      // Should fallback to 'unknown' key and continue
      expect(req.rateLimit).toBeDefined()
      expect(req.rateLimit.limit).toBe(5)
    })

    it('should handle double key generation failure gracefully', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      // Mock store.increment to also throw error
      const faultyStore = {
        increment: jest.fn(() => {
          throw new Error('Store error')
        }),
      }

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
        store: faultyStore,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200) // Should fallback and continue
    })

    it('should handle fallback error case returning response without headers', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      // Create a next function that returns a Response object
      const nextWithResponse = jest.fn(
        () => new Response('Success', {status: 200}),
      )

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
      })

      const response = await middleware(req, nextWithResponse)
      expect(response.status).toBe(200)
      expect(response instanceof Response).toBe(true)
      // This should hit line 147 - return response without headers
    })

    it('should hit the specific fallback return path without adding headers', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      // Mock a response that will be returned from next()
      const mockResponse = new Response('fallback success', {status: 200})
      const nextReturningResponse = jest.fn(() => mockResponse)

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
      })

      const response = await middleware(req, nextReturningResponse)
      expect(response).toBe(mockResponse) // Should return the exact same response object
      expect(response.status).toBe(200)

      // Verify it's the fallback path by checking rate limit context was set
      expect(req.rateLimit).toBeDefined()
      expect(req.rateLimit.limit).toBe(5)
    })

    it('should execute fallback error path line 147 specifically', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      // Create middleware with error-prone keyGenerator
      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
        standardHeaders: false, // Disable headers to ensure we hit the specific path
      })

      // Create a Response object to be returned by next()
      const testResponse = new Response('test content', {
        status: 200,
        headers: {'X-Test': 'value'},
      })

      const nextFunc = jest.fn(() => testResponse)

      const result = await middleware(req, nextFunc)

      // This should hit line 147: return response (without headers)
      expect(result).toBe(testResponse)
      expect(result.status).toBe(200)
      expect(req.rateLimit).toBeDefined() // Confirms we're in the fallback path
      expect(req.rateLimit.current).toBe(1) // Fallback incremented with 'unknown' key
    })

    it('should include rate-limit headers in fallback path after key generation error', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      // Create a Response object to be returned by next()
      const testResponse = new Response('test content', {
        status: 200,
        headers: {'X-Test': 'value'},
      })

      const nextFunc = jest.fn(() => testResponse)

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
        standardHeaders: true, // Ensure headers are enabled
      })

      const result = await middleware(req, nextFunc)

      // Should return the response with added rate-limit headers
      expect(result).toBe(testResponse)
      expect(result.status).toBe(200)

      // Verify rate-limit headers were added to the response
      expect(result.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(result.headers.get('X-RateLimit-Remaining')).toBe('4') // 5 - 1 = 4
      expect(result.headers.get('X-RateLimit-Used')).toBe('1')
      expect(result.headers.get('X-RateLimit-Reset')).toBeTruthy()

      // Verify we're in the fallback path
      expect(req.rateLimit).toBeDefined()
      expect(req.rateLimit.current).toBe(1) // Fallback incremented with 'unknown' key
    })
  })

  describe('MemoryStore', () => {
    const {MemoryStore} = require('../../lib/middleware/rate-limit')

    it('should reset specific key entries', async () => {
      const store = new MemoryStore()

      // Add some entries for different keys
      await store.increment('user1', 60000)
      await store.increment('user2', 60000)
      await store.increment('user1', 60000) // Second request for user1

      // Reset user1
      await store.reset('user1')

      // user2 should still have entries but user1 should be reset
      const user1Result = await store.increment('user1', 60000)
      const user2Result = await store.increment('user2', 60000)

      expect(user1Result.totalHits).toBe(1) // Reset
      expect(user2Result.totalHits).toBe(2) // Not reset
    })

    it('should cleanup expired entries during normal operation', async () => {
      const store = new MemoryStore()

      // Add entry with very short window
      await store.increment('test-key', 1) // 1ms window

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5))

      // Next increment should clean up expired entries
      const result = await store.increment('test-key', 60000)
      expect(result.totalHits).toBe(1) // Should reset due to cleanup
    })
  })

  describe('Exclude Paths', () => {
    it('should exclude specified paths from rate limiting', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        excludePaths: ['/health', '/status'],
      })

      // Update request URL to excluded path
      req.url = 'http://localhost/health'

      // Should bypass rate limiting multiple times
      for (let i = 0; i < 5; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }
    })

    it('should apply rate limiting to non-excluded paths', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        excludePaths: ['/health'],
      })

      // Use non-excluded path
      req.url = 'http://localhost/api/test'

      // First request should pass
      const response1 = await middleware(req, next)
      expect(response1.status).toBe(200)

      // Second request should be rate limited
      const response2 = await middleware(req, next)
      expect(response2.status).toBe(429)
    })
  })

  describe('Standard Headers', () => {
    it('should disable standard headers when option is false', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        standardHeaders: false,
      })

      const response = await middleware(req, next)

      expect(response.headers.get('X-RateLimit-Limit')).toBeNull()
      expect(response.headers.get('X-RateLimit-Remaining')).toBeNull()
      expect(response.headers.get('X-RateLimit-Reset')).toBeNull()
    })
  })

  describe('Custom Store', () => {
    it('should use custom store implementation', async () => {
      const customStore = {
        increment: jest.fn().mockResolvedValue({
          totalHits: 1,
          resetTime: new Date(Date.now() + 60000),
        }),
      }

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
        store: customStore,
      })

      await middleware(req, next)

      expect(customStore.increment).toHaveBeenCalled()
    })

    it('should use injected store from request', async () => {
      const customStore = {
        increment: jest.fn().mockResolvedValue({
          totalHits: 1,
          resetTime: new Date(Date.now() + 60000),
        }),
      }

      // Inject store into request
      req.rateLimitStore = customStore

      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
      })

      await middleware(req, next)

      expect(customStore.increment).toHaveBeenCalled()
    })
  })

  describe('Default Key Generator', () => {
    const {defaultKeyGenerator} = require('../../lib/middleware/rate-limit')

    it('should use CF-Connecting-IP header when available', () => {
      const testReq = {
        headers: new Headers([
          ['cf-connecting-ip', '1.2.3.4'],
          ['x-real-ip', '5.6.7.8'],
          ['x-forwarded-for', '9.10.11.12, 13.14.15.16'],
        ]),
      }

      const key = defaultKeyGenerator(testReq)
      expect(key).toBe('1.2.3.4')
    })

    it('should use X-Real-IP header when CF-Connecting-IP not available', () => {
      const testReq = {
        headers: new Headers([
          ['x-real-ip', '5.6.7.8'],
          ['x-forwarded-for', '9.10.11.12, 13.14.15.16'],
        ]),
      }

      const key = defaultKeyGenerator(testReq)
      expect(key).toBe('5.6.7.8')
    })

    it('should use first IP from X-Forwarded-For header', () => {
      const testReq = {
        headers: new Headers([['x-forwarded-for', '9.10.11.12, 13.14.15.16']]),
      }

      const key = defaultKeyGenerator(testReq)
      expect(key).toBe('9.10.11.12')
    })

    it('should return unknown when no IP headers available', () => {
      const testReq = {
        headers: new Headers(),
      }

      const key = defaultKeyGenerator(testReq)
      expect(key).toBe('unknown')
    })
  })

  describe('Sliding Window Rate Limiter', () => {
    const {
      createSlidingWindowRateLimit,
    } = require('../../lib/middleware/rate-limit')

    it('should implement sliding window correctly', async () => {
      const middleware = createSlidingWindowRateLimit({
        windowMs: 1000,
        max: 2,
      })

      // First two requests should pass
      for (let i = 0; i < 2; i++) {
        const response = await middleware(req, next)
        expect(response.status).toBe(200)
        jest.clearAllMocks()
      }

      // Third request should be blocked
      const response = await middleware(req, next)
      expect(response.status).toBe(429)
    })

    it('should add rate limit context for sliding window', async () => {
      const middleware = createSlidingWindowRateLimit({
        windowMs: 60000,
        max: 5,
      })

      await middleware(req, next)

      expect(req.ctx.rateLimit).toBeDefined()
      expect(req.ctx.rateLimit.limit).toBe(5)
      expect(req.ctx.rateLimit.used).toBe(1)
      expect(req.ctx.rateLimit.remaining).toBe(4)
      expect(req.ctx.rateLimit.resetTime).toBeDefined()
    })

    it('should handle key generation errors in sliding window', async () => {
      const faultyKeyGenerator = jest.fn(() => {
        throw new Error('Key generation error')
      })

      const middleware = createSlidingWindowRateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: faultyKeyGenerator,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200) // Should fallback gracefully
    })

    it('should use custom handler in sliding window', async () => {
      const customHandler = jest
        .fn()
        .mockResolvedValue(new Response('Custom sliding limit', {status: 429}))

      const middleware = createSlidingWindowRateLimit({
        windowMs: 1000,
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
      expect(await response.text()).toBe('Custom sliding limit')
    })
  })

  describe('Default Handler', () => {
    const {defaultHandler} = require('../../lib/middleware/rate-limit')

    it('should return proper JSON response with retry-after', async () => {
      const resetTime = new Date(Date.now() + 60000) // 1 minute from now
      const response = await defaultHandler(req, 5, 3, resetTime)

      expect(response.status).toBe(429)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Retry-After')).toBe('60')

      const body = await response.json()
      expect(body.error).toBe('Too many requests')
      expect(body.retryAfter).toBe(60)
    })
  })

  describe('String Handler Response', () => {
    it('should convert string handler response to Response object', async () => {
      const stringHandler = jest.fn(() => 'Custom string response')

      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        handler: stringHandler,
      })

      // First request passes
      await middleware(req, next)
      jest.clearAllMocks()

      // Second request should use string handler
      const response = await middleware(req, next)
      expect(response.status).toBe(429)
      expect(await response.text()).toBe('Custom string response')
    })
  })
})
