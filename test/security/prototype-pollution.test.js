/* global describe, it, expect, beforeEach */

const router = require('../../lib/router/sequential')

describe('Prototype Pollution Security Tests', () => {
  let routerInstance

  beforeEach(() => {
    routerInstance = router()
    // Ensure clean prototype state before each test
    delete Object.prototype.polluted
    delete Object.prototype.isAdmin
  })

  afterEach(() => {
    // Clean up any prototype pollution after tests
    delete Object.prototype.polluted
    delete Object.prototype.isAdmin
  })

  describe('Parameter Assignment Protection', () => {
    it('should prevent __proto__ pollution via route parameters', async () => {
      routerInstance.get('/user/:__proto__', (req) => {
        return Response.json({params: req.params})
      })

      const maliciousReq = {
        method: 'GET',
        url: 'http://localhost/user/polluted_value',
        headers: {},
      }

      await routerInstance.fetch(maliciousReq)

      // Verify that the prototype was not polluted
      expect({}.polluted).toBeUndefined()
      expect(Object.prototype.polluted).toBeUndefined()
    })

    it('should prevent constructor pollution via route parameters', async () => {
      routerInstance.get('/api/:constructor', (req) => {
        return Response.json({params: req.params})
      })

      const maliciousReq = {
        method: 'GET',
        url: 'http://localhost/api/malicious_constructor',
        headers: {},
      }

      await routerInstance.fetch(maliciousReq)

      // Verify that constructor was not polluted
      expect({}.constructor.polluted).toBeUndefined()
    })

    it('should prevent prototype property pollution via route parameters', async () => {
      routerInstance.get('/test/:prototype', (req) => {
        return Response.json({params: req.params})
      })

      const maliciousReq = {
        method: 'GET',
        url: 'http://localhost/test/dangerous_value',
        headers: {},
      }

      await routerInstance.fetch(maliciousReq)

      // Verify that prototype property was not polluted
      expect({}.prototype).toBeUndefined()
    })

    it('should allow safe parameter names while blocking dangerous ones', async () => {
      // Test with realistic parameter names
      routerInstance.get('/safe/:id/:name', (req) => {
        return Response.json({params: req.params})
      })

      // Mock trouter to simulate what would happen if dangerous params came through
      const originalFind = routerInstance.find
      routerInstance.find = function (method, path) {
        if (path === '/safe/123/test') {
          return {
            handlers: [(req) => Response.json({params: req.params})],
            params: {
              id: '123',
              name: 'test',
              __proto__: 'polluted_value', // Dangerous property
              constructor: 'dangerous_value', // Dangerous property
            },
          }
        }
        return originalFind.call(this, method, path)
      }

      const testReq = {
        method: 'GET',
        url: 'http://localhost/safe/123/test',
        headers: {},
      }

      const response = await routerInstance.fetch(testReq)
      const result = await response.json()

      // Safe parameters should be included
      expect(result.params.id).toBe('123')
      expect(result.params.name).toBe('test')

      // Dangerous parameters should be filtered out - verify they weren't assigned malicious values
      expect(result.params.__proto__).not.toBe('polluted_value')
      expect(result.params.constructor).not.toBe('dangerous_value')

      // Verify no prototype pollution occurred
      expect({}.polluted_value).toBeUndefined()
      expect(Object.prototype.polluted_value).toBeUndefined()
    })

    it('should handle nested dangerous property attempts', async () => {
      routerInstance.get('/nested/:param', (req) => {
        return Response.json({params: req.params})
      })

      // Mock trouter to return dangerous params object structure
      const originalFind = routerInstance.find
      routerInstance.find = function (method, path) {
        if (path === '/nested/test') {
          return {
            handlers: [() => Response.json({success: true})],
            params: {
              param: 'safe_value',
              __proto__: {polluted: true},
              constructor: {prototype: {isAdmin: true}},
            },
          }
        }
        return originalFind.call(this, method, path)
      }

      const testReq = {
        method: 'GET',
        url: 'http://localhost/nested/test',
        headers: {},
      }

      await routerInstance.fetch(testReq)

      // Verify no pollution occurred
      expect({}.polluted).toBeUndefined()
      expect({}.isAdmin).toBeUndefined()
      expect(Object.prototype.polluted).toBeUndefined()
      expect(Object.prototype.isAdmin).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty params object safely', async () => {
      routerInstance.get('/empty', (req) => {
        return Response.json({params: req.params})
      })

      const testReq = {
        method: 'GET',
        url: 'http://localhost/empty',
        headers: {},
      }

      const response = await routerInstance.fetch(testReq)
      const result = await response.json()

      expect(result.params).toEqual({})
      expect({}.polluted).toBeUndefined()
    })

    it('should handle params with inherited properties safely', async () => {
      routerInstance.get('/inherited/:param', (req) => {
        return Response.json({params: req.params})
      })

      // Mock trouter to return params with inherited properties
      const originalFind = routerInstance.find
      routerInstance.find = function (method, path) {
        if (path === '/inherited/test') {
          const badParams = Object.create({inherited: 'bad'})
          badParams.safe = 'good'
          badParams.__proto__ = {polluted: true}

          return {
            handlers: [() => Response.json({success: true})],
            params: badParams,
          }
        }
        return originalFind.call(this, method, path)
      }

      const testReq = {
        method: 'GET',
        url: 'http://localhost/inherited/test',
        headers: {},
      }

      await routerInstance.fetch(testReq)

      // Should only copy own properties, not inherited ones
      expect(testReq.params.safe).toBe('good')
      expect(testReq.params.inherited).toBeUndefined()
      expect({}.polluted).toBeUndefined()
    })
  })
})
