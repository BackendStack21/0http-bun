/* global describe, it, expect, beforeEach, afterEach, jest */

const {
  logger,
  jwtAuth,
  rateLimit,
  cors,
  bodyParser,
} = require('../../lib/middleware')
const {createTestRequest} = require('../helpers')

describe('Middleware Performance Tests', () => {
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

  describe('Logger Performance', () => {
    it('should handle high-frequency logging efficiently', async () => {
      const middleware = logger({logger: mockLog})
      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('GET', `/test/${i}`)
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations

      console.log(
        `Logger: ${iterations} requests in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Should average less than 1ms per request
      expect(avgTimePerRequest).toBeLessThan(1)
    })

    it('should handle concurrent logging requests', async () => {
      const middleware = logger({logger: mockLog})
      const concurrentRequests = 100
      const startTime = performance.now()

      const promises = Array.from({length: concurrentRequests}, (_, i) => {
        const req = createTestRequest('GET', `/concurrent/${i}`)
        return middleware(req, next)
      })

      await Promise.all(promises)

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(
        `Logger Concurrent: ${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms`,
      )

      // Should complete all concurrent requests quickly
      expect(duration).toBeLessThan(500)
    })
  })

  describe('Rate Limiting Performance', () => {
    it('should handle high request volume efficiently', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 10000, // High limit for performance testing
      })

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('GET', `/test/${i}`)
        req.socket = {remoteAddress: `192.168.1.${i % 255}`} // Vary IPs
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations

      console.log(
        `Rate Limit: ${iterations} requests in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Should average less than 0.5ms per request
      expect(avgTimePerRequest).toBeLessThan(0.5)
    })

    it('should handle memory cleanup efficiently', async () => {
      const middleware = rateLimit({
        windowMs: 10, // Very short window for fast cleanup
        max: 5,
      })

      // Generate many different IPs to test memory usage
      for (let i = 0; i < 100; i++) {
        req = createTestRequest('GET', '/test')
        req.socket = {remoteAddress: `10.0.${Math.floor(i / 255)}.${i % 255}`}
        await middleware(req, next)
        jest.clearAllMocks()
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Memory should be cleaned up (this is a basic test - in real scenarios you'd monitor actual memory usage)
      const memoryCheck = () => {
        // Make a request to trigger cleanup
        req = createTestRequest('GET', '/test')
        req.socket = {remoteAddress: '192.168.1.1'}
        return middleware(req, next)
      }

      const cleanupStart = performance.now()
      await memoryCheck()
      const cleanupEnd = performance.now()
      const cleanupDuration = cleanupEnd - cleanupStart

      // Cleanup should not add significant overhead
      expect(cleanupDuration).toBeLessThan(5)
    })
  })

  describe('Body Parser Performance', () => {
    it('should parse JSON efficiently', async () => {
      const middleware = bodyParser()
      const jsonData = {
        users: Array.from({length: 100}, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          profile: {
            age: 20 + (i % 50),
            city: `City ${i % 10}`,
            preferences: Array.from({length: 5}, (_, j) => `pref${j}`),
          },
        })),
      }

      const jsonString = JSON.stringify(jsonData)
      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('POST', '/api/data', {
          headers: {'Content-Type': 'application/json'},
          body: jsonString,
        })
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations
      const dataSize = new TextEncoder().encode(jsonString).length

      console.log(
        `Body Parser JSON: ${iterations} requests (${dataSize} bytes each) in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Should handle JSON parsing efficiently
      expect(avgTimePerRequest).toBeLessThan(5)
    })

    it('should handle large form data efficiently', async () => {
      const middleware = bodyParser()

      // Create large form data
      const formFields = Array.from(
        {length: 100},
        (_, i) =>
          `field${i}=${encodeURIComponent(`value_${i}_${'x'.repeat(50)}`)}`,
      ).join('&')

      const iterations = 50
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('POST', '/api/form', {
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: formFields,
        })
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations
      const dataSize = new TextEncoder().encode(formFields).length

      console.log(
        `Body Parser Form: ${iterations} requests (${dataSize} bytes each) in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Should handle form parsing efficiently
      expect(avgTimePerRequest).toBeLessThan(10)
    })
  })

  describe('CORS Performance', () => {
    it('should handle CORS headers efficiently', async () => {
      const middleware = cors({
        origin: (origin) => origin?.endsWith('.example.com') || false,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
      })

      const iterations = 1000
      const origins = [
        'https://app.example.com',
        'https://api.example.com',
        'https://admin.example.com',
        'https://evil.com', // Should be rejected
      ]

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('GET', '/api/test')
        req.headers = new Headers({
          Origin: origins[i % origins.length],
        })
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations

      console.log(
        `CORS: ${iterations} requests in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Should handle CORS very quickly
      expect(avgTimePerRequest).toBeLessThan(0.2)
    })

    it('should handle preflight requests efficiently', async () => {
      const middleware = cors({
        origin: 'https://example.com',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })

      const iterations = 500
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('OPTIONS', '/api/test')
        req.headers = new Headers({
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        })
        await middleware(req, next)
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations

      console.log(
        `CORS Preflight: ${iterations} requests in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Preflight should be very fast
      expect(avgTimePerRequest).toBeLessThan(0.1)
    })
  })

  describe('Middleware Chain Performance', () => {
    it('should handle complete middleware chain efficiently', async () => {
      const loggerMiddleware = logger({logger: mockLog})
      const corsMiddleware = cors({origin: 'https://example.com'})
      const rateLimitMiddleware = rateLimit({windowMs: 60000, max: 10000})
      const bodyParserMiddleware = bodyParser()

      const iterations = 100
      const jsonData = {
        message: 'performance test',
        data: Array.from({length: 10}, (_, i) => i),
      }
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('POST', '/api/test', {
          headers: {
            Origin: 'https://example.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonData),
        })
        req.socket = {remoteAddress: `192.168.1.${i % 255}`}

        await loggerMiddleware(req, () =>
          corsMiddleware(req, () =>
            rateLimitMiddleware(req, () => bodyParserMiddleware(req, next)),
          ),
        )
        jest.clearAllMocks()
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      const avgTimePerRequest = duration / iterations

      console.log(
        `Full Chain: ${iterations} requests in ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(3)}ms per request)`,
      )

      // Complete chain should still be reasonably fast
      expect(avgTimePerRequest).toBeLessThan(5)
    })

    it('should maintain performance under concurrent load', async () => {
      const loggerMiddleware = logger({logger: mockLog})
      const corsMiddleware = cors({origin: 'https://example.com'})
      const rateLimitMiddleware = rateLimit({windowMs: 60000, max: 10000})
      const bodyParserMiddleware = bodyParser()

      const concurrentRequests = 50
      const jsonData = {test: 'concurrent load'}
      const startTime = performance.now()

      const executeChain = (i) => {
        const req = createTestRequest('POST', `/api/concurrent/${i}`, {
          headers: {
            Origin: 'https://example.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonData),
        })
        req.socket = {remoteAddress: `192.168.1.${i % 255}`}

        return loggerMiddleware(req, () =>
          corsMiddleware(req, () =>
            rateLimitMiddleware(req, () => bodyParserMiddleware(req, next)),
          ),
        )
      }

      const promises = Array.from({length: concurrentRequests}, (_, i) =>
        executeChain(i),
      )
      await Promise.all(promises)

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(
        `Concurrent Chain: ${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms`,
      )

      // Should handle concurrent requests efficiently
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Memory Usage Tests', () => {
    it('should not leak memory during high load', async () => {
      const middleware = logger({logger: mockLog})

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const initialMemory = process.memoryUsage()
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        req = createTestRequest('GET', `/memory-test/${i}`)
        await middleware(req, next)
        jest.clearAllMocks()

        // Periodically check memory growth
        if (i % 100 === 0 && i > 0) {
          const currentMemory = process.memoryUsage()
          const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed

          // Should not grow excessively (allow some growth for normal operations)
          expect(heapGrowth).toBeLessThan(50 * 1024 * 1024) // 50MB limit
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const totalHeapGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(
        `Memory growth after ${iterations} requests: ${(totalHeapGrowth / 1024 / 1024).toFixed(2)}MB`,
      )

      // Final memory growth should be reasonable
      expect(totalHeapGrowth).toBeLessThan(100 * 1024 * 1024) // 100MB limit
    })
  })
})
