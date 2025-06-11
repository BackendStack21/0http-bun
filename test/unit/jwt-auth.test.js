/* global describe, it, expect, beforeEach, afterEach, jest */

const {jwtAuth} = require('../../lib/middleware')
const {createTestRequest} = require('../helpers')
const {SignJWT, importJWK} = require('jose')

describe('JWT Authentication Middleware', () => {
  let req, next, mockJWKS, testKey, testJWT

  beforeEach(async () => {
    req = createTestRequest('GET', '/protected')
    next = jest.fn(() => new Response('Protected resource'))

    // Create test JWK and JWT
    testKey = await importJWK({
      kty: 'oct',
      k: 'AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow',
    })

    testJWT = await new SignJWT({sub: 'user123', role: 'admin'})
      .setProtectedHeader({alg: 'HS256'})
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(testKey)

    mockJWKS = {
      getKey: jest.fn(() => testKey),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('JWT Token Validation', () => {
    it('should authenticate valid JWT token', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(req.jwt).toBeDefined()
      expect(req.user).toEqual(
        expect.objectContaining({
          sub: 'user123',
          role: 'admin',
        }),
      )
      expect(next).toHaveBeenCalled()
    })

    it('should reject invalid JWT token', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.jwt.token',
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(req.jwt).toBeUndefined()
      expect(req.user).toBeUndefined()
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject expired JWT token', async () => {
      const expiredJWT = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('-1h') // Expired 1 hour ago
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${expiredJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('JWKS Support', () => {
    it('should authenticate using JWKS', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        jwks: mockJWKS,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(mockJWKS.getKey).toHaveBeenCalled()
      expect(req.user).toBeDefined()
      expect(next).toHaveBeenCalled()
    })

    it('should handle JWKS key retrieval errors', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      mockJWKS.getKey = jest.fn(() => {
        throw new Error('Key not found')
      })

      const middleware = jwtAuth({
        jwks: mockJWKS,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('API Key Authentication', () => {
    it('should authenticate valid API key', async () => {
      const validApiKey = 'test-api-key-123'
      req.headers = new Headers({
        'X-API-Key': validApiKey,
      })

      const middleware = jwtAuth({
        apiKeys: [validApiKey],
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(req.apiKey).toBe(validApiKey)
      expect(req.user).toEqual({apiKey: validApiKey})
      expect(next).toHaveBeenCalled()
    })

    it('should reject invalid API key', async () => {
      req.headers = new Headers({
        'X-API-Key': 'invalid-api-key',
      })

      const middleware = jwtAuth({
        apiKeys: ['valid-key-1', 'valid-key-2'],
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(req.apiKey).toBeUndefined()
      expect(req.user).toBeUndefined()
      expect(next).not.toHaveBeenCalled()
    })

    it('should use custom API key validator', async () => {
      const customApiKey = 'custom-key'
      req.headers = new Headers({
        'X-API-Key': customApiKey,
      })

      const customValidator = jest.fn((key) => {
        return key === customApiKey ? {userId: '123', role: 'user'} : null
      })

      const middleware = jwtAuth({
        validateApiKey: customValidator,
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(customValidator).toHaveBeenCalledWith(customApiKey)
      expect(req.user).toEqual({userId: '123', role: 'user'})
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Token Extraction', () => {
    it('should extract token from Authorization header by default', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      await middleware(req, next)

      expect(req.jwt).toBeDefined()
    })

    it('should extract token from custom header', async () => {
      req.headers = new Headers({
        'X-Access-Token': testJWT,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        tokenHeader: 'X-Access-Token',
      })

      await middleware(req, next)

      expect(req.jwt).toBeDefined()
    })

    it('should extract token from query parameter', async () => {
      req = createTestRequest('GET', `/protected?token=${testJWT}`)

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        tokenQuery: 'token',
      })

      await middleware(req, next)

      expect(req.jwt).toBeDefined()
    })

    it('should use custom token extractor', async () => {
      req.headers = new Headers({
        'Custom-Token': `Custom ${testJWT}`,
      })

      const customExtractor = jest.fn((req) => {
        const header = req.headers.get('Custom-Token')
        return header ? header.replace('Custom ', '') : null
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        getToken: customExtractor,
      })

      await middleware(req, next)

      expect(customExtractor).toHaveBeenCalledWith(req)
      expect(req.jwt).toBeDefined()
    })
  })

  describe('Optional Authentication', () => {
    it('should allow requests without token when optional is true', async () => {
      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        optional: true,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(req.jwt).toBeUndefined()
      expect(req.user).toBeUndefined()
      expect(next).toHaveBeenCalled()
    })

    it('should still validate token when provided in optional mode', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        optional: true,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(req.jwt).toBeDefined()
      expect(req.user).toBeDefined()
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Custom Error Responses', () => {
    it('should use custom unauthorized response', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const customResponse = new Response(
        JSON.stringify({error: 'Custom unauthorized'}),
        {
          status: 401,
          headers: {'Content-Type': 'application/json'},
        },
      )

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: customResponse,
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(await response.text()).toContain('Custom unauthorized')
    })

    it('should use custom error handler', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const customErrorHandler = jest.fn((error, req) => {
        return new Response(`Error: ${error.message}`, {status: 403})
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        onError: customErrorHandler,
      })

      const response = await middleware(req, next)

      expect(customErrorHandler).toHaveBeenCalled()
      expect(response.status).toBe(403)
    })
  })

  describe('Audience and Issuer Validation', () => {
    it('should validate JWT audience', async () => {
      const jwtWithAudience = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('1h')
        .setAudience('api.example.com')
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${jwtWithAudience}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        audience: 'api.example.com',
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(200)
      expect(next).toHaveBeenCalled()
    })

    it('should reject JWT with wrong audience', async () => {
      const jwtWithWrongAudience = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('1h')
        .setAudience('wrong.audience.com')
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${jwtWithWrongAudience}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        audience: 'api.example.com',
      })

      const response = await middleware(req, next)

      expect(response.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Configuration Error Handling', () => {
    it('should throw error when no secret, jwksUri, jwks, or API keys provided', () => {
      expect(() => {
        jwtAuth({})
      }).toThrow('JWT middleware requires either secret or jwksUri')
    })

    it('should not throw error when only API keys are provided', () => {
      expect(() => {
        jwtAuth({
          apiKeys: ['test-key'],
        })
      }).not.toThrow()
    })

    it('should handle jwksUri configuration', () => {
      // Just test that the middleware is created without error
      expect(() => {
        jwtAuth({
          jwksUri: 'https://example.com/.well-known/jwks.json',
          algorithms: ['RS256'],
        })
      }).not.toThrow()
    })

    it('should handle secret as function', async () => {
      const secretFunction = jest.fn(() => testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: secretFunction,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })

    it('should handle jwks without getKey method', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      const middleware = jwtAuth({
        jwks: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })
  })

  describe('Exclude Paths', () => {
    it('should skip authentication for excluded paths', async () => {
      req = createTestRequest('GET', '/public/health')

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        excludePaths: ['/public', '/health'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(next).toHaveBeenCalled()
    })

    it('should authenticate for non-excluded paths', async () => {
      req = createTestRequest('GET', '/protected/resource')

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        excludePaths: ['/public'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('API Key Validation Edge Cases', () => {
    it('should handle validateApiKey function with single parameter', async () => {
      const validApiKey = 'test-key'
      req.headers = new Headers({
        'X-API-Key': validApiKey,
      })

      const singleParamValidator = jest.fn((key) => {
        return key === validApiKey ? {userId: 'test'} : null
      })

      const middleware = jwtAuth({
        validateApiKey: singleParamValidator,
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(singleParamValidator).toHaveBeenCalledWith(validApiKey)
    })

    it('should handle validateApiKey function with two parameters', async () => {
      const validApiKey = 'test-key'
      req.headers = new Headers({
        'X-API-Key': validApiKey,
      })

      const twoParamValidator = jest.fn((key, request) => {
        return key === validApiKey && request ? {userId: 'test'} : null
      })

      const middleware = jwtAuth({
        validateApiKey: twoParamValidator,
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(twoParamValidator).toHaveBeenCalledWith(validApiKey, req)
    })

    it('should handle apiKeys as function', async () => {
      const validApiKey = 'test-key'
      req.headers = new Headers({
        'X-API-Key': validApiKey,
      })

      const apiKeysFunction = jest.fn((key, request) => {
        return key === validApiKey
      })

      const middleware = jwtAuth({
        apiKeys: apiKeysFunction,
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(apiKeysFunction).toHaveBeenCalledWith(validApiKey, req)
    })

    it('should handle single string API key', async () => {
      const validApiKey = 'test-key'
      req.headers = new Headers({
        'X-API-Key': validApiKey,
      })

      const middleware = jwtAuth({
        apiKeys: validApiKey,
        apiKeyHeader: 'X-API-Key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle JWT verification not configured error', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      // Create middleware with no JWT config but has API key mode
      const middleware = jwtAuth({
        apiKeys: ['test-key'], // Only API key mode, no JWT config
        optional: false, // Force authentication
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      expect(errorData.error).toBe('JWT verification not configured')
    })

    it('should handle optional mode with no token and no API key', async () => {
      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        optional: true,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(next).toHaveBeenCalled()
    })

    it('should handle optional mode with invalid token but continue', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        optional: true,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(next).toHaveBeenCalled()
    })

    it('should handle custom error handler that throws', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const throwingErrorHandler = jest.fn(() => {
        throw new Error('Handler error')
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        onError: throwingErrorHandler,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      expect(throwingErrorHandler).toHaveBeenCalled()
    })

    it('should handle custom error handler returning non-Response', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const nonResponseHandler = jest.fn(() => {
        return 'not a response'
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        onError: nonResponseHandler,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      expect(nonResponseHandler).toHaveBeenCalled()
    })
  })

  describe('Unauthorized Response Edge Cases', () => {
    it('should handle unauthorizedResponse as Response object', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const customResponse = new Response('Custom error', {status: 403})

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: customResponse,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(403)
      expect(await response.text()).toBe('Custom error')
    })

    it('should handle unauthorizedResponse function returning object with body', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const responseFunction = jest.fn(() => ({
        status: 403,
        body: 'Custom error message',
        headers: {'X-Custom': 'header'},
      }))

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: responseFunction,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(403)
      expect(await response.text()).toBe('Custom error message')
      expect(response.headers.get('X-Custom')).toBe('header')
    })

    it('should handle unauthorizedResponse function returning object without body', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const responseFunction = jest.fn(() => ({
        status: 403,
        data: 'error data',
      }))

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: responseFunction,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(403)
      const responseData = await response.json()
      expect(responseData.data).toBe('error data')
    })

    it('should handle unauthorizedResponse function that throws', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const throwingResponseFunction = jest.fn(() => {
        throw new Error('Response function error')
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: throwingResponseFunction,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      expect(throwingResponseFunction).toHaveBeenCalled()
    })

    it('should handle unauthorizedResponse function returning Response object (line 275)', async () => {
      req.headers.set('Authorization', 'Bearer invalid-token')

      const responseFunction = jest.fn(() => {
        return new Response(JSON.stringify({error: 'Custom response object'}), {
          status: 403,
          headers: {'Content-Type': 'application/json'},
        })
      })

      const middleware = jwtAuth({
        secret: 'test-secret',
        unauthorizedResponse: responseFunction,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(403)
      const errorData = await response.json()
      expect(errorData.error).toBe('Custom response object')
      expect(responseFunction).toHaveBeenCalled()
    })
  })

  describe('Specific JWT Error Types', () => {
    it('should handle JWTExpired error', async () => {
      const expiredJWT = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('-1h')
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${expiredJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      expect(errorData.error).toBe('Token expired')
    })

    it('should handle JWT with malformed token', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer malformed-token-here',
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      // This will trigger JWTInvalid error and get "Invalid token format" message
      expect(['Invalid token format', 'Invalid token']).toContain(
        errorData.error,
      )
    })

    it('should handle audience validation error', async () => {
      const jwtWithWrongAudience = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('1h')
        .setAudience('wrong.audience')
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${jwtWithWrongAudience}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        audience: 'correct.audience',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      // The error message will contain "audience" which triggers the specific handler
      expect(['Invalid token audience', 'Invalid token']).toContain(
        errorData.error,
      )
    })

    it('should handle issuer validation error', async () => {
      const jwtWithWrongIssuer = await new SignJWT({sub: 'user123'})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer('wrong.issuer')
        .sign(testKey)

      req.headers = new Headers({
        Authorization: `Bearer ${jwtWithWrongIssuer}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        issuer: 'correct.issuer',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      // The error message will contain "issuer" which triggers the specific handler
      expect(['Invalid token issuer', 'Invalid token']).toContain(
        errorData.error,
      )
    })
  })

  describe('Authorization Header Edge Cases', () => {
    it('should handle malformed Authorization header', async () => {
      req.headers = new Headers({
        Authorization: 'InvalidFormat',
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
    })

    it('should handle Authorization header with wrong scheme', async () => {
      req.headers = new Headers({
        Authorization: `Basic ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
    })

    it('should handle Authorization header with multiple spaces', async () => {
      req.headers = new Headers({
        Authorization: `Bearer  ${testJWT}`,
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
    })
  })

  describe('Additional Coverage for Error Handling', () => {
    it('should handle unauthorizedResponse function returning non-object', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.token',
      })

      const responseFunction = jest.fn(() => 'string response')

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
        unauthorizedResponse: responseFunction,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      expect(responseFunction).toHaveBeenCalled()
    })

    it('should handle error with JWKSNoMatchingKey type', async () => {
      req.headers = new Headers({
        Authorization: `Bearer ${testJWT}`,
      })

      // Mock JWKS that throws JWKSNoMatchingKey error
      const {errors} = require('jose')
      const mockJWKS = {
        getKey: jest.fn(() => {
          throw new errors.JWKSNoMatchingKey('No matching key found')
        }),
      }

      const middleware = jwtAuth({
        jwks: mockJWKS,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      expect(errorData.error).toBe('Token signature verification failed')
    })

    it('should handle JWTInvalid error type', async () => {
      req.headers = new Headers({
        Authorization: 'Bearer invalid.jwt.structure',
      })

      const middleware = jwtAuth({
        secret: testKey,
        algorithms: ['HS256'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      // Should get either "Invalid token format" or "Invalid token"
      expect(['Invalid token format', 'Invalid token']).toContain(
        errorData.error,
      )
    })
  })
})

describe('Edge Cases for Complete Coverage', () => {
  const {jwtAuth} = require('../../lib/middleware')
  const {createTestRequest} = require('../helpers')
  const {SignJWT, importJWK} = require('jose')
  let req, next, testKey, testJWT

  beforeEach(async () => {
    req = createTestRequest('GET', '/protected')
    next = jest.fn(() => new Response('Protected resource'))

    testKey = await importJWK({
      kty: 'oct',
      k: 'AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow',
    })

    testJWT = await new SignJWT({sub: 'user123', role: 'admin'})
      .setProtectedHeader({alg: 'HS256'})
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(testKey)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should handle JWKS with direct key object', async () => {
    req.headers = new Headers({
      Authorization: `Bearer ${testJWT}`,
    })

    const middleware = jwtAuth({
      jwks: testKey, // Direct key object, not an object with getKey method
      algorithms: ['HS256'],
    })

    const response = await middleware(req, next)
    expect(response.status).toBe(200)
  })

  it('should handle API key mode with string validation returning false', async () => {
    req.headers = new Headers({
      'X-API-Key': 'invalid-key',
    })

    const middleware = jwtAuth({
      apiKeys: 'valid-key', // String API key that won't match
      apiKeyHeader: 'X-API-Key',
    })

    const response = await middleware(req, next)
    expect(response.status).toBe(401)
  })
})

describe('API Key Authentication Middleware (createAPIKeyAuth)', () => {
  const {createAPIKeyAuth} = require('../../lib/middleware/jwt-auth')
  let req, next

  beforeEach(() => {
    req = createTestRequest('GET', '/api/test')
    next = jest.fn(() => new Response('API response'))
  })

  describe('Configuration', () => {
    it('should throw error when no keys provided', () => {
      expect(() => {
        createAPIKeyAuth({})
      }).toThrow('API key middleware requires keys configuration')
    })

    it('should use default header when none specified', async () => {
      req.headers = new Headers({
        'x-api-key': 'valid-key',
      })

      const middleware = createAPIKeyAuth({
        keys: ['valid-key'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })

    it('should use custom header when specified', async () => {
      req.headers = new Headers({
        'Custom-API-Key': 'valid-key',
      })

      const middleware = createAPIKeyAuth({
        keys: ['valid-key'],
        header: 'Custom-API-Key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })
  })

  describe('Key Validation', () => {
    it('should validate API key from array', async () => {
      req.headers = new Headers({
        'x-api-key': 'valid-key-2',
      })

      const middleware = createAPIKeyAuth({
        keys: ['valid-key-1', 'valid-key-2', 'valid-key-3'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(req.ctx.apiKey).toBe('valid-key-2')
    })

    it('should validate single API key string', async () => {
      req.headers = new Headers({
        'x-api-key': 'single-key',
      })

      const middleware = createAPIKeyAuth({
        keys: 'single-key',
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
    })

    it('should use function for key validation', async () => {
      req.headers = new Headers({
        'x-api-key': 'dynamic-key',
      })

      const keyValidator = jest.fn((key, request) => {
        return key === 'dynamic-key' && request
      })

      const middleware = createAPIKeyAuth({
        keys: keyValidator,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(keyValidator).toHaveBeenCalledWith('dynamic-key', req)
    })

    it('should use custom getKey function', async () => {
      req.headers = new Headers({
        'Custom-Header': 'extracted-key',
      })

      const customGetKey = jest.fn((request) => {
        return request.headers.get('Custom-Header')
      })

      const middleware = createAPIKeyAuth({
        keys: ['extracted-key'],
        getKey: customGetKey,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(200)
      expect(customGetKey).toHaveBeenCalledWith(req)
    })
  })

  describe('Error Handling', () => {
    it('should return 401 when no API key provided', async () => {
      const middleware = createAPIKeyAuth({
        keys: ['valid-key'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      expect(errorData.error).toBe('API key required')
    })

    it('should return 401 when invalid API key provided', async () => {
      req.headers = new Headers({
        'x-api-key': 'invalid-key',
      })

      const middleware = createAPIKeyAuth({
        keys: ['valid-key'],
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(401)
      const errorData = await response.json()
      expect(errorData.error).toBe('Invalid API key')
    })

    it('should handle validation function throwing error', async () => {
      req.headers = new Headers({
        'x-api-key': 'test-key',
      })

      const throwingValidator = jest.fn(() => {
        throw new Error('Validation error')
      })

      const middleware = createAPIKeyAuth({
        keys: throwingValidator,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData.error).toBe('Authentication failed')
    })

    it('should handle custom getKey function throwing error', async () => {
      const throwingGetKey = jest.fn(() => {
        throw new Error('GetKey error')
      })

      const middleware = createAPIKeyAuth({
        keys: ['valid-key'],
        getKey: throwingGetKey,
      })

      const response = await middleware(req, next)
      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData.error).toBe('Authentication failed')
    })
  })
})

describe('Final Coverage Tests for Remaining Lines', () => {
  const {jwtAuth} = require('../../lib/middleware')
  const {createTestRequest} = require('../helpers')
  const {SignJWT, importJWK} = require('jose')
  let req, next, testKey

  beforeEach(async () => {
    req = createTestRequest('GET', '/protected')
    next = jest.fn()

    testKey = await importJWK({
      kty: 'oct',
      k: 'AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow',
    })
  })

  it('should handle unauthorizedResponse function throwing error (line 275)', async () => {
    req.headers.set('Authorization', 'Bearer invalid-token')

    const throwingUnauthorizedResponse = jest.fn(() => {
      throw new Error('Response generation failed')
    })

    const middleware = jwtAuth({
      secret: 'test-secret',
      unauthorizedResponse: throwingUnauthorizedResponse,
    })

    const response = await middleware(req, next)
    expect(response.status).toBe(401)
    const errorData = await response.json()
    expect(errorData.error).toBe('Invalid token')
    expect(throwingUnauthorizedResponse).toHaveBeenCalled()
  })

  it('should handle JWT audience validation error (line 312)', async () => {
    req.headers = new Headers({
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    })

    // Create a secret function that throws an error with "audience" in the message
    const secretFunction = async (protectedHeader, token) => {
      throw new Error('JWT audience validation failed')
    }

    const middleware = jwtAuth({
      secret: secretFunction,
      algorithms: ['HS256'],
    })

    const response = await middleware(req, next)
    expect(response.status).toBe(401)
    const errorData = await response.json()
    expect(errorData.error).toBe('Invalid token audience')
  })

  it('should handle JWT issuer validation error (line 314)', async () => {
    req.headers = new Headers({
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    })

    // Create a secret function that throws an error with "issuer" in the message
    const secretFunction = async (protectedHeader, token) => {
      throw new Error('JWT issuer validation failed')
    }

    const middleware = jwtAuth({
      secret: secretFunction,
      algorithms: ['HS256'],
    })

    const response = await middleware(req, next)
    expect(response.status).toBe(401)
    const errorData = await response.json()
    expect(errorData.error).toBe('Invalid token issuer')
  })
})
