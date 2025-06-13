# Middleware Documentation

0http-bun provides a comprehensive middleware system with built-in middlewares for common use cases. All middleware functions are TypeScript-ready and follow the standard middleware pattern.

## Table of Contents

- [Middleware Pattern](#middleware-pattern)
- [Built-in Middlewares](#built-in-middlewares)
  - [Body Parser](#body-parser)
  - [CORS](#cors)
  - [JWT Authentication](#jwt-authentication)
  - [Logger](#logger)
  - [Rate Limiting](#rate-limiting)
- [Creating Custom Middleware](#creating-custom-middleware)

## Middleware Pattern

All middlewares in 0http-bun follow the standard pattern:

```typescript
import {ZeroRequest, StepFunction} from '0http-bun'

type Middleware = (
  req: ZeroRequest,
  next: StepFunction,
) => Promise<Response> | Response
```

### TypeScript Support

TypeScript type definitions are available for both the core framework and middleware modules:

```typescript
// Core framework types (from root module)
import {ZeroRequest, StepFunction, RequestHandler} from '0http-bun'

// Middleware-specific types (from middleware module)
import type {
  LoggerOptions,
  JWTAuthOptions,
  RateLimitOptions,
  RateLimitStore,
  MemoryStore,
  CORSOptions,
  BodyParserOptions,
} from '0http-bun/lib/middleware'

// Import middleware functions
import {
  createLogger,
  createJWTAuth,
  createRateLimit,
} from '0http-bun/lib/middleware'
```

## Built-in Middlewares

All middleware can be imported from the main middleware module:

```javascript
// Import all middleware from the middleware index
const {
  createBodyParser,
  createCORS,
  createJWTAuth,
  createLogger,
  createRateLimit,
} = require('0http-bun/lib/middleware')
```

For TypeScript:

```typescript
// Import middleware functions
import {
  createBodyParser,
  createCORS,
  createJWTAuth,
  createLogger,
  createRateLimit,
} from '0http-bun/lib/middleware'

// Import types
import type {
  BodyParserOptions,
  CORSOptions,
  JWTAuthOptions,
  LoggerOptions,
  RateLimitOptions,
} from '0http-bun/lib/middleware'
```

### Body Parser

Automatically parses request bodies based on Content-Type header.

```javascript
const {createBodyParser} = require('0http-bun/lib/middleware')

const router = http()

// Basic usage
router.use(createBodyParser())

// Access parsed body
router.post('/api/data', (req) => {
  console.log(req.body) // Parsed body content
  return Response.json({received: req.body})
})
```

**TypeScript Usage:**

```typescript
import {createBodyParser} from '0http-bun/lib/middleware'
import type {BodyParserOptions} from '0http-bun/lib/middleware'

// With custom configuration
const bodyParserOptions: BodyParserOptions = {
  json: {
    limit: 10 * 1024 * 1024, // 10MB
    strict: true,
  },
  urlencoded: {
    extended: true,
    limit: 1024 * 1024, // 1MB
  },
}

router.use(createBodyParser(bodyParserOptions))
```

**Supported Content Types:**

- `application/json` - Parsed as JSON
- `application/x-www-form-urlencoded` - Parsed as form data
- `multipart/form-data` - Parsed as FormData
- `text/*` - Parsed as plain text
- `application/octet-stream` - Parsed as ArrayBuffer

### CORS

Cross-Origin Resource Sharing middleware with flexible configuration.

```javascript
const {createCORS} = require('0http-bun/lib/middleware')

// Basic usage (allows all origins)
router.use(createCORS())

// Custom configuration
router.use(
  createCORS({
    origin: ['https://example.com', 'https://app.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400, // Preflight cache duration (seconds)
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
)

// Dynamic origin validation
router.use(
  createCORS({
    origin: (origin, req) => {
      // Custom logic to validate origin
      return (
        origin?.endsWith('.mycompany.com') || origin === 'http://localhost:3000'
      )
    },
  }),
)
```

**TypeScript Usage:**

```typescript
import {createCORS} from '0http-bun/lib/middleware'
import type {CORSOptions} from '0http-bun/lib/middleware'

const corsOptions: CORSOptions = {
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}

router.use(createCORS(corsOptions))
```

### JWT Authentication

JSON Web Token authentication and authorization middleware with support for static secrets, JWKS endpoints, and API key authentication.

#### Basic JWT with Static Secret

```javascript
const {createJWTAuth} = require('0http-bun/lib/middleware')

// Basic JWT verification with static secret
router.use(
  '/api/protected/*',
  createJWTAuth({
    secret: 'your-secret-key',
    algorithms: ['HS256'],
  }),
)
```

**TypeScript Usage:**

```typescript
import {createJWTAuth} from '0http-bun/lib/middleware'
import type {JWTAuthOptions} from '0http-bun/lib/middleware'

const jwtOptions: JWTAuthOptions = {
  secret: 'your-secret-key',
  jwtOptions: {
    algorithms: ['HS256'],
    audience: 'your-api',
    issuer: 'your-service',
  },
}

router.use('/api/protected/*', createJWTAuth(jwtOptions))
```

#### JWT with JWKS URI (Recommended for Production)

For production applications, especially when integrating with identity providers like Auth0, AWS Cognito, or Azure AD, use JWKS URI for automatic key rotation:

```typescript
// Using JWKS URI (Auth0 example)
router.use(
  '/api/protected/*',
  createJWTAuth({
    jwksUri: 'https://your-domain.auth0.com/.well-known/jwks.json',
    algorithms: ['RS256'],
    issuer: 'https://your-domain.auth0.com/',
    audience: 'your-api-identifier',
  }),
)

// AWS Cognito example
router.use(
  '/api/protected/*',
  createJWTAuth({
    jwksUri:
      'https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json',
    algorithms: ['RS256'],
    issuer: 'https://cognito-idp.{region}.amazonaws.com/{userPoolId}',
    audience: 'your-client-id',
  }),
)

// Azure AD example
router.use(
  '/api/protected/*',
  createJWTAuth({
    jwksUri: 'https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys',
    algorithms: ['RS256'],
    issuer: 'https://login.microsoftonline.com/{tenant}/v2.0',
    audience: 'your-application-id',
  }),
)

// Google Identity example
router.use(
  '/api/protected/*',
  createJWTAuth({
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    algorithms: ['RS256'],
    issuer: 'https://accounts.google.com',
    audience: 'your-client-id.apps.googleusercontent.com',
  }),
)
```

#### Advanced Configuration

```typescript
// Complete configuration example
router.use(
  createJWTAuth({
    // Option 1: Static secret (for development/simple cases)
    secret: process.env.JWT_SECRET,

    // Option 2: JWKS URI (recommended for production)
    jwksUri: process.env.JWKS_URI,

    // JWT verification options
    algorithms: ['HS256', 'RS256'],
    issuer: 'your-app',
    audience: 'your-users',
    clockTolerance: 10, // Clock skew tolerance (seconds)
    ignoreExpiration: false,
    ignoreNotBefore: false,

    // Custom token extraction
    getToken: (req) => {
      // Try multiple sources
      return (
        req.headers.get('x-auth-token') ||
        req.headers.get('authorization')?.replace('Bearer ', '') ||
        new URL(req.url).searchParams.get('token')
      )
    },

    // Alternative token sources
    tokenHeader: 'x-custom-token', // Custom header name
    tokenQuery: 'access_token', // Query parameter name

    // Error handling
    onError: (err, req) => {
      console.error('JWT Error:', err)
      return Response.json(
        {
          error: 'Unauthorized',
          code: err.name,
          message:
            process.env.NODE_ENV === 'development' ? err.message : undefined,
        },
        {status: 401},
      )
    },

    // Custom unauthorized response
    unauthorizedResponse: (error, req) => {
      return Response.json(
        {
          error: 'Access denied',
          requestId: req.headers.get('x-request-id'),
          timestamp: new Date().toISOString(),
        },
        {status: 401},
      )
    },

    // Optional authentication (proceed even without token)
    optional: false,

    // Exclude certain paths
    excludePaths: ['/health', '/metrics', '/api/public'],
  }),
)
```

#### API Key Authentication

The JWT middleware also supports API key authentication as an alternative or fallback:

```typescript
// API key with static keys
router.use(
  '/api/*',
  createJWTAuth({
    apiKeys: ['key1', 'key2', 'key3'],
    apiKeyHeader: 'x-api-key', // Default header
  }),
)

// API key with custom validation
router.use(
  '/api/*',
  createJWTAuth({
    apiKeyValidator: async (apiKey, req) => {
      // Custom validation logic
      const user = await validateApiKeyInDatabase(apiKey)
      return user ? {id: user.id, name: user.name, apiKey} : false
    },
    apiKeyHeader: 'x-api-key',
  }),
)

// Combined JWT + API Key authentication
router.use(
  '/api/*',
  createJWTAuth({
    // JWT configuration
    jwksUri: process.env.JWKS_URI,
    algorithms: ['RS256'],

    // API Key fallback
    apiKeys: process.env.API_KEYS?.split(','),
    apiKeyHeader: 'x-api-key',

    // If JWT fails, try API key
    optional: false,
  }),
)
```

#### Environment-Based Configuration

```typescript
// Dynamic configuration based on environment
const jwtConfig =
  process.env.NODE_ENV === 'production'
    ? {
        // Production: Use JWKS for security and key rotation
        jwksUri: process.env.JWKS_URI,
        algorithms: ['RS256'],
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      }
    : {
        // Development: Use static secret for simplicity
        secret: process.env.JWT_SECRET || 'dev-secret-key',
        algorithms: ['HS256'],
      }

router.use('/api/protected/*', createJWTAuth(jwtConfig))
```

#### Access Decoded Token Data

```typescript
// Access decoded token in route handlers
router.get('/api/profile', (req) => {
  // Multiple ways to access user data
  console.log(req.user) // Decoded JWT payload
  console.log(req.ctx.user) // Same as req.user
  console.log(req.jwt) // Full JWT info (payload, header, token)
  console.log(req.ctx.jwt) // Same as req.jwt

  // API key authentication data (if used)
  console.log(req.apiKey) // API key value
  console.log(req.ctx.apiKey) // Same as req.apiKey

  return Response.json({
    user: req.user,
    tokenInfo: {
      issuer: req.jwt?.payload.iss,
      audience: req.jwt?.payload.aud,
      expiresAt: new Date(req.jwt?.payload.exp * 1000),
      issuedAt: new Date(req.jwt?.payload.iat * 1000),
    },
  })
})
```

### Logger

Request logging middleware with customizable output formats.

```javascript
const {createLogger, simpleLogger} = require('0http-bun/lib/middleware')

// Simple logging
router.use(simpleLogger())

// Detailed logging with custom format
router.use(
  createLogger({
    pinoOptions: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {colorize: true},
      },
    },
    logBody: false,
    excludePaths: ['/health', '/metrics'],
  }),
)
```

**TypeScript Usage:**

```typescript
import {createLogger, simpleLogger} from '0http-bun/lib/middleware'
import type {LoggerOptions} from '0http-bun/lib/middleware'

const loggerOptions: LoggerOptions = {
  pinoOptions: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {colorize: true},
    },
  },
  logBody: true,
  excludePaths: ['/health', '/ping'],
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
    }),
  },
}

router.use(createLogger(loggerOptions))
```

**Available Formats:**

- `combined` - Apache Combined Log Format
- `common` - Apache Common Log Format
- `short` - Shorter than common, includes response time
- `tiny` - Minimal output
- `dev` - Development-friendly colored output

### Rate Limiting

Configurable rate limiting middleware with multiple store options.

```javascript
const {createRateLimit, MemoryStore} = require('0http-bun/lib/middleware')

// Basic rate limiting
router.use(
  createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per windowMs
  }),
)

// Advanced configuration
router.use(
  createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Max requests
    keyGenerator: (req) => {
      // Custom key generation (default: IP address)
      return req.headers.get('x-user-id') || req.headers.get('x-forwarded-for')
    },
    skip: (req) => {
      // Skip rate limiting for certain requests
      return req.url.startsWith('/health')
    },
    handler: (req, totalHits, max, resetTime) => {
      // Custom rate limit exceeded response
      return Response.json(
        {
          error: 'Rate limit exceeded',
          resetTime: resetTime.toISOString(),
          retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
        },
        {status: 429},
      )
    },
    standardHeaders: true, // Send X-RateLimit-* headers
    excludePaths: ['/health', '/metrics'],
  }),
)

// Custom store (for distributed systems)
router.use(
  createRateLimit({
    store: new MemoryStore(), // Built-in memory store
    // Or implement custom store with increment() method
  }),
)
```

**TypeScript Usage:**

```typescript
import {createRateLimit, MemoryStore} from '0http-bun/lib/middleware'
import type {RateLimitOptions, RateLimitStore} from '0http-bun/lib/middleware'

const rateLimitOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => {
    return (
      req.headers.get('x-user-id') ||
      req.headers.get('x-forwarded-for') ||
      'anonymous'
    )
  },
  standardHeaders: true,
  excludePaths: ['/health', '/ping'],
}

router.use(createRateLimit(rateLimitOptions))

// Custom store implementation
class CustomStore implements RateLimitStore {
  async increment(
    key: string,
    windowMs: number,
  ): Promise<{totalHits: number; resetTime: Date}> {
    // Custom implementation
    return {totalHits: 1, resetTime: new Date(Date.now() + windowMs)}
  }
}
```

#### Sliding Window Rate Limiter

For more precise rate limiting, use the sliding window implementation that **prevents burst traffic** at any point in time:

```javascript
const {createSlidingWindowRateLimit} = require('0http-bun/lib/middleware')

// Basic sliding window rate limiter
router.use(
  createSlidingWindowRateLimit({
    windowMs: 60 * 1000, // 1 minute sliding window
    max: 10, // Max 10 requests per minute
    keyGenerator: (req) => req.headers.get('x-forwarded-for') || 'default',
  }),
)
```

**TypeScript Usage:**

```typescript
import {createSlidingWindowRateLimit} from '0http-bun/lib/middleware'
import type {RateLimitOptions} from '0http-bun/lib/middleware'

const slidingOptions: RateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests max
  keyGenerator: (req) => req.user?.id || req.headers.get('x-forwarded-for'),
  handler: (req, hits, max, resetTime) => {
    return Response.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
        limit: max,
        used: hits,
      },
      {status: 429},
    )
  },
}

router.use(createSlidingWindowRateLimit(slidingOptions))
```

**How Sliding Window Differs from Fixed Window:**

The sliding window approach provides **more accurate and fair rate limiting** by tracking individual request timestamps:

- **Fixed Window**: Divides time into discrete chunks (e.g., 09:00:00-09:00:59, 09:01:00-09:01:59)
  - ⚠️ **Problem**: Allows burst traffic at window boundaries (20 requests in 2 seconds)
- **Sliding Window**: Uses a continuous, moving time window from current moment
  - ✅ **Advantage**: Prevents bursts at any point in time (true rate limiting)

**Use Cases for Sliding Window:**

```javascript
// Financial API - Zero tolerance for payment bursts
router.use(
  '/api/payments/*',
  createSlidingWindowRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // Only 3 payment attempts per minute
    keyGenerator: (req) => req.user.accountId,
  }),
)

// User Registration - Prevent automated signups
router.use(
  '/api/register',
  createSlidingWindowRateLimit({
    windowMs: 3600 * 1000, // 1 hour
    max: 3, // 3 accounts per IP per hour
    keyGenerator: (req) => req.headers.get('x-forwarded-for'),
  }),
)

// File Upload - Prevent abuse
router.use(
  '/api/upload',
  createSlidingWindowRateLimit({
    windowMs: 300 * 1000, // 5 minutes
    max: 10, // 10 uploads per 5 minutes
    keyGenerator: (req) => req.user.id,
  }),
)
```

**Performance Considerations:**

- **Memory Usage**: Higher than fixed window (stores timestamp arrays)
- **Time Complexity**: O(n) per request where n = requests in window
- **Best For**: Critical APIs, financial transactions, user-facing features
- **Use Fixed Window For**: High-volume APIs where approximate limiting is acceptable

**Advanced Configuration:**

```typescript
// Tiered rate limiting based on user level
const createTieredRateLimit = (req) => {
  const userTier = req.user?.tier || 'free'
  const configs = {
    free: {windowMs: 60 * 1000, max: 10},
    premium: {windowMs: 60 * 1000, max: 100},
    enterprise: {windowMs: 60 * 1000, max: 1000},
  }
  return createSlidingWindowRateLimit(configs[userTier])
}
```

**Rate Limit Headers:**

Both rate limiters send the following headers when `standardHeaders: true`:

- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)
- `X-RateLimit-Used` - Used requests

**Error Handling:**

Rate limiting middleware allows errors to bubble up as proper HTTP 500 responses. If your `keyGenerator` function or custom `store.increment()` method throws an error, it will not be caught and masked - the error will propagate up the middleware chain for proper error handling.

## Creating Custom Middleware

### Basic Middleware

```typescript
import {ZeroRequest, StepFunction} from '0http-bun'

const customMiddleware = (req: ZeroRequest, next: StepFunction) => {
  // Pre-processing
  req.ctx = req.ctx || {}
  req.ctx.startTime = Date.now()

  // Continue to next middleware/handler
  const response = next()

  // Post-processing (if needed)
  return response
}

router.use(customMiddleware)
```

### Async Middleware

```typescript
const asyncMiddleware = async (req: ZeroRequest, next: StepFunction) => {
  // Async pre-processing
  const user = await validateUserSession(req)
  req.ctx = {user}

  // Continue
  const response = await next()

  // Async post-processing
  await logUserActivity(user, req.url)

  return response
}
```

### Error Handling in Middleware

```typescript
const errorHandlingMiddleware = async (
  req: ZeroRequest,
  next: StepFunction,
) => {
  try {
    return await next()
  } catch (error) {
    console.error('Middleware error:', error)

    // Return error response
    return Response.json(
      {
        error: 'Internal server error',
        message:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      {status: 500},
    )
  }
}
```

## Middleware Execution Order

Middlewares execute in the order they are registered:

```typescript
router.use(middleware1) // Executes first
router.use(middleware2) // Executes second
router.use(middleware3) // Executes third

router.get('/test', handler) // Final handler
```

## Path-Specific Middleware

Apply middleware only to specific paths:

```typescript
// API-only middleware
router.use('/api/*', jwtAuth({secret: 'api-secret'}))
router.use('/api/*', rateLimit({max: 1000}))

// Admin-only middleware
router.use('/admin/*', adminAuthMiddleware)
router.use('/admin/*', auditLogMiddleware)

// Public paths (no auth required)
router.get('/health', healthCheckHandler)
router.get('/metrics', metricsHandler)
```

## Best Practices

1. **Order Matters**: Place security middleware (CORS, auth) before business logic
2. **Error Handling**: Always handle errors in async middleware
3. **Performance**: Use `skip` functions to avoid unnecessary processing
4. **Context**: Use `req.ctx` to pass data between middlewares
5. **Immutability**: Don't modify the original request object directly
6. **Logging**: Log middleware errors for debugging
7. **Testing**: Test middleware in isolation with mock requests

## Examples

### Complete Middleware Stack

```typescript
const {
  createCORS,
  createLogger,
  createBodyParser,
  createJWTAuth,
  createRateLimit,
} = require('0http-bun/lib/middleware')

const router = http()

// 1. CORS (handle preflight requests first)
router.use(
  createCORS({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  }),
)

// 2. Logging (log all requests)
router.use(createLogger({format: 'combined'}))

// 3. Rate limiting (protect against abuse)
router.use(
  createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
  }),
)

// 4. Body parsing (parse request bodies)
router.use(createBodyParser({limit: '10mb'}))

// 5. Authentication (protect API routes)
router.use(
  '/api/*',
  createJWTAuth({
    secret: process.env.JWT_SECRET,
    skip: (req) => req.url.includes('/api/public/'),
  }),
)

// Routes
router.get('/api/public/status', () => Response.json({status: 'ok'}))
router.get('/api/protected/data', (req) => Response.json({user: req.user}))
```

This middleware stack provides a solid foundation for most web applications with security, logging, and performance features built-in.
