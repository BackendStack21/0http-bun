# 0http-bun

A high-performance, minimalist HTTP framework for [Bun](https://bun.sh/), inspired by [0http](https://0http.21no.de/#/). Built specifically to leverage Bun's native performance capabilities with a developer-friendly API.

## Key Benefits

- **🚀 Bun-Native Performance**: Optimized for Bun's runtime with minimal overhead
- **⚡ Zero Dependencies**: Core framework uses only essential, lightweight dependencies
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
}
```

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

### Error Handling

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

// Route that might throw an error
router.get('/api/risky', (req: ZeroRequest) => {
  if (Math.random() > 0.5) {
    const error = new Error('Random failure')
    error.name = 'ValidationError'
    throw error
  }

  return Response.json({success: true})
})
```

## Performance

0http-bun is designed for high performance with Bun's native capabilities:

- **Minimal overhead**: Direct use of Web APIs
- **Efficient routing**: Based on the proven `trouter` library
- **Fast parameter parsing**: Optimized URL parameter extraction
- **Query string parsing**: Uses `fast-querystring` for performance

### Benchmark Results

Run benchmarks with:

```bash
bun run bench
```

## TypeScript Support

Full TypeScript support is included with comprehensive type definitions:

```typescript
import {
  ZeroRequest,
  StepFunction,
  RequestHandler,
  IRouter,
  IRouterConfig,
} from '0http-bun'
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [0http](https://0http.21no.de/#/) - The original inspiration
- [Bun](https://bun.sh/) - The JavaScript runtime this framework is built for
