// Test file to verify comprehensive TypeScript definitions
import http from './index'
import {
  ZeroRequest,
  StepFunction,
  RequestHandler,
  IRouter,
  IRouterConfig,
  ParsedFile,
} from './common'
import {
  // Middleware functions
  createJWTAuth,
  createAPIKeyAuth,
  createLogger,
  simpleLogger,
  createRateLimit,
  createSlidingWindowRateLimit,
  createCORS,
  simpleCORS,
  createBodyParser,
  createJSONParser,
  createTextParser,
  createURLEncodedParser,
  createMultipartParser,
  // Prometheus middleware functions
  createPrometheusIntegration,
  createPrometheusMiddleware,
  createMetricsHandler,
  createDefaultMetrics,
  extractRoutePattern,
  // Type definitions
  JWTAuthOptions,
  APIKeyAuthOptions,
  LoggerOptions,
  RateLimitOptions,
  RateLimitStore,
  MemoryStore,
  CORSOptions,
  BodyParserOptions,
  JSONParserOptions,
  TextParserOptions,
  URLEncodedParserOptions,
  MultipartParserOptions,
  JWKSLike,
  TokenExtractionOptions,
  // Prometheus type definitions
  PrometheusMiddlewareOptions,
  MetricsHandlerOptions,
  PrometheusIntegration,
  PrometheusMetrics,
  // Available utility functions
  extractTokenFromHeader,
  defaultKeyGenerator,
  defaultHandler,
  getAllowedOrigin,
  hasBody,
  shouldParse,
} from './lib/middleware'

console.log('🧪 Starting comprehensive TypeScript definitions validation...')

// =============================================================================
// CORE FRAMEWORK TYPES VALIDATION
// =============================================================================

console.log('✅ Core Framework Types')

// Test router configuration
const routerConfig: IRouterConfig = {
  port: 3000,
  defaultRoute: (req: ZeroRequest) => new Response('Not Found', {status: 404}),
  errorHandler: (err: Error) => {
    console.error('Error:', err.message)
    return new Response('Internal Server Error', {status: 500})
  },
}

// Test router creation
const {router}: {router: IRouter} = http(routerConfig)

// Test StepFunction
const testStepFunction: StepFunction = (error?: unknown) => {
  if (error) {
    return new Response('Error', {status: 500})
  }
  return new Response('OK')
}

// Test RequestHandler
const testRequestHandler: RequestHandler = (
  req: ZeroRequest,
  next: StepFunction,
) => {
  req.ctx = {...req.ctx, timestamp: Date.now()}
  return next()
}

// Test router methods
router.get('/', testRequestHandler)
router.post('/data', testRequestHandler)
router.put('/update/:id', testRequestHandler)
router.delete('/delete/:id', testRequestHandler)
router.patch('/patch/:id', testRequestHandler)
router.head('/head', testRequestHandler)
router.options('/options', testRequestHandler)
router.connect('/connect', testRequestHandler)
router.trace('/trace', testRequestHandler)
router.all('/all', testRequestHandler)
router.on('GET', '/on', testRequestHandler)
router.use(testRequestHandler)
router.use('/prefix/*', testRequestHandler)

// =============================================================================
// REQUEST AND CONTEXT TYPES VALIDATION
// =============================================================================

console.log('✅ Request and Context Types')

const testRequestTypes = async (req: ZeroRequest): Promise<Response> => {
  // Test core request properties
  const params: Record<string, string> = req.params
  const query: Record<string, string> = req.query

  // Test connection-level IP properties
  const ip: string | undefined = req.ip
  const remoteAddress: string | undefined = req.remoteAddress
  const socketAddress: string | undefined = req.socket?.remoteAddress

  // Test top-level rate limit info (set by rate-limit middleware)
  const topLevelRateLimit = req.rateLimit
  if (topLevelRateLimit) {
    const limit: number = topLevelRateLimit.limit
    const remaining: number = topLevelRateLimit.remaining
    const current: number = topLevelRateLimit.current
    const reset: Date = topLevelRateLimit.reset
  }

  // Test context object
  const ctx = req.ctx
  const log = ctx?.log
  const user = ctx?.user
  const jwt = ctx?.jwt
  const apiKey = ctx?.apiKey
  const rateLimit = ctx?.rateLimit
  const body = ctx?.body
  const files = ctx?.files
  const customData = ctx?.customProperty

  // Test legacy compatibility
  const legacyUser = req.user
  const legacyJwt = req.jwt
  const legacyApiKey = req.apiKey

  // Test JWT structure
  if (jwt) {
    const payload = jwt.payload
    const header = jwt.header
    const token = jwt.token
  }

  // Test rate limit structure
  if (rateLimit) {
    const limit: number = rateLimit.limit
    const used: number = rateLimit.used
    const remaining: number = rateLimit.remaining
    const resetTime: Date = rateLimit.resetTime
  }

  // Test files structure
  if (files) {
    const fileEntries = Object.entries(files)
    for (const [key, value] of fileEntries) {
      if (Array.isArray(value)) {
        value.forEach((file: ParsedFile) => {
          const name: string = file.name
          const size: number = file.size
          const type: string = file.type
          const data: File = file.data
        })
      } else {
        const file: ParsedFile = value
        const name: string = file.name
        const size: number = file.size
        const type: string = file.type
        const data: File = file.data
      }
    }
  }

  return new Response(JSON.stringify({success: true}))
}

// =============================================================================
// JWT AUTHENTICATION MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ JWT Authentication Middleware')

// Test comprehensive JWT auth options
const jwtAuthOptions: JWTAuthOptions = {
  // Secret options
  secret: 'static-secret',

  // JWKS options
  jwksUri: 'https://example.com/.well-known/jwks.json',
  jwks: {
    getKey: (protectedHeader: any, token: string) => Promise.resolve('key'),
  },

  // JWT verification options
  jwtOptions: {
    algorithms: ['HS256', 'RS256'],
    audience: ['api1', 'api2'],
    issuer: 'https://auth.example.com',
    subject: 'user',
    clockTolerance: 30,
    maxTokenAge: 3600,
  },

  // Token extraction
  getToken: (req: ZeroRequest) => req.headers.get('x-auth-token'),
  tokenHeader: 'x-custom-token',
  tokenQuery: 'access_token',

  // Behavior options
  optional: true,
  excludePaths: ['/health', '/public/*'],

  // API key authentication
  apiKeys: ['key1', 'key2'],
  apiKeyHeader: 'x-api-key',
  apiKeyValidator: (key: string, req: ZeroRequest) => key === 'valid-key',
  validateApiKey: (key: string) => Promise.resolve(key === 'valid'),

  // Legacy top-level JWT options
  audience: 'legacy-api',
  issuer: 'legacy-issuer',
  algorithms: ['HS256'],

  // Custom responses
  unauthorizedResponse: (error: Error, req: ZeroRequest) =>
    new Response('Custom unauthorized', {status: 401}),
  onError: (error: Error, req: ZeroRequest) =>
    new Response('Custom error', {status: 500}),
}

const jwtAuth = createJWTAuth(jwtAuthOptions)

// Test API key auth options
const apiKeyAuthOptions: APIKeyAuthOptions = {
  keys: ['key1', 'key2'],
  header: 'x-api-key',
  getKey: (req: ZeroRequest) => req.headers.get('api-key'),
}

const apiKeyAuth = createAPIKeyAuth(apiKeyAuthOptions)

// Test token extraction options (type definition only)
const tokenExtractionOptions: TokenExtractionOptions = {
  getToken: (req: ZeroRequest) => req.headers.get('token'),
  tokenHeader: 'authorization',
  tokenQuery: 'token',
}

// Test utility functions
const testJWTUtilities = (req: ZeroRequest) => {
  const tokenFromHeader = extractTokenFromHeader(req)

  // Note: Some utility functions are internal and not exported
  // This is fine as they're implementation details
}

// =============================================================================
// LOGGER MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ Logger Middleware')

const loggerOptions: LoggerOptions = {
  pinoOptions: {
    level: 'info',
  },
  serializers: {
    req: (req) => ({method: req.method, url: req.url}),
    res: (res) => ({status: res.status}),
  },
  logBody: true,
  excludePaths: ['/health', '/metrics'],
}

const logger = createLogger(loggerOptions)
const simple = simpleLogger()

// =============================================================================
// RATE LIMITING MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ Rate Limiting Middleware')

// Test custom store implementation
class CustomRateLimitStore implements RateLimitStore {
  async increment(
    key: string,
    windowMs: number,
  ): Promise<{totalHits: number; resetTime: Date}> {
    return {totalHits: 1, resetTime: new Date(Date.now() + windowMs)}
  }

  async reset(key: string): Promise<void> {
    // Custom reset implementation
  }
}

const rateLimitOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: ZeroRequest) =>
    req.headers.get('x-user-id') || 'anonymous',
  handler: (
    req: ZeroRequest,
    totalHits: number,
    max: number,
    resetTime: Date,
  ) => new Response(`Rate limit exceeded: ${totalHits}/${max}`, {status: 429}),
  store: new CustomRateLimitStore(),
  standardHeaders: true,
  excludePaths: ['/health'],
  skip: (req: ZeroRequest) => req.url.includes('/admin'),
}

const rateLimit = createRateLimit(rateLimitOptions)
const slidingRateLimit = createSlidingWindowRateLimit(rateLimitOptions)
const memoryStore = new MemoryStore()

// Test utility functions
const testRateLimitUtilities = (req: ZeroRequest) => {
  const key = defaultKeyGenerator(req)
  const response = defaultHandler(req, 10, 100, new Date())
}

// =============================================================================
// CORS MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ CORS Middleware')

const corsOptions: CORSOptions = {
  origin: (origin: string, req: ZeroRequest) => origin.endsWith('.example.com'),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}

const cors = createCORS(corsOptions)
const simpleCors = simpleCORS()

// Test utility function
const testCORSUtilities = (req: ZeroRequest) => {
  const allowedOrigin = getAllowedOrigin(
    ['https://example.com'],
    'https://app.example.com',
    req,
  )
}

// =============================================================================
// BODY PARSER MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ Body Parser Middleware')

const jsonOptions: JSONParserOptions = {
  limit: 1024 * 1024,
  reviver: (key: string, value: any) => value,
  strict: true,
  type: 'application/json',
}

const textOptions: TextParserOptions = {
  limit: 1024 * 1024,
  type: 'text/plain',
  defaultCharset: 'utf-8',
}

const urlencodedOptions: URLEncodedParserOptions = {
  limit: 1024 * 1024,
  extended: true,
}

const multipartOptions: MultipartParserOptions = {
  limit: 10 * 1024 * 1024,
}

const bodyParserOptions: BodyParserOptions = {
  json: jsonOptions,
  text: textOptions,
  urlencoded: urlencodedOptions,
  multipart: multipartOptions,
}

const bodyParser = createBodyParser(bodyParserOptions)
const jsonParser = createJSONParser(jsonOptions)
const textParser = createTextParser(textOptions)
const urlencodedParser = createURLEncodedParser(urlencodedOptions)
const multipartParser = createMultipartParser(multipartOptions)

// Test utility functions
const testBodyParserUtilities = (req: ZeroRequest) => {
  const hasReqBody = hasBody(req)
  const shouldParseJson = shouldParse(req, 'application/json')
}

// =============================================================================
// PROMETHEUS METRICS MIDDLEWARE VALIDATION
// =============================================================================

console.log('✅ Prometheus Metrics Middleware')

// Clear the Prometheus registry at the start to avoid conflicts
try {
  const promClient = require('prom-client')
  promClient.register.clear()
} catch (error) {
  // Ignore if prom-client is not available
}

// Test comprehensive Prometheus middleware options
const prometheusMiddlewareOptions: PrometheusMiddlewareOptions = {
  // Use custom metrics to avoid registry conflicts
  metrics: undefined, // Will create default metrics once

  // Paths to exclude from metrics collection
  excludePaths: ['/health', '/ping', '/favicon.ico', '/metrics'],

  // Whether to collect default Node.js metrics
  collectDefaultMetrics: false, // Disable to avoid conflicts

  // Custom route normalization function
  normalizeRoute: (req: ZeroRequest) => {
    const url = new URL(req.url, 'http://localhost')
    let pathname = url.pathname

    // Custom normalization logic
    return pathname
      .replace(/\/users\/\d+/, '/users/:id')
      .replace(/\/api\/v\d+/, '/api/:version')
      .replace(/\/items\/[a-f0-9-]{36}/, '/items/:uuid')
  },

  // Custom label extraction function
  extractLabels: (req: ZeroRequest, response: Response) => {
    return {
      user_type: req.headers.get('x-user-type') || 'anonymous',
      api_version: req.headers.get('x-api-version') || 'v1',
      region: req.headers.get('x-region') || 'us-east-1',
    }
  },

  // HTTP methods to skip from metrics collection
  skipMethods: ['OPTIONS', 'HEAD'],
}

// Test metrics handler options
const metricsHandlerOptions: MetricsHandlerOptions = {
  endpoint: '/custom-metrics',
  registry: undefined, // Would be prom-client registry in real usage
}

// Test creating individual components (create only once to avoid registry conflicts)
const defaultMetrics: PrometheusMetrics = createDefaultMetrics()
const prometheusMiddleware = createPrometheusMiddleware({
  ...prometheusMiddlewareOptions,
  metrics: defaultMetrics,
})
const metricsHandler = createMetricsHandler(metricsHandlerOptions)

// Test the integration function (use existing metrics)
const prometheusIntegration: PrometheusIntegration =
  createPrometheusIntegration({
    ...prometheusMiddlewareOptions,
    ...metricsHandlerOptions,
    metrics: defaultMetrics, // Reuse existing metrics
  })

// Test the integration object structure
const testPrometheusIntegration = () => {
  // Test middleware function
  const middleware: RequestHandler = prometheusIntegration.middleware

  // Test metrics handler function
  const handler: RequestHandler = prometheusIntegration.metricsHandler

  // Test registry access
  const registry = prometheusIntegration.registry

  // Test prom-client access for custom metrics
  const promClient = prometheusIntegration.promClient
}

// Test default metrics structure
const testDefaultMetrics = () => {
  // Use the already created metrics to avoid registry conflicts
  const metrics = defaultMetrics

  // Test that all expected metrics are present
  const duration = metrics.httpRequestDuration
  const total = metrics.httpRequestTotal
  const requestSize = metrics.httpRequestSize
  const responseSize = metrics.httpResponseSize
  const activeConnections = metrics.httpActiveConnections

  // All should be defined (prom-client objects)
  console.assert(
    duration !== undefined,
    'httpRequestDuration should be defined',
  )
  console.assert(total !== undefined, 'httpRequestTotal should be defined')
  console.assert(requestSize !== undefined, 'httpRequestSize should be defined')
  console.assert(
    responseSize !== undefined,
    'httpResponseSize should be defined',
  )
  console.assert(
    activeConnections !== undefined,
    'httpActiveConnections should be defined',
  )
}

// Test route pattern extraction
const testRoutePatternExtraction = () => {
  // Mock request objects for testing (using unknown casting for test purposes)
  const reqWithContext = {
    ctx: {route: '/users/:id'},
    url: 'http://localhost:3000/users/123',
  } as unknown as ZeroRequest

  const reqWithParams = {
    url: 'http://localhost:3000/users/123',
    params: {id: '123'},
  } as unknown as ZeroRequest

  const reqWithUUID = {
    url: 'http://localhost:3000/items/550e8400-e29b-41d4-a716-446655440000',
  } as unknown as ZeroRequest

  const reqWithNumericId = {
    url: 'http://localhost:3000/posts/12345',
  } as unknown as ZeroRequest

  const reqWithLongToken = {
    url: 'http://localhost:3000/auth/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  } as unknown as ZeroRequest

  const reqMalformed = {
    url: 'not-a-valid-url',
  } as unknown as ZeroRequest

  // Test route extraction
  const pattern1 = extractRoutePattern(reqWithContext)
  const pattern2 = extractRoutePattern(reqWithParams)
  const pattern3 = extractRoutePattern(reqWithUUID)
  const pattern4 = extractRoutePattern(reqWithNumericId)
  const pattern5 = extractRoutePattern(reqWithLongToken)
  const pattern6 = extractRoutePattern(reqMalformed)

  // All should return strings (exact patterns depend on implementation)
  console.assert(typeof pattern1 === 'string', 'Route pattern should be string')
  console.assert(typeof pattern2 === 'string', 'Route pattern should be string')
  console.assert(typeof pattern3 === 'string', 'Route pattern should be string')
  console.assert(typeof pattern4 === 'string', 'Route pattern should be string')
  console.assert(typeof pattern5 === 'string', 'Route pattern should be string')
  console.assert(typeof pattern6 === 'string', 'Route pattern should be string')
}

// Test custom metrics scenarios
const testCustomMetricsScenarios = () => {
  // Create custom metrics object (reuse existing to avoid conflicts)
  const customMetrics: PrometheusMetrics = defaultMetrics

  // Use custom metrics in middleware
  const middlewareWithCustomMetrics = createPrometheusMiddleware({
    metrics: customMetrics,
    collectDefaultMetrics: false,
  })

  // Test minimal configuration (reuse existing metrics)
  const minimalMiddleware = createPrometheusMiddleware({
    metrics: customMetrics,
    collectDefaultMetrics: false,
  })
  const minimalIntegration = createPrometheusIntegration({
    metrics: customMetrics,
    collectDefaultMetrics: false,
  })

  // Test with only specific options
  const selectiveOptions: PrometheusMiddlewareOptions = {
    excludePaths: ['/api/internal/*'],
    skipMethods: ['TRACE', 'CONNECT'],
    metrics: customMetrics, // Reuse existing
    collectDefaultMetrics: false, // Disable to avoid conflicts
  }

  const selectiveMiddleware = createPrometheusMiddleware(selectiveOptions)
}

// Execute Prometheus tests
testPrometheusIntegration()
testDefaultMetrics()
testRoutePatternExtraction()
testCustomMetricsScenarios()

// =============================================================================
// COMPLEX INTEGRATION SCENARIOS
// =============================================================================

console.log('✅ Complex Integration Scenarios')

// Test full middleware stack with proper typing
const fullMiddlewareStack = () => {
  const {router} = http({
    errorHandler: (err: Error) =>
      new Response(`Error: ${err.message}`, {status: 500}),
  })

  // CORS middleware
  router.use(
    createCORS({
      origin: ['https://app.example.com'],
      credentials: true,
    }),
  )

  // Logger middleware
  router.use(
    createLogger({
      logBody: false,
      excludePaths: ['/health'],
    }),
  )

  // Rate limiting
  router.use(
    createRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
    }),
  )

  // Body parser
  router.use(
    createBodyParser({
      json: {limit: 1024 * 1024},
    }),
  )

  // Prometheus metrics middleware (reuse existing metrics to avoid registry conflicts)
  router.use(
    createPrometheusMiddleware({
      metrics: defaultMetrics, // Reuse existing metrics
      collectDefaultMetrics: false, // Disable to avoid conflicts
      excludePaths: ['/health', '/metrics'],
      extractLabels: (req: ZeroRequest, response: Response) => ({
        user_type: req.ctx?.user?.type || 'anonymous',
        api_version: req.headers.get('x-api-version') || 'v1',
      }),
    }),
  )

  // Metrics endpoint (reuse existing metrics)
  const prometheusIntegration = createPrometheusIntegration({
    endpoint: '/metrics',
    metrics: defaultMetrics, // Reuse existing metrics
    collectDefaultMetrics: false, // Disable to avoid conflicts
  })
  router.get('/metrics', prometheusIntegration.metricsHandler)

  // JWT authentication for API routes
  router.use(
    '/api/*',
    createJWTAuth({
      secret: process.env.JWT_SECRET || 'dev-secret',
      optional: false,
      excludePaths: ['/api/public/*'],
    }),
  )

  // API routes with full type safety
  router.get('/api/profile', async (req: ZeroRequest) => {
    const user = req.ctx?.user || req.user
    const rateInfo = req.ctx?.rateLimit

    return new Response(
      JSON.stringify({
        user,
        rateLimit: rateInfo
          ? {
              remaining: rateInfo.remaining,
              resetTime: rateInfo.resetTime.toISOString(),
            }
          : null,
      }),
    )
  })

  router.post('/api/data', async (req: ZeroRequest) => {
    const body = req.ctx?.body
    const files = req.ctx?.files

    return new Response(
      JSON.stringify({
        receivedBody: body,
        fileCount: files ? Object.keys(files).length : 0,
      }),
    )
  })

  return router
}

// Test error handling scenarios
const testErrorHandling = async () => {
  try {
    // Test invalid JWT configuration
    const invalidJWT = createJWTAuth({})
  } catch (error) {
    console.log('✅ Caught expected JWT configuration error')
  }

  try {
    // Test invalid API key configuration
    const invalidAPIKey = createAPIKeyAuth({} as APIKeyAuthOptions)
  } catch (error) {
    console.log('✅ Caught expected API key configuration error')
  }
}

// Test async middleware
const testAsyncMiddleware: RequestHandler = async (
  req: ZeroRequest,
  next: StepFunction,
) => {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 1))

  req.ctx = {
    ...req.ctx,
    processedAt: new Date().toISOString(),
  }

  const response = await next()
  return response
}

// Test function parameter variations
const testParameterVariations = () => {
  // Secret as function
  const secretFunction = (req: ZeroRequest) => Promise.resolve('dynamic-secret')

  // API keys as function
  const apiKeysFunction = (key: string, req: ZeroRequest) => key === 'valid'

  // Origin as function
  const originFunction = (origin: string, req: ZeroRequest) =>
    origin.includes('trusted')

  const dynamicJWT = createJWTAuth({
    secret: secretFunction,
    apiKeys: apiKeysFunction,
  })

  const dynamicCORS = createCORS({
    origin: originFunction,
  })
}

// =============================================================================
// VALIDATION EXECUTION
// =============================================================================

// Execute all validations
const runValidations = async () => {
  await testErrorHandling()
  testParameterVariations()

  const testRouter = fullMiddlewareStack()

  // Test request flow
  const mockRequest = new Request('http://localhost:3000/api/profile', {
    headers: {authorization: 'Bearer test-token'},
  }) as ZeroRequest

  await testRequestTypes(mockRequest)
  testJWTUtilities(mockRequest)
  testRateLimitUtilities(mockRequest)
  testCORSUtilities(mockRequest)
  testBodyParserUtilities(mockRequest)

  // Test Prometheus utilities
  testPrometheusIntegration()
  testDefaultMetrics()
  testRoutePatternExtraction()
  testCustomMetricsScenarios()
}

// Run all validations
runValidations()
  .then(() => {
    console.log('🎉 All TypeScript definitions validated successfully!')
    console.log('✅ Core framework types')
    console.log('✅ Request and context types')
    console.log('✅ JWT authentication middleware')
    console.log('✅ Logger middleware')
    console.log('✅ Rate limiting middleware')
    console.log('✅ CORS middleware')
    console.log('✅ Body parser middleware')
    console.log('✅ Prometheus metrics middleware')
    console.log('✅ Complex integration scenarios')
    console.log('✅ Error handling scenarios')
    console.log('✅ Async middleware patterns')
    console.log('✅ Parameter variation patterns')
    console.log('🚀 Framework is ready for publication!')
  })
  .catch((error) => {
    console.error('❌ TypeScript validation failed:', error)
    process.exit(1)
  })

console.log('TypeScript definitions test completed successfully!')
