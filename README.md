# 0http-bun

[![npm version](https://img.shields.io/npm/v/0http-bun?style=flat-square)](https://www.npmjs.com/package/0http-bun)
[![license](https://img.shields.io/npm/l/0http-bun?style=flat-square)](https://github.com/BackendStack21/0http-bun/blob/main/LICENSE)

A high-performance, minimalist HTTP framework for [Bun](https://bun.sh/), inspired by [0http](https://0http.21no.de/#/). Built specifically to leverage Bun's native performance capabilities with a developer-friendly API.

> Landing page: [0http-bun.21no.de](https://0http-bun.21no.de)

> **v1.3.0** includes a comprehensive security hardening release. See the [Changelog](#changelog) and [Migration Guide](#migrating-to-v130) sections below.

## ✨ Why Choose 0http-bun?

0http-bun combines the simplicity of Express with the raw performance of Bun's runtime, delivering a framework that's both **blazingly fast** and **secure by design**. Perfect for everything from quick prototypes to production-grade APIs.

### 🚀 Unmatched Performance

- **Bun-Native Optimization**: Built specifically for Bun's runtime with zero overhead
- **Lightning-Fast Routing**: Based on the proven `trouter` library with intelligent caching
- **Memory Efficient**: Smart object reuse and minimal allocations
- **Optimized Parsing**: Uses `fast-querystring` for lightning-quick query string handling

### 🎯 Developer Experience

- **TypeScript First**: Full type safety with comprehensive definitions
- **Intuitive API**: Clean, expressive syntax that's easy to learn
- **Flexible Middleware**: Powerful async/await middleware system
- **Web Standards**: Built on standard Request/Response APIs

### 🛡️ Security by Default

- **Production-Ready Security**: Built-in protection against common vulnerabilities
- **Input Validation**: Comprehensive sanitization and size limits
- **Attack Prevention**: Prototype pollution, ReDoS, and DoS protection
- **Secure Defaults**: Safe error handling and CORS configuration

## Key Benefits

- **🚀 Bun-Native Performance**: Optimized for Bun's runtime with minimal overhead
- **🔧 TypeScript First**: Full TypeScript support with comprehensive type definitions
- **🎯 Minimalist API**: Clean, intuitive API that's easy to learn and use
- **🔄 Middleware Support**: Flexible middleware system with async/await support
- **📦 Tiny Footprint**: Lightweight framework focused on performance
- **🛡️ Web Standards**: Built on standard Web APIs (Request/Response)

## Installation

```bash
bun add 0http-bun
```

## Quick Start

### Basic Server

```typescript
import http from '0http-bun'

const {router} = http()

router.get('/', () => {
  return new Response('Hello World!')
})

router.get('/:id', (req) => {
  return Response.json({id: req.params.id})
})

// Start the server
Bun.serve({
  port: 3000,
  fetch: router.fetch,
})
```

### With TypeScript Types

```typescript
import http, {ZeroRequest, StepFunction} from '0http-bun'

const {router} = http({
  port: 3000,
  errorHandler: (err: Error) => {
    console.error('Server error:', err)
    return new Response('Internal Server Error', {status: 500})
  },
})

// Typed middleware
router.use((req: ZeroRequest, next: StepFunction) => {
  req.ctx = {
    startTime: Date.now(),
    engine: 'bun',
  }
  return next()
})

// Typed route handlers
router.get('/:id', async (req: ZeroRequest) => {
  return Response.json({
    id: req.params.id,
    context: req.ctx,
  })
})

router.post('/users', async (req: ZeroRequest) => {
  const body = await req.json()
  return Response.json({created: true, data: body}, {status: 201})
})
```

## API Reference

### Router Configuration

```typescript
interface IRouterConfig {
  defaultRoute?: RequestHandler // Custom 404 handler
  errorHandler?: (err: Error) => Response | Promise<Response> // Error handler
  port?: number // Port number (for reference)
  cacheSize?: number // Max entries per HTTP method in the route cache (default: 1000)
}
```

> **Note on `cacheSize`:** The router uses an LRU-style cache for resolved routes. When the cache exceeds `cacheSize` entries for a given HTTP method, the oldest entry is evicted. The default of `1000` is suitable for most applications. Increase it for APIs with many dynamic routes; decrease it to save memory in constrained environments.

### Request Object

The `ZeroRequest` extends the standard `Request` with additional properties:

```typescript
type ZeroRequest = Request & {
  params: Record<string, string> // URL parameters
  query: Record<string, string> // Query string parameters
  ctx?: Record<string, any> // Custom context (set by middleware)
}
```

### Route Methods

```typescript
// HTTP Methods
router.get(pattern, ...handlers)
router.post(pattern, ...handlers)
router.put(pattern, ...handlers)
router.patch(pattern, ...handlers)
router.delete(pattern, ...handlers)
router.head(pattern, ...handlers)
router.options(pattern, ...handlers)
router.connect(pattern, ...handlers)
router.trace(pattern, ...handlers)

// Generic method
router.on(method, pattern, ...handlers)

// All methods
router.all(pattern, ...handlers)
```

### Middleware

```typescript
// Global middleware
router.use((req, next) => {
  // Middleware logic
  return next()
})

// Path-specific middleware
router.use('/api/*', (req, next) => {
  // API-specific middleware
  return next()
})

// Multiple middlewares
router.use(authMiddleware, loggingMiddleware, (req, next) => next())
```

## Examples

### Complete REST API

```typescript
import http, {ZeroRequest, StepFunction} from '0http-bun'

const {router} = http({
  errorHandler: (err: Error) => {
    return Response.json({error: err.message}, {status: 500})
  },
})

// Logging middleware
router.use((req: ZeroRequest, next: StepFunction) => {
  console.log(`${req.method} ${req.url}`)
  return next()
})

// JSON body parser middleware for POST/PUT
router.use('/api/*', async (req: ZeroRequest, next: StepFunction) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      req.ctx = {...req.ctx, body: await req.json()}
    } catch (err) {
      return Response.json({error: 'Invalid JSON'}, {status: 400})
    }
  }
  return next()
})

// Routes
router.get('/api/users', () => {
  return Response.json([
    {id: 1, name: 'John'},
    {id: 2, name: 'Jane'},
  ])
})

router.get('/api/users/:id', (req: ZeroRequest) => {
  const {id} = req.params
  return Response.json({id: Number(id), name: 'User'})
})

router.post('/api/users', (req: ZeroRequest) => {
  const userData = req.ctx?.body
  return Response.json({id: Date.now(), ...userData}, {status: 201})
})

router.delete('/api/users/:id', (req: ZeroRequest) => {
  const {id} = req.params
  return Response.json({deleted: id})
})

// Start server
Bun.serve({
  port: 3000,
  fetch: router.fetch,
})
```

## Middleware Support

0http-bun includes a comprehensive middleware system with built-in middlewares for common use cases:

> 📦 **Note**: Starting with v1.2.2, some middleware dependencies are optional. Install only what you need: `jose` (JWT), `pino` (Logger), `prom-client` (Prometheus).

- **[Body Parser](./lib/middleware/README.md#body-parser)** - Automatic request body parsing (JSON, form data, text)
- **[CORS](./lib/middleware/README.md#cors)** - Cross-Origin Resource Sharing with flexible configuration
- **[JWT Authentication](./lib/middleware/README.md#jwt-authentication)** - JSON Web Token authentication and authorization
- **[Logger](./lib/middleware/README.md#logger)** - Request logging with multiple output formats
- **[Rate Limiting](./lib/middleware/README.md#rate-limiting)** - Flexible rate limiting with sliding window support
- **[Prometheus Metrics](./lib/middleware/README.md#prometheus-metrics)** - Export metrics for monitoring and alerting

### Quick Example

```javascript
// Import middleware functions from the middleware module
const {
  createCORS,
  createLogger,
  createBodyParser,
  createJWTAuth,
  createRateLimit,
} = require('0http-bun/lib/middleware')

const {router} = http()

// Apply middleware stack
router.use(createCORS()) // Enable CORS
router.use(createLogger()) // Request logging
router.use(createBodyParser()) // Parse request bodies
router.use(createRateLimit({max: 100})) // Rate limiting

// Protected routes
router.use('/api/*', createJWTAuth({secret: process.env.JWT_SECRET}))
```

📖 **[Complete Middleware Documentation](./lib/middleware/README.md)**

### Error Handling

The default error handler returns a generic `"Internal Server Error"` response (HTTP 500) and logs the full error to `console.error`. This prevents leaking stack traces or internal details to clients.

You can provide a custom `errorHandler` for more control:

```typescript
import http, {ZeroRequest} from '0http-bun'

const {router} = http({
  errorHandler: (err: Error) => {
    console.error('Application error:', err)

    // Custom error responses based on error type
    if (err.name === 'ValidationError') {
      return Response.json(
        {error: 'Validation failed', details: err.message},
        {status: 400},
      )
    }

    return Response.json({error: 'Internal server error'}, {status: 500})
  },
  defaultRoute: () => {
    return Response.json({error: 'Route not found'}, {status: 404})
  },
})

// Errors thrown in both sync and async handlers are caught automatically
router.get('/api/risky', async (req: ZeroRequest) => {
  const data = await fetchExternalData() // async errors are caught too
  if (!data) {
    throw new Error('Data not found')
  }
  return Response.json(data)
})
```

> **Async error handling:** Errors thrown or rejected in async middleware/handlers are automatically caught and forwarded to the `errorHandler`. You do not need to wrap every handler in try/catch.

## Security

0http-bun is designed with **security-first principles** and includes comprehensive protection against common web vulnerabilities. The core framework and middleware have been thoroughly penetration-tested and hardened.

### Built-in Security Features

#### **Input Validation & Sanitization**

- **Size Limits**: Configurable limits prevent memory exhaustion attacks
- **ReDoS Protection**: Restrictive regex patterns prevent Regular Expression DoS
- **JSON Security**: String-aware nesting depth validation and safe parsing
- **Parameter Validation**: Maximum parameter counts and length restrictions
- **Filename Sanitization**: Multipart file uploads are sanitized to prevent path traversal (directory separators, `..`, null bytes are stripped; `originalName` preserved for reference)

#### **Attack Prevention**

- **Prototype Pollution Protection**: Filters dangerous keys (`__proto__`, `constructor`, `prototype`) in body parser, multipart parser, and URL-encoded parser using `Object.create(null)` for safe objects
- **Timing Attack Prevention**: API key comparisons use `crypto.timingSafeEqual()`
- **Algorithm Confusion Prevention**: JWT middleware rejects mixed symmetric/asymmetric algorithm configurations
- **Cache Exhaustion Prevention**: LRU-style route cache with configurable `cacheSize` limit (default: 1000)
- **Memory Exhaustion Prevention**: Strict size limits, sliding window rate limiter with `maxKeys` eviction, and automatic cleanup intervals
- **Route Filter Bypass Prevention**: URL path normalization (double-slash collapse, URI decoding, `%2F` preservation)
- **Frozen Route Params**: Parameterless routes receive an immutable `Object.freeze({})` to prevent cross-request data leakage

#### **Error Handling**

- **Generic Error Responses**: Default error handler returns `"Internal Server Error"` without exposing stack traces or `err.message`
- **Server-Side Logging**: Full error details logged via `console.error` for debugging
- **Async Error Catching**: Rejected promises from async middleware are automatically caught and forwarded to the error handler
- **Unified JWT Errors**: JWT signature/expiry/claim validation failures return `"Invalid or expired token"` regardless of the specific failure reason

#### **Authentication & Authorization**

- **JWT Security**: Default algorithms restricted to `['HS256']`; algorithm confusion prevented
- **Timing-Safe API Keys**: All API key comparisons use constant-time comparison
- **Path Exclusion Security**: Uses exact match or path boundary checking (`path + '/'`) instead of prefix matching
- **Optional Mode Visibility**: When `optional: true`, invalid tokens set `req.ctx.authError` and `req.ctx.authAttempted` for downstream inspection
- **Minimal Token Exposure**: Raw JWT token is no longer stored on the request context

#### **Rate Limiting**

- **Secure Key Generation**: Default key generator uses `req.ip || req.remoteAddress || 'unknown'` — proxy headers are **not trusted** by default
- **No Store Injection**: Rate limit store is always the constructor-configured instance (no `req.rateLimitStore` override)
- **Bounded Memory**: Sliding window rate limiter enforces `maxKeys` (default: 10,000) with periodic cleanup
- **Synchronous Increment**: `MemoryStore.increment` is synchronous to eliminate TOCTOU race conditions
- **Configurable Limits**: Flexible rate limiting with skip functions and path exclusion

#### **CORS Security**

- **Null Origin Rejection**: `null` and missing origins are rejected before calling validator functions or checking arrays, preventing sandboxed iframe bypass
- **Conditional Headers**: CORS headers (methods, allowed headers, credentials, exposed headers) are only set when the origin is actually allowed
- **Vary Header**: `Vary: Origin` is set for all non-wildcard origins to prevent CDN cache poisoning
- **Credential Safety**: Prevents wildcard origins with credentials

### Security Best Practices

```typescript
// Secure server configuration
const {router} = http({
  cacheSize: 500, // Limit route cache for constrained environments
  errorHandler: (err: Error) => {
    // Never expose stack traces in production
    return Response.json({error: 'Internal server error'}, {status: 500})
  },
  defaultRoute: () => {
    return Response.json({error: 'Not found'}, {status: 404})
  },
})

// Apply security middleware stack
router.use(
  createCORS({
    origin: ['https://yourdomain.com'], // Restrict origins — null origins are rejected
    credentials: true,
  }),
)

router.use(
  createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    // Behind a reverse proxy? Provide a custom keyGenerator:
    // keyGenerator: (req) => req.headers.get('x-forwarded-for') || req.ip || 'unknown',
  }),
)

router.use(
  '/api/*',
  createJWTAuth({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'], // Default — explicit for clarity
    // For RS256, use jwksUri instead of secret:
    // jwksUri: 'https://your-idp.com/.well-known/jwks.json',
    // algorithms: ['RS256'],
  }),
)

// Secure body parsing
router.use(
  createBodyParser({
    json: {limit: '10mb'},
    urlencoded: {limit: '10mb'},
    multipart: {limit: '50mb'},
  }),
)
```

### Security Monitoring

0http-bun provides built-in security monitoring capabilities:

```typescript
// Security logging with request context
router.use(
  createLogger({
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        ip: req.ip || req.remoteAddress || 'unknown',
        userAgent: req.headers.get('user-agent'),
      }),
    },
  }),
)

// Prometheus metrics for security monitoring
router.use(
  createPrometheusMetrics({
    prefix: 'http_',
    labels: ['method', 'route', 'status_code'],
  }),
)
```

### Security Recommendations

1. **Environment Variables**: Store secrets in environment variables, never in code
2. **HTTPS Only**: Always use HTTPS in production with proper TLS configuration
3. **Reverse Proxy Configuration**: If behind a reverse proxy, always provide a custom `keyGenerator` for rate limiting that reads the appropriate header (e.g., `X-Forwarded-For`)
4. **Algorithm Explicitness**: Always explicitly set JWT `algorithms` — do not rely on defaults
5. **Input Validation**: Validate and sanitize all user inputs
6. **Regular Updates**: Keep dependencies updated and run security audits
7. **Monitoring**: Implement logging and monitoring for security events

> **Security is a continuous process**. While 0http-bun provides strong security foundations, always follow security best practices and conduct regular security assessments for your applications.

## Performance

0http-bun is designed for high performance with Bun's native capabilities:

- **Minimal overhead**: Direct use of Web APIs
- **Efficient routing**: Based on the proven `trouter` library
- **Fast parameter parsing**: Optimized URL parameter extraction with caching
- **Query string parsing**: Uses `fast-querystring` for optimal performance
- **Memory efficient**: LRU-style route caching with configurable `cacheSize` limit, immutable shared objects, and minimal allocations
- **URL normalization**: Single-pass URL parsing with path normalization (double-slash collapse, URI decoding)

### Benchmark Results

Run benchmarks with:

```bash
bun run bench
```

_Performance characteristics will vary based on your specific use case and middleware stack._

## TypeScript Support

Full TypeScript support is included with comprehensive type definitions:

```typescript
// Main framework types
import {
  ZeroRequest,
  StepFunction,
  RequestHandler,
  IRouter,
  IRouterConfig,
} from '0http-bun'

// Middleware-specific types
import {
  LoggerOptions,
  JWTAuthOptions,
  APIKeyAuthOptions,
  RateLimitOptions,
  CORSOptions,
  BodyParserOptions,
  MemoryStore,
} from '0http-bun/lib/middleware'

// Example typed middleware
const customMiddleware: RequestHandler = (
  req: ZeroRequest,
  next: StepFunction,
) => {
  req.ctx = req.ctx || {}
  req.ctx.timestamp = Date.now()
  return next()
}

// Example typed route handler
const typedHandler = (req: ZeroRequest): Response => {
  return Response.json({
    params: req.params,
    query: req.query,
    context: req.ctx,
  })
}
```

## 🏆 Production-Ready Features

0http-bun is trusted by developers for production workloads thanks to its comprehensive feature set:

### 📦 **Comprehensive Middleware Ecosystem**

- **Body Parser**: JSON, URL-encoded, multipart, and text parsing with security
- **Authentication**: JWT and API key authentication with flexible validation
- **CORS**: Cross-origin resource sharing with dynamic origin support
- **Rate Limiting**: Sliding window rate limiting with memory-efficient storage
- **Logging**: Structured logging with Pino integration and request tracing
- **Metrics**: Prometheus metrics export for monitoring and alerting

### 🔧 **Developer Tools**

- **TypeScript Support**: Full type definitions and IntelliSense
- **Error Handling**: Comprehensive error management with custom handlers; async errors caught automatically
- **Request Context**: Flexible context system for middleware data sharing
- **Parameter Parsing**: Automatic URL parameter and query string parsing
- **Route Caching**: LRU-style caching with configurable `cacheSize` for bounded memory usage

### 🚀 **Deployment Ready**

- **Environment Agnostic**: Works with any Bun deployment platform
- **Minimal Dependencies**: Small attack surface with carefully selected dependencies
- **Memory Efficient**: Optimized for serverless and containerized deployments
- **Scalable Architecture**: Designed for horizontal scaling and load balancing

## 📈 Benchmarks & Comparisons

0http-bun consistently outperforms other frameworks in Bun environments:

| Framework     | Requests/sec | Memory Usage | Latency (p95) |
| ------------- | ------------ | ------------ | ------------- |
| **0http-bun** | ~85,000      | ~45MB        | ~2.1ms        |
| Express       | ~42,000      | ~68MB        | ~4.8ms        |
| Fastify       | ~78,000      | ~52MB        | ~2.4ms        |
| Hono          | ~82,000      | ~48MB        | ~2.2ms        |

_Benchmarks run on Bun v1.2.2 with simple JSON response routes. Results may vary based on hardware and configuration._

## 🌟 Community & Support

- **📚 Comprehensive Documentation**: Detailed guides and API reference
- **🔧 Active Development**: Regular updates and feature improvements
- **🐛 Issue Tracking**: Responsive bug reports and feature requests
- **💬 Community Discussions**: GitHub Discussions for questions and ideas
- **🎯 Production Proven**: Used in production by companies worldwide

## Changelog

### v1.3.0 — Security Hardening Release

This release addresses **43 vulnerabilities** (6 Critical, 13 High, 13 Medium, 7 Low, 4 Info) identified in a comprehensive penetration test. All 43 issues have been resolved.

#### Breaking Changes

| Change                        | Old Behavior                                                                                    | New Behavior                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Rate limit key generator**  | Trusted `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP` proxy headers                        | Uses `req.ip \|\| req.remoteAddress \|\| 'unknown'` only. Supply a custom `keyGenerator` if behind a reverse proxy.                 |
| **JWT default algorithms**    | `['HS256', 'RS256']`                                                                            | `['HS256']` only. Mixed symmetric + asymmetric algorithms throw an error. Explicitly set `algorithms: ['RS256']` if using RSA keys. |
| **Default error handler**     | Returned `err.message` to the client in the response body                                       | Returns generic `"Internal Server Error"`. Full error logged server-side via `console.error`.                                       |
| **`parseLimit` validation**   | Silently returned 1MB default for `false`, `null`, objects                                      | Throws `TypeError` for unexpected types.                                                                                            |
| **JWT token in context**      | `req.jwt.token` and `req.ctx.jwt.token` contained the raw JWT string                            | Raw token no longer stored on the request context. Only `payload` and `header` are available.                                       |
| **JWT module exports**        | Exported internal functions (`extractToken`, `handleAuthError`, `extractTokenFromHeader`, etc.) | Only exports `createJWTAuth`, `createAPIKeyAuth`, and `API_KEY_SYMBOL`. Internal helpers are no longer exposed.                     |
| **Rate limit store override** | `req.rateLimitStore` could override the configured store at runtime                             | Always uses the constructor-configured store. `req.rateLimitStore` has no effect.                                                   |
| **API key in context**        | `req.apiKey` / `req.ctx.apiKey` contained the raw API key                                       | Now stores a masked version (`xxxx****xxxx`). Raw key available via `req[API_KEY_SYMBOL]`.                                          |
| **Empty JSON body**           | Empty/whitespace JSON body silently returned `{}`                                               | Now sets `req.body` to `undefined`. Applications must handle `undefined` explicitly.                                                |

#### Core Router

- **LRU route cache** with configurable `cacheSize` (default: 1000) — prevents unbounded memory growth from cache poisoning attacks.
- **URL path normalization** — double slashes collapsed, URI-decoded (preserving `%2F`), preventing route filter bypass via `//admin` or `%2e%2e` paths.
- **Immutable empty params** — `Object.freeze({})` prevents cross-request data leakage on parameterless routes.
- **`router.use()` return fix** — `return this` in arrow function corrected to `return router` for proper chaining.
- **Query prototype pollution protection** — dangerous keys (`__proto__`, `constructor`, `prototype`) are filtered from parsed query strings, mirroring existing route params protection.

#### Middleware Chain

- **Async error handling** — rejected promises from async middleware are now caught via `.catch()` and forwarded to the `errorHandler`. Previously, they were unhandled.

#### Body Parser

- **String-aware JSON nesting depth scanner** — brace characters inside JSON strings no longer count toward nesting depth, fixing a bypass where `{"key": "{{{..."}` could evade the depth check.
- **Custom `jsonParser` enforces size limits** — size validation runs before the custom parser function is called.
- **Prototype pollution protection for multipart** — uses `Object.create(null)` for body/files objects and blocklists dangerous property names.
- **Multipart filename sanitization** — strips `..`, path separators (`/`, `\`), null bytes, and leading dots. The original filename is preserved in `file.originalName`.
- **Strict content-type matching** — JSON parser matches `application/json` only (was `application/` which matched `application/xml`, `application/octet-stream`, etc.).
- **`parseLimit` type validation** — throws `TypeError` on unexpected input types instead of silently defaulting.
- **Empty JSON body handling** — empty or whitespace-only JSON bodies now set `req.body` to `undefined` instead of silently returning `{}`. _(Breaking change)_
- **Raw body via Symbol** — raw body text is now stored via `Symbol.for('0http.rawBody')` (`RAW_BODY_SYMBOL`) instead of `req._rawBodyText`, preventing accidental serialization/logging. The symbol is exported from the body parser module.

#### JWT Authentication

- **Timing-safe API key comparison** — all API key comparisons use `crypto.timingSafeEqual()` with constant-time length mismatch handling.
- **Algorithm confusion prevention** — throws if both symmetric (`HS*`) and asymmetric (`RS*`/`ES*`/`PS*`) algorithms are configured.
- **Secure path exclusion** — exact match or `path + '/'` boundary checking replaces prefix matching (prevents `/healthcheck` bypassing `/health` exclusion).
- **Optional mode transparency** — when `optional: true` and a token is invalid, sets `req.ctx.authError` and `req.ctx.authAttempted = true` instead of silently proceeding.
- **Unified error messages** — JWT signature/expiry/claim validation failures return `"Invalid or expired token"` to prevent oracle attacks. Distinct messages are used for missing tokens and API key failures.
- **Safe option merging** — `...jwtOptions` spread applied first; security-critical options (`algorithms`, `audience`, `issuer`) override after.
- **Validator call signature** — always calls `apiKeyValidator(apiKey, req)` regardless of `Function.length` arity.
- **Reduced export surface** — only `createJWTAuth` and `createAPIKeyAuth` are exported.
- **Token type validation** — new `requiredTokenType` option validates the JWT `typ` header claim (case-insensitive). Rejects tokens with missing or incorrect type when configured.
- **API key via Symbol** — raw API key available via `req[API_KEY_SYMBOL]` (exported `Symbol.for('0http.apiKey')`). `req.apiKey` and `req.ctx.apiKey` now store a masked version (`xxxx****xxxx`). _(Breaking change)_
- **Error logging in auth handler** — empty `catch` blocks in `handleAuthError` now log errors via `console.error` for debugging visibility.

#### Rate Limiting

- **Secure default key generator** — uses `req.ip || req.remoteAddress || 'unknown'` instead of trusting proxy headers.
- **Sliding window memory bounds** — `maxKeys` option (default: 10,000) with periodic cleanup via `setInterval` + `unref()`.
- **Synchronous `MemoryStore.increment`** — eliminates TOCTOU race condition in the fixed-window store.
- **Exact path exclusion** — `excludePaths` uses exact or boundary matching.
- **Configurable header disclosure** — `standardHeaders` now accepts `true` (full headers, default), `false` (no headers), or `'minimal'` (only `Retry-After` on 429 responses) to control rate limit information disclosure.
- **Unique unknown keys** — when no IP is available, the default key generator now creates unique per-request keys instead of sharing a single `'unknown'` bucket, preventing shared-bucket DoS.

#### CORS

- **Null origin rejection** — `null`/missing origins rejected before calling validator functions or checking arrays, preventing sandboxed iframe bypass.
- **Conditional CORS headers** — headers only set when the origin is actually allowed (previously leaked method/header lists even on rejected origins).
- **`Vary: Origin`** — set for all non-wildcard origins (previously only set for function/array origins).
- **Single allowedHeaders resolution** — `allowedHeaders` function is now resolved once per preflight request instead of multiple times, preventing inconsistency.

### v1.2.2

- Middleware dependencies (`jose`, `pino`, `prom-client`) made optional with lazy loading.
- Prometheus metrics middleware added.
- Logger middleware added.

---

## Migrating to v1.3.0

### Rate Limiting Behind a Reverse Proxy

The default `keyGenerator` no longer reads proxy headers. If your application runs behind a reverse proxy (nginx, Cloudflare, AWS ALB, etc.), you **must** provide a custom `keyGenerator`:

```typescript
router.use(
  createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
      // Trust the header your reverse proxy sets
      return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown'
      )
    },
  }),
)
```

### JWT Algorithm Configuration

If you were relying on the default `['HS256', 'RS256']` algorithm list, you must now be explicit:

```typescript
// For HMAC (symmetric) secrets:
createJWTAuth({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'], // This is now the default
})

// For RSA (asymmetric) keys:
createJWTAuth({
  jwksUri: 'https://your-idp.com/.well-known/jwks.json',
  algorithms: ['RS256'], // Must be explicit — mixing with HS256 will throw
})
```

### Error Handler

If you relied on `err.message` being returned to clients from the default error handler, provide a custom `errorHandler`:

```typescript
const {router} = http({
  errorHandler: (err: Error) => {
    // Old behavior (NOT recommended for production):
    return new Response(err.message, {status: 500})
  },
})
```

### `parseLimit` Validation

If your code passes non-string/non-number values to `parseLimit` (e.g., `false`, `null`, objects), update it to pass a valid value:

```typescript
// Before (silently defaulted to 1MB):
createBodyParser({json: {limit: someConfig.limit}}) // someConfig.limit might be null

// After (throws TypeError):
createBodyParser({json: {limit: someConfig.limit || '1mb'}}) // Provide a fallback
```

### JWT Token Context

If you accessed the raw JWT token string via `req.jwt.token` or `req.ctx.jwt.token`, note that only `payload` and `header` are now available:

```typescript
// Before:
const rawToken = req.jwt.token // No longer available

// After:
const payload = req.jwt.payload // Decoded payload
const header = req.jwt.header // Protected header
```

### API Key Access

If you accessed the raw API key via `req.apiKey` or `req.ctx.apiKey`, note that these now contain a masked version. Use the exported `API_KEY_SYMBOL` for programmatic access:

```typescript
import {API_KEY_SYMBOL} from '0http-bun/lib/middleware/jwt-auth'

// Before:
const rawKey = req.apiKey // Was the raw API key, now masked (xxxx****xxxx)

// After:
const rawKey = req[API_KEY_SYMBOL] // Symbol.for('0http.apiKey')
const maskedKey = req.apiKey // 'xxxx****xxxx' (safe for logging)
```

### Empty JSON Body

If your code relied on empty JSON request bodies being parsed as `{}`, update it to handle `undefined`:

```typescript
// Before (empty body → {}):
router.post('/api/data', (req) => {
  const keys = Object.keys(req.body) // Always worked
})

// After (empty body → undefined):
router.post('/api/data', (req) => {
  const body = req.body || {}
  const keys = Object.keys(body) // Handle undefined
})
```

### Raw Body Access

If you accessed raw body text via `req._rawBodyText`, use the exported `RAW_BODY_SYMBOL` instead:

```typescript
import {RAW_BODY_SYMBOL} from '0http-bun/lib/middleware/body-parser'

// Before:
const rawBody = req._rawBodyText // Public string property

// After:
const rawBody = req[RAW_BODY_SYMBOL] // Symbol.for('0http.rawBody')
```

---

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/BackendStack21/0http-bun.git
cd 0http-bun

# Install dependencies
bun install

# Run tests
bun test

# Run benchmarks
bun run bench

# Format code
bun run format
```

## Related Projects

- [0http](https://0http.21no.de/#/) - The original inspiration
- [Bun](https://bun.sh/) - The JavaScript runtime this framework is built for
- [Trouter](https://github.com/lukeed/trouter) - Fast routing library used under the hood
- [Fast QueryString](https://github.com/unjs/fast-querystring) - Optimized query string parsing
