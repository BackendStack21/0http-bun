/* global describe, it, expect, beforeEach */

describe('Middleware Next Function Unit Tests', () => {
  // Create a simplified wrapper for testing the next function
  const createNextFunction = (
    middlewares,
    finalHandler,
    customErrorHandler,
  ) => {
    const next = require('../../lib/next')
    const defaultErrorHandler = (err, req) => {
      req.errorHandled = true
      req.errorMessage = err.message
      return req
    }
    const errorHandler = customErrorHandler || defaultErrorHandler

    return (req) => next(middlewares, req, 0, finalHandler, errorHandler)
  }

  describe('Next Function Creation', () => {
    it('should create a next function with empty middleware array', () => {
      const middlewares = []
      const nextFn = createNextFunction(middlewares, () => 'final')

      expect(typeof nextFn).toBe('function')
    })

    it('should create a next function with single middleware', () => {
      const middlewares = [(req, next) => next()]
      const nextFn = createNextFunction(middlewares, () => 'final')

      expect(typeof nextFn).toBe('function')
    })

    it('should create a next function with multiple middlewares', () => {
      const middlewares = [
        (req, next) => next(),
        (req, next) => next(),
        (req, next) => next(),
      ]
      const nextFn = createNextFunction(middlewares, () => 'final')

      expect(typeof nextFn).toBe('function')
    })
  })

  describe('Middleware Execution Order', () => {
    it('should execute middlewares in correct order', async () => {
      const executionOrder = []

      const middlewares = [
        (req, next) => {
          executionOrder.push('middleware1')
          return next()
        },
        (req, next) => {
          executionOrder.push('middleware2')
          return next()
        },
        (req, next) => {
          executionOrder.push('middleware3')
          return next()
        },
      ]

      const final = (req) => {
        executionOrder.push('final')
        return 'result'
      }

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(executionOrder).toEqual([
        'middleware1',
        'middleware2',
        'middleware3',
        'final',
      ])
      expect(result).toBe('result')
    })

    it('should stop execution when middleware does not call next', async () => {
      const executionOrder = []

      const middlewares = [
        (req, next) => {
          executionOrder.push('middleware1')
          return next()
        },
        (req, next) => {
          executionOrder.push('middleware2')
          return 'early-return' // Does not call next()
        },
        (req, next) => {
          executionOrder.push('middleware3')
          return next()
        },
      ]

      const final = (req) => {
        executionOrder.push('final')
        return 'result'
      }

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(executionOrder).toEqual(['middleware1', 'middleware2'])
      expect(result).toBe('early-return')
    })
  })

  describe('Request Object Mutation', () => {
    it('should allow middlewares to modify request object', async () => {
      const middlewares = [
        (req, next) => {
          req.step1 = true
          return next()
        },
        (req, next) => {
          req.step2 = req.step1 ? 'after-step1' : 'no-step1'
          return next()
        },
      ]

      const final = (req) => {
        return {step1: req.step1, step2: req.step2}
      }

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(result).toEqual({step1: true, step2: 'after-step1'})
    })

    it('should preserve request object mutations across middleware chain', async () => {
      const req = {original: true}

      const middlewares = [
        (req, next) => {
          req.auth = {user: 'test'}
          return next()
        },
        (req, next) => {
          req.timestamp = Date.now()
          return next()
        },
        (req, next) => {
          req.processed = true
          return next()
        },
      ]

      const final = (req) => req

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn(req)

      expect(result.original).toBe(true)
      expect(result.auth).toEqual({user: 'test'})
      expect(typeof result.timestamp).toBe('number')
      expect(result.processed).toBe(true)
    })
  })

  describe('Async Middleware Support', () => {
    it('should handle async middlewares', async () => {
      const middlewares = [
        async (req, next) => {
          await new Promise((resolve) => setTimeout(resolve, 1))
          req.async1 = true
          return next()
        },
        async (req, next) => {
          await new Promise((resolve) => setTimeout(resolve, 1))
          req.async2 = true
          return next()
        },
      ]

      const final = (req) => req

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(result.async1).toBe(true)
      expect(result.async2).toBe(true)
    })

    it('should handle mix of sync and async middlewares', async () => {
      const middlewares = [
        (req, next) => {
          req.sync = true
          return next()
        },
        async (req, next) => {
          await new Promise((resolve) => setTimeout(resolve, 1))
          req.async = true
          return next()
        },
        (req, next) => {
          req.sync2 = req.sync && req.async
          return next()
        },
      ]

      const final = (req) => req

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(result.sync).toBe(true)
      expect(result.async).toBe(true)
      expect(result.sync2).toBe(true)
    })
  })

  describe('Error Handling in Middleware', () => {
    it('should propagate errors from middleware', async () => {
      const middlewares = [
        (req, next) => {
          req.beforeError = true
          return next()
        },
        (req, next) => {
          throw new Error('Middleware error')
        },
        (req, next) => {
          req.afterError = true
          return next()
        },
      ]

      const final = (req) => req
      const errorHandler = (err, req) => {
        req.errorHandled = true
        req.errorMessage = err.message
        return req
      }

      const nextFn = createNextFunction(middlewares, final, errorHandler)
      const result = await nextFn({})

      expect(result.beforeError).toBe(true)
      expect(result.errorHandled).toBe(true)
      expect(result.errorMessage).toBe('Middleware error')
      expect(result.afterError).toBeUndefined() // Should not reach middleware after error
    })

    it('should propagate async errors from middleware', async () => {
      const middlewares = [
        async (req, next) => {
          await new Promise((resolve) => setTimeout(resolve, 1))
          throw new Error('Async middleware error')
        },
      ]

      const final = (req) => req
      const errorHandler = (err, req) => {
        req.errorHandled = true
        req.errorMessage = err.message
        return req
      }

      const nextFn = createNextFunction(middlewares, final, errorHandler)

      // Async errors in middleware are not currently caught by the next function
      // This is a limitation of the current implementation
      await expect(nextFn({})).rejects.toThrow('Async middleware error')
    })

    it('should handle errors passed to next function', async () => {
      const middlewares = [
        (req, next) => {
          return next(new Error('Error passed to next'))
        },
      ]

      const final = (req) => req
      const errorHandler = (err, req) => {
        req.errorHandled = true
        req.errorMessage = err.message
        return req
      }

      const nextFn = createNextFunction(middlewares, final, errorHandler)
      const result = await nextFn({})

      expect(result.errorHandled).toBe(true)
      expect(result.errorMessage).toBe('Error passed to next')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty middleware array', async () => {
      const middlewares = []
      const final = (req) => 'final-result'

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      expect(result).toBe('final-result')
    })

    it('should handle middleware that returns undefined when calling next', async () => {
      const middlewares = [
        (req, next) => {
          req.modified = true
          next() // No return statement - returns undefined
        },
      ]

      const final = (req) => req

      const nextFn = createNextFunction(middlewares, final)
      const result = await nextFn({})

      // When middleware doesn't return next(), it returns undefined
      expect(result).toBeUndefined()
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large number of middlewares efficiently', async () => {
      const middlewares = Array(100)
        .fill(null)
        .map((_, i) => (req, next) => {
          req[`middleware${i}`] = true
          return next()
        })

      const final = (req) => Object.keys(req).length

      const nextFn = createNextFunction(middlewares, final)
      const startTime = performance.now()
      const result = await nextFn({})
      const endTime = performance.now()

      expect(result).toBe(100)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in reasonable time
    })
  })
})
