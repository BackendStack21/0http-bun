// Test file to verify improved JWT Auth TypeScript definitions
import {createJWTAuth, createAPIKeyAuth} from './lib/middleware'
import {ZeroRequest} from './common'

// Test comprehensive JWT auth options
const jwtAuth = createJWTAuth({
  secret: 'my-secret',
  algorithms: ['HS256', 'RS256'],
  audience: 'my-api',
  issuer: 'my-issuer',
  optional: true,
  excludePaths: ['/health', '/metrics'],

  // API key options
  apiKeys: ['key1', 'key2'],
  apiKeyHeader: 'x-api-key',
  apiKeyValidator: (key: string) => key === 'valid-key',

  // Custom token extraction
  getToken: (req: ZeroRequest) => req.headers.get('custom-token'),
  tokenHeader: 'x-auth-token',
  tokenQuery: 'token',

  // Custom error handling
  unauthorizedResponse: (error: Error, req: ZeroRequest) =>
    new Response('Custom unauthorized', {status: 401}),
  onError: (error: Error, req: ZeroRequest) =>
    new Response('Custom error', {status: 500}),

  // JWKS support
  jwksUri: 'https://example.com/.well-known/jwks.json',
  jwks: {
    getKey: (protectedHeader: any, token: string) => Promise.resolve('key'),
  },

  // JWT options
  jwtOptions: {
    algorithms: ['RS256'],
    clockTolerance: 30,
    maxTokenAge: 3600,
  },
})

// Test API key auth
const apiKeyAuth = createAPIKeyAuth({
  keys: (key: string, req: ZeroRequest) => key === 'valid',
  header: 'x-api-key',
  getKey: (req: ZeroRequest) => req.headers.get('api-key'),
})

// Test request types with enhanced context
async function testHandler(req: ZeroRequest): Promise<Response> {
  // Access user data from JWT
  const user = req.ctx?.user
  const jwtPayload = req.ctx?.jwt?.payload
  const token = req.ctx?.jwt?.token

  // Access API key data
  const apiKey = req.ctx?.apiKey

  // Legacy compatibility access
  const legacyUser = req.user
  const legacyJwt = req.jwt
  const legacyApiKey = req.apiKey

  return new Response(
    JSON.stringify({
      user,
      jwtPayload,
      token,
      apiKey,
      legacyUser,
      legacyJwt,
      legacyApiKey,
    }),
  )
}

console.log('TypeScript definitions test completed successfully!')
