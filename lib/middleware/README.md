# Middleware Documentation

0http-bun provides a comprehensive middleware system with built-in middlewares for common use cases. All middleware functions are TypeScript-ready and follow the standard middleware pattern.

## Dependency Installation

⚠️ **Important**: Starting with v1.2.2, middleware dependencies are now **optional** and must be installed separately when needed. This reduces the framework's footprint and improves startup performance through lazy loading.

Install only the dependencies you need:

```bash
# For JWT Authentication middleware
bun install jose

# For Logger middleware
bun install pino

# For Prometheus Metrics middleware
bun install prom-client
```

**Benefits of Lazy Loading:**

- 📦 **Smaller Bundle**: Only install what you use
- ⚡ **Faster Startup**: Dependencies loaded only when middleware is used
- 💾 **Lower Memory**: Reduced initial memory footprint
- 🔧 **Better Control**: Explicit dependency management

## Table of Contents

- [Middleware Pattern](#middleware-pattern)
- [Built-in Middlewares](#built-in-middlewares)
  - [Body Parser](#body-parser)
  - [CORS](#cors)
  - [JWT Authentication](#jwt-authentication)
  - [Logger](#logger)
  - [Prometheus Metrics](#prometheus-metrics)
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
  createPrometheusIntegration,
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
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
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
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
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

> ✅ **No additional dependencies required** - Uses Bun's built-in parsing capabilities.

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

- `application/json` - Parsed as JSON (strict matching; `application/xml` and other `application/*` types are no longer routed to the JSON parser)
- `application/x-www-form-urlencoded` - Parsed as form data
- `multipart/form-data` - Parsed as FormData
- `text/*` - Parsed as plain text
- `application/octet-stream` - Parsed as ArrayBuffer

**Security Features:**

- **JSON nesting depth limit** (max 100) with string-aware scanning — brace characters inside JSON strings do not count toward the depth limit
- **Prototype pollution protection** — multipart body and files objects use `Object.create(null)`, and dangerous property names (`__proto__`, `constructor`, `prototype`, etc.) are blocked
- **Multipart filename sanitization** — strips `..`, path separators (`/`, `\`), null bytes, and leading dots. The original filename is preserved in `file.originalName`
- **Size limit validation** — `parseLimit()` throws `TypeError` for unexpected types (e.g., `null`, `false`, objects) instead of silently defaulting to 1MB
- **Custom `jsonParser` safety** — when a custom `jsonParser` function is provided, size limits are enforced before the parser is called
- **Empty body handling** — empty or whitespace-only JSON bodies set `req.body` to `undefined` instead of silently returning `{}`
- **Raw body via Symbol** — raw body text is stored via a Symbol (`RAW_BODY_SYMBOL`) instead of a public string property, preventing accidental serialization/logging

**Accessing Raw Body:**

```javascript
import {RAW_BODY_SYMBOL} from '0http-bun/lib/middleware/body-parser'

router.post('/webhook', (req) => {
  const rawBody = req[RAW_BODY_SYMBOL] // Symbol.for('0http.rawBody')
  // Use rawBody for signature verification, etc.
})
```

**Verify Function:**

When using the `verify` option with `createBodyParser`, the raw body is available via the same symbol:

```javascript
const bodyParser = createBodyParser({
  verify: (req, rawBody) => {
    // rawBody is the raw string before parsing
    const signature = req.headers.get('x-signature')
    if (!verifySignature(rawBody, signature)) {
      throw new Error('Invalid signature')
    }
  },
  // Note: any JSON parsing behavior (such as deferNext) is handled internally when verify is set.
})
```

### CORS

Cross-Origin Resource Sharing middleware with flexible configuration.

> ✅ **No additional dependencies required** - Built-in CORS implementation.

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
// NOTE: null and missing origins are automatically rejected before calling the
// validator function, preventing bypass via sandboxed iframes.
router.use(
  createCORS({
    origin: (origin, req) => {
      // Custom logic to validate origin
      // `origin` is guaranteed to be a non-null, non-'null' string here
      return (
        origin?.endsWith('.mycompany.com') || origin === 'http://localhost:3000'
      )
    },
  }),
)
```

**Security behavior:**

- When an origin is **not allowed**, CORS headers (methods, allowed headers, credentials, exposed headers) are **not set** on the response. Only `Vary: Origin` is added.
- `null` origins (from sandboxed iframes, `file://` URLs, etc.) are **rejected** for array and function origin configurations.
- `Vary: Origin` is set for all non-wildcard origin configurations to prevent CDN cache poisoning.
- Wildcard (`*`) origins with `credentials: true` are blocked (CORS spec requirement).

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

> 📦 **Required dependency**: `bun install jose`

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
    // IMPORTANT: Do NOT mix symmetric (HS*) and asymmetric (RS*/ES*/PS*) algorithms.
    // Use HS256 with static secrets, or RS256/ES256 with JWKS URIs.
    algorithms: ['HS256'],
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
        req.headers.get('authorization')?.replace('Bearer ', '')
      )
    },

    // Alternative token sources
    tokenHeader: 'x-custom-token', // Custom header name
    tokenQuery: 'access_token', // Query parameter name (see security note below)

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
    // When optional: true, invalid tokens set req.ctx.authError and req.ctx.authAttempted = true
    optional: false,

    // Exclude certain paths (uses exact match or path boundary, NOT prefix matching)
    // e.g., '/health' excludes '/health' and '/health/...' but NOT '/healthcheck'
    excludePaths: ['/health', '/metrics', '/api/public'],

    // Token type validation (validates the JWT 'typ' header claim)
    // Case-insensitive comparison. Rejects tokens with missing or incorrect type.
    requiredTokenType: 'JWT', // or 'at+jwt' for access tokens, etc.
  }),
)
```

> **Security Note on `tokenQuery`:** Passing JWTs via query parameters exposes tokens in server logs, browser history, and HTTP `Referer` headers. Prefer header-based token extraction in production.

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

// Access the raw API key (req.apiKey is masked for security)
import {API_KEY_SYMBOL} from '0http-bun/lib/middleware/jwt-auth'

router.get('/api/data', (req) => {
  console.log(req.apiKey) // 'xxxx****xxxx' (masked, safe for logging)
  console.log(req[API_KEY_SYMBOL]) // Raw API key via Symbol.for('0http.apiKey')
})

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
  // Decoded JWT payload
  console.log(req.user) // Decoded JWT payload
  console.log(req.ctx.user) // Same as req.user

  // JWT header and payload (raw token is NOT included for security)
  console.log(req.jwt) // { payload, header }
  console.log(req.ctx.jwt) // Same as req.jwt

  // API key authentication data (if used)
  console.log(req.apiKey) // Masked API key (xxxx****xxxx)
  console.log(req.ctx.apiKey) // Same as req.apiKey (masked)

  // Optional mode: check if auth was attempted but failed
  if (req.ctx.authAttempted && req.ctx.authError) {
    console.log('Auth failed:', req.ctx.authError)
  }

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

> 📦 **Required dependency for structured logging**: `bun install pino`  
> ✅ **Simple logger** (`simpleLogger`) has no dependencies - uses `console.log`

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

### Prometheus Metrics

Comprehensive Prometheus metrics integration for monitoring and observability with built-in security and performance optimizations.

> 📦 **Required dependency**: `bun install prom-client`

```javascript
const {
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
} = require('0http-bun/lib/middleware')

// Simple setup with default metrics
const prometheus = createPrometheusIntegration()

router.use(prometheus.middleware)
router.get('/metrics', prometheus.metricsHandler)
```

#### Default Metrics Collected

The Prometheus middleware automatically collects:

- **HTTP Request Duration** - Histogram of request durations in seconds (buckets: 0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5, 10)
- **HTTP Request Count** - Counter of total requests by method, route, and status
- **HTTP Request Size** - Histogram of request body sizes (buckets: 1B, 10B, 100B, 1KB, 10KB, 100KB, 1MB, 10MB)
- **HTTP Response Size** - Histogram of response body sizes (buckets: 1B, 10B, 100B, 1KB, 10KB, 100KB, 1MB, 10MB)
- **Active Connections** - Gauge of currently active HTTP connections
- **Node.js Metrics** - Memory usage, CPU, garbage collection (custom buckets), event loop lag (5ms precision)

#### Advanced Configuration

```javascript
const {
  createPrometheusMiddleware,
  createMetricsHandler,
  createPrometheusIntegration,
} = require('0http-bun/lib/middleware')

const prometheus = createPrometheusIntegration({
  // Control default Node.js metrics collection
  collectDefaultMetrics: true,

  // Exclude paths from metrics collection (optimized for performance)
  excludePaths: ['/health', '/ping', '/favicon.ico'],

  // Skip certain HTTP methods
  skipMethods: ['OPTIONS'],

  // Custom route normalization with security controls
  normalizeRoute: (req) => {
    const url = new URL(req.url, 'http://localhost')
    return url.pathname
      .replace(/\/users\/\d+/, '/users/:id')
      .replace(/\/api\/v\d+/, '/api/:version')
  },

  // Add custom labels with automatic sanitization
  extractLabels: (req, response) => {
    return {
      user_type: req.headers.get('x-user-type') || 'anonymous',
      api_version: req.headers.get('x-api-version') || 'v1',
    }
  },

  // Use custom metrics object instead of default metrics
  metrics: customMetricsObject,
})
```

#### Custom Business Metrics

```javascript
const {createPrometheusIntegration} = require('0http-bun/lib/middleware')

// Get the prometheus client from the integration
const prometheus = createPrometheusIntegration()
const {promClient} = prometheus

// Create custom metrics
const orderCounter = new promClient.Counter({
  name: 'orders_total',
  help: 'Total number of orders processed',
  labelNames: ['status', 'payment_method'],
})

const orderValue = new promClient.Histogram({
  name: 'order_value_dollars',
  help: 'Value of orders in dollars',
  labelNames: ['payment_method'],
  buckets: [10, 50, 100, 500, 1000, 5000],
})

// Use in your routes
router.post('/orders', async (req) => {
  const order = await processOrder(req.body)

  // Record custom metrics
  orderCounter.inc({
    status: order.status,
    payment_method: order.payment_method,
  })

  if (order.status === 'completed') {
    orderValue.observe(
      {
        payment_method: order.payment_method,
      },
      order.amount,
    )
  }

  return Response.json(order)
})
```

#### Metrics Endpoint Options

```javascript
const {createMetricsHandler} = require('0http-bun/lib/middleware')

// Custom metrics endpoint
const metricsHandler = createMetricsHandler({
  endpoint: '/custom-metrics', // Default: '/metrics'
  registry: customRegistry, // Default: promClient.register
})

router.get('/custom-metrics', metricsHandler)
```

#### Route Normalization & Security

The middleware automatically normalizes routes and implements security measures to prevent high cardinality and potential attacks:

```javascript
// URLs like these:
// /users/123, /users/456, /users/789
// Are normalized to: /users/:id

// /products/abc-123, /products/def-456
// Are normalized to: /products/:slug

// /api/v1/data, /api/v2/data
// Are normalized to: /api/:version/data

// Route sanitization examples:
// /users/:id → _users__id (special characters replaced with underscores)
// /api/v1/orders → _api_v1_orders
// Very long tokens → _api__token (pattern-based normalization)
```

**Route Sanitization:**

- Special characters (`/`, `:`, etc.) are replaced with underscores (`_`) for Prometheus compatibility
- UUIDs are automatically normalized to `:id` patterns
- Long tokens (>20 characters) are normalized to `:token` patterns
- Numeric IDs are normalized to `:id` patterns
- Route complexity is limited to 10 segments maximum

**Security Features:**

- **Label Sanitization**: Removes potentially dangerous characters from metric labels and truncates values to 100 characters
- **Cardinality Limits**: Prevents memory exhaustion from too many unique metric combinations
- **Route Complexity Limits**: Caps the number of route segments to 10 to prevent DoS attacks
- **Size Limits**: Limits request/response body size processing (up to 100MB) to prevent memory issues
- **Header Processing Limits**: Caps the number of headers processed per request (50 for requests, 20 for responses)
- **URL Processing**: Handles both full URLs and pathname-only URLs with proper fallback handling

#### Performance Optimizations

- **Fast Path for Excluded Routes**: Bypasses all metric collection for excluded paths with smart URL parsing
- **Lazy Evaluation**: Only processes metrics when actually needed
- **Efficient Size Calculation**: Optimized request/response size measurement with capping at 1MB estimation
- **Error Handling**: Graceful handling of malformed URLs and invalid data with fallback mechanisms
- **Header Count Limits**: Prevents excessive header processing overhead (50 request headers, 20 response headers)
- **Smart URL Parsing**: Handles both full URLs and pathname-only URLs efficiently

#### Production Considerations

- **Performance**: Adds <1ms overhead per request with optimized fast paths
- **Memory**: Metrics stored in memory with cardinality controls; use recording rules for high cardinality
- **Security**: Built-in protections against label injection and cardinality bombs
- **Cardinality**: Automatic limits prevent high cardinality issues
- **Monitoring**: Consider protecting `/metrics` endpoint in production

#### Integration with Monitoring

```yaml
# prometheus.yml
scrape_configs:
  - job_name: '0http-bun-app'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 15s
    metrics_path: /metrics
```

#### Troubleshooting

**Common Issues:**

- **High Memory Usage**: Check for high cardinality metrics. Route patterns should be normalized (e.g., `/users/:id` not `/users/12345`)
- **Missing Metrics**: Ensure paths aren't in `excludePaths` and HTTP methods aren't in `skipMethods`
- **Route Sanitization**: Routes are automatically sanitized (special characters become underscores: `/users/:id` → `_users__id`)
- **URL Parsing Errors**: The middleware handles both full URLs and pathname-only URLs with graceful fallback

**Performance Tips:**

- Use `excludePaths` for health checks and static assets
- Consider using `skipMethods` for OPTIONS requests
- Monitor memory usage in production for metric cardinality
- Use Prometheus recording rules for high-cardinality aggregations

### Rate Limiting

Configurable rate limiting middleware with multiple store options.

> ✅ **No additional dependencies required** - Uses built-in memory store.

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
      // Custom key generation
      // Default uses: req.ip || req.remoteAddress || 'unknown'
      // NOTE: Proxy headers are NOT trusted by default. If behind a
      // reverse proxy, you MUST provide a custom keyGenerator:
      return (
        req.headers.get('x-user-id') ||
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown'
      )
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
    // standardHeaders options:
    //   true     - full headers (X-RateLimit-Limit, Remaining, Reset, Used) — default
    //   false    - no rate limit headers
    //   'minimal' - only Retry-After on 429 responses (hides exact config/counters)
    // excludePaths uses exact match or boundary matching (NOT prefix)
    // e.g., '/health' matches '/health' and '/health/...' but NOT '/healthcheck'
    excludePaths: ['/health', '/metrics'],
  }),
)

// Custom store (for distributed systems)
router.use(
  createRateLimit({
    store: new MemoryStore(), // Built-in memory store
    // Or implement custom store with increment() method
    // Note: The store is always the constructor-configured instance.
    // It cannot be overridden at runtime via the request object.
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
    // Default: req.ip || req.remoteAddress || 'unknown'
    // Custom: read from proxy-set header if behind a reverse proxy
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown'
    )
  },
  standardHeaders: true,
  excludePaths: ['/health', '/ping'],
}

router.use(createRateLimit(rateLimitOptions))

// Custom store implementation
class CustomStore implements RateLimitStore {
  // Note: For MemoryStore, increment is synchronous to prevent TOCTOU races.
  // Custom stores may be async if using external backends (e.g., Redis).
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
    maxKeys: 10000, // Maximum tracked keys (default: 10000) — prevents unbounded memory growth
    keyGenerator: (req) => req.ip || req.remoteAddress || 'unknown',
  }),
)
```

> **Memory safety:** The sliding window rate limiter enforces a `maxKeys` limit (default: 10,000). When the limit is exceeded, the oldest entry is evicted. A periodic cleanup interval runs at most every 60 seconds (or `windowMs`, whichever is shorter) and uses `unref()` so it doesn't prevent process exit.

**TypeScript Usage:**

```typescript
import {createSlidingWindowRateLimit} from '0http-bun/lib/middleware'
import type {RateLimitOptions} from '0http-bun/lib/middleware'

const slidingOptions: RateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests max
  maxKeys: 10000, // Max tracked keys (default: 10000)
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
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
    keyGenerator: (req) => req.ip || req.remoteAddress || 'unknown',
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

- **Memory Usage**: Higher than fixed window (stores timestamp arrays), bounded by `maxKeys` (default: 10,000)
- **Time Complexity**: O(n) per request where n = requests in window
- **Cleanup**: Automatic periodic cleanup runs at most every 60 seconds; interval uses `unref()` to not prevent process exit
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

When `standardHeaders: 'minimal'`, only `Retry-After` is sent on 429 responses. This prevents disclosing exact rate limit configuration and usage counters to clients.

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
router.use('/api/*', createJWTAuth({secret: 'api-secret'}))
router.use('/api/*', createRateLimit({max: 1000}))

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
// NOTE: Default key generator uses req.ip — provide keyGenerator if behind a proxy
router.use(
  createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    // keyGenerator: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown',
  }),
)

// 4. Body parsing (parse request bodies)
router.use(createBodyParser({limit: '10mb'}))

// 5. Authentication (protect API routes)
// Default algorithms: ['HS256'] — specify ['RS256'] for asymmetric keys
router.use(
  '/api/*',
  createJWTAuth({
    secret: process.env.JWT_SECRET,
  }),
)

// Routes
router.get('/api/public/status', () => Response.json({status: 'ok'}))
router.get('/api/protected/data', (req) => Response.json({user: req.user}))
```

## Dependency Summary

For your convenience, here's a quick reference of which dependencies you need to install for each middleware:

| Middleware              | Dependencies Required | Install Command           |
| ----------------------- | --------------------- | ------------------------- |
| **Body Parser**         | ✅ None               | Built-in                  |
| **CORS**                | ✅ None               | Built-in                  |
| **Rate Limiting**       | ✅ None               | Built-in                  |
| **Logger** (simple)     | ✅ None               | Built-in                  |
| **Logger** (structured) | 📦 `pino`             | `bun install pino`        |
| **JWT Authentication**  | 📦 `jose`             | `bun install jose`        |
| **Prometheus Metrics**  | 📦 `prom-client`      | `bun install prom-client` |

**Install all optional dependencies at once:**

```bash
bun install pino jose prom-client
```

This middleware stack provides a solid foundation for most web applications with security, logging, and performance features built-in.
