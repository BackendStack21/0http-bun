import {StepFunction, ZeroRequest} from '../index'
import http from '../index'
import {createLogger, simpleLogger} from '../lib/middleware'
import type {LoggerOptions} from '../lib/middleware'

// Create router instance
const {router} = http({})

// Demo 1: Simple Logger (minimal setup)
console.log('🚀 Starting Logger Middleware Demo Server')
console.log('=====================================')

// Basic middleware for context
router.use((req: ZeroRequest, next: StepFunction) => {
  req.ctx = {
    startTime: Date.now(),
    requestId: crypto.randomUUID(),
    userAgent: req.headers.get('user-agent') || 'unknown',
  }
  return next()
})

// Demo 2: Simple logger for basic request logging
router.use('/simple/*', simpleLogger())

// Demo 3: Advanced logger with custom configuration
const advancedLoggerOptions: LoggerOptions = {
  pinoOptions: {
    level: 'info',
    // Use simple formatting instead of pino-pretty for demo
    formatters: {
      level: (label: string) => {
        return {level: label.toUpperCase()}
      },
      time: () => {
        return {time: new Date().toISOString()}
      },
    },
  },
  logBody: true,
  excludePaths: ['/health', '/metrics'],
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers?.get?.('user-agent'),
      contentType: req.headers?.get?.('content-type'),
      requestId: req.ctx?.requestId,
    }),
    res: (res: any) => ({
      status: res?.status,
      contentType: res?.headers?.get?.('content-type'),
      responseTime: res?._responseTime,
    }),
  },
}

router.use('/advanced/*', createLogger(advancedLoggerOptions))

// Demo 4: Production-like logger configuration
const productionLoggerOptions: LoggerOptions = {
  pinoOptions: {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: '0http-bun-demo',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
  },
  logBody: false, // Don't log bodies in production for security
  excludePaths: ['/health', '/ping', '/metrics', '/favicon.ico'],
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      remoteAddress:
        req.headers?.get?.('x-forwarded-for') ||
        req.headers?.get?.('x-real-ip') ||
        'unknown',
      userAgent: req.headers?.get?.('user-agent'),
      requestId: req.ctx?.requestId,
      userId: req.user?.id,
    }),
    res: (res: any) => ({
      status: res?.status,
      duration: res?._responseTime,
      size: res?.headers?.get?.('content-length'),
    }),
    err: (err: any) => ({
      type: err?.constructor?.name,
      message: err?.message,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    }),
  },
}

router.use('/production/*', createLogger(productionLoggerOptions))

// Routes for testing different scenarios

// Simple routes (with simple logger)
router.get('/simple/hello', (req: ZeroRequest) => {
  return Response.json({
    message: 'Hello from simple logger!',
    timestamp: new Date().toISOString(),
    requestId: req.ctx?.requestId,
  })
})

router.post('/simple/data', async (req: ZeroRequest) => {
  const body = await req.text()
  return Response.json({
    received: body,
    length: body.length,
    echo: 'Simple logger POST response',
  })
})

// Advanced routes (with detailed logging)
router.get('/advanced/user/:id', (req: ZeroRequest) => {
  const userId = req.params?.id

  // Simulate processing time
  const processingTime = Math.random() * 100

  return Response.json({
    user: {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      createdAt: new Date().toISOString(),
    },
    meta: {
      processingTime: `${processingTime.toFixed(2)}ms`,
      requestId: req.ctx?.requestId,
    },
  })
})

router.post('/advanced/users', async (req: ZeroRequest) => {
  try {
    const userData = await req.json()

    // Simulate user creation
    const newUser = {
      id: Math.floor(Math.random() * 10000),
      ...userData,
      createdAt: new Date().toISOString(),
    }

    return Response.json(
      {
        success: true,
        user: newUser,
        message: 'User created successfully',
      },
      {status: 201},
    )
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: 'Invalid JSON payload',
        message: 'Please provide valid user data',
      },
      {status: 400},
    )
  }
})

// Production routes (with production-level logging)
router.get('/production/api/status', (req: ZeroRequest) => {
  return Response.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })
})

router.get('/production/api/users/:id/profile', (req: ZeroRequest) => {
  const userId = req.params?.id

  // Simulate auth check
  const isAuthorized = req.headers.get('authorization') !== null

  if (!isAuthorized) {
    return Response.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      {status: 401},
    )
  }

  return Response.json({
    profile: {
      id: userId,
      name: `Production User ${userId}`,
      role: 'user',
      lastLogin: new Date().toISOString(),
    },
    requestId: req.ctx?.requestId,
  })
})

// Error demonstration route
router.get('/advanced/error', (req: ZeroRequest) => {
  // Simulate an error for logging demonstration
  throw new Error('Intentional error for logging demo')
})

// Health check (excluded from logging)
router.get('/health', (req: ZeroRequest) => {
  return Response.json({status: 'OK', timestamp: new Date().toISOString()})
})

// Metrics endpoint (excluded from logging)
router.get('/metrics', (req: ZeroRequest) => {
  return new Response(
    `# HELP requests_total Total requests
# TYPE requests_total counter
requests_total 42
`,
    {
      headers: {'Content-Type': 'text/plain'},
    },
  )
})

// Root endpoint with demo information
router.get('/', (req: ZeroRequest) => {
  return Response.json(
    {
      message: '0http-bun Logger Middleware Demo',
      endpoints: {
        simple: {
          '/simple/hello': 'GET - Simple hello endpoint with basic logging',
          '/simple/data': 'POST - Echo endpoint with simple logging',
        },
        advanced: {
          '/advanced/user/:id': 'GET - User details with advanced logging',
          '/advanced/users': 'POST - Create user with body logging',
          '/advanced/error': 'GET - Error demonstration',
        },
        production: {
          '/production/api/status':
            'GET - System status with production logging',
          '/production/api/users/:id/profile':
            'GET - User profile (requires auth header)',
        },
        utility: {
          '/health': 'GET - Health check (excluded from logs)',
          '/metrics': 'GET - Metrics endpoint (excluded from logs)',
        },
      },
      instructions: {
        testCommands: [
          'curl http://localhost:3000/simple/hello',
          'curl -X POST http://localhost:3000/simple/data -d "test data"',
          'curl http://localhost:3000/advanced/user/123',
          'curl -X POST http://localhost:3000/advanced/users -H "Content-Type: application/json" -d \'{"name":"John","email":"john@example.com"}\'',
          'curl http://localhost:3000/advanced/error',
          'curl http://localhost:3000/production/api/status',
          'curl -H "Authorization: Bearer token" http://localhost:3000/production/api/users/456/profile',
        ],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
})

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

console.log(`\n🌟 Logger Demo Features:`)
console.log(`   • Simple Logger: /simple/* routes`)
console.log(`   • Advanced Logger: /advanced/* routes (with body logging)`)
console.log(`   • Production Logger: /production/* routes`)
console.log(`   • Health/Metrics: excluded from logging`)
console.log(`\n📋 Test the different logging levels:`)
console.log(`   curl http://localhost:${port}/`)
console.log(`   curl http://localhost:${port}/simple/hello`)
console.log(`   curl http://localhost:${port}/advanced/user/123`)
console.log(`   curl http://localhost:${port}/production/api/status`)

export default {
  port,
  fetch: router.fetch.bind(router),
}
