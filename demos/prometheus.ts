import http from '../index'
import {createPrometheusIntegration} from '../lib/middleware/prometheus'

// Create Prometheus integration with custom options
const prometheus = createPrometheusIntegration({
  // Collect default Node.js metrics (memory, CPU, etc.)
  collectDefaultMetrics: true,

  // Exclude certain paths from metrics
  excludePaths: ['/health', '/favicon.ico'],

  // Skip metrics for certain HTTP methods
  skipMethods: ['OPTIONS'],

  // Custom route normalization
  normalizeRoute: (req) => {
    const url = new URL(req.url, 'http://localhost')
    let pathname = url.pathname

    // Custom patterns for this demo
    pathname = pathname
      .replace(/\/users\/\d+/, '/users/:id')
      .replace(/\/products\/[a-zA-Z0-9-]+/, '/products/:slug')
      .replace(/\/api\/v\d+/, '/api/:version')

    return pathname
  },

  // Add custom labels to metrics
  extractLabels: (req, response) => {
    const labels: Record<string, string> = {}

    // Add user agent category
    const userAgent = req.headers.get('user-agent') || ''
    if (userAgent.includes('curl')) {
      labels.client_type = 'curl'
    } else if (userAgent.includes('Chrome')) {
      labels.client_type = 'browser'
    } else {
      labels.client_type = 'other'
    }

    // Add response type
    const contentType = response?.headers?.get('content-type') || ''
    if (contentType.includes('json')) {
      labels.response_type = 'json'
    } else if (contentType.includes('html')) {
      labels.response_type = 'html'
    } else {
      labels.response_type = 'other'
    }

    return labels
  },
})

// Create custom metrics for business logic
const {promClient} = prometheus

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

const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
})

// Simulate some active users
let userCount = 0
setInterval(() => {
  userCount = Math.floor(Math.random() * 100) + 50
  activeUsers.set(userCount)
}, 5000)

// Configure the server
const {router} = http({})

// Apply Prometheus middleware
router.use(prometheus.middleware)

// Health check endpoint (excluded from metrics)
router.get('/health', () => {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
    {
      headers: {'Content-Type': 'application/json'},
    },
  )
})

// User endpoints
router.get('/users/:id', (req) => {
  const id = req.params?.id
  return new Response(
    JSON.stringify({
      id: parseInt(id),
      name: `User ${id}`,
      email: `user${id}@example.com`,
      created_at: new Date().toISOString(),
    }),
    {
      headers: {'Content-Type': 'application/json'},
    },
  )
})

router.post('/users', async (req) => {
  const body = await req.json()
  const user = {
    id: Math.floor(Math.random() * 1000),
    name: body.name || 'Anonymous',
    email: body.email || `user${Date.now()}@example.com`,
    created_at: new Date().toISOString(),
  }

  return new Response(JSON.stringify(user), {
    status: 201,
    headers: {'Content-Type': 'application/json'},
  })
})

// Product endpoints
router.get('/products/:slug', (req) => {
  const slug = req.params?.slug
  return new Response(
    JSON.stringify({
      slug,
      name: slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      price: Math.floor(Math.random() * 500) + 10,
      in_stock: Math.random() > 0.2,
    }),
    {
      headers: {'Content-Type': 'application/json'},
    },
  )
})

// Order endpoint with custom metrics
router.post('/orders', async (req) => {
  try {
    const body = await req.json()
    const amount = body.amount || 0
    const method = body.method || 'unknown'

    // Simulate order processing
    const success = Math.random() > 0.1 // 90% success rate
    const status = success ? 'completed' : 'failed'

    // Record custom metrics
    orderCounter.inc({status, payment_method: method})

    if (success && amount > 0) {
      orderValue.observe({payment_method: method}, amount)
    }

    const order = {
      id: `order_${Date.now()}`,
      amount,
      payment_method: method,
      status,
      created_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(order), {
      status: success ? 201 : 402,
      headers: {'Content-Type': 'application/json'},
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON body',
      }),
      {
        status: 400,
        headers: {'Content-Type': 'application/json'},
      },
    )
  }
})

// Slow endpoint for testing duration metrics
router.get('/slow', async () => {
  // Random delay between 1-3 seconds
  const delay = Math.floor(Math.random() * 2000) + 1000
  await new Promise((resolve) => setTimeout(resolve, delay))

  return new Response(
    JSON.stringify({
      message: `Processed after ${delay}ms`,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {'Content-Type': 'application/json'},
    },
  )
})

// Error endpoint for testing error metrics
router.get('/error', () => {
  // Randomly throw different types of errors
  const errorType = Math.floor(Math.random() * 3)

  switch (errorType) {
    case 0:
      return new Response('Not Found', {status: 404})
    case 1:
      return new Response('Internal Server Error', {status: 500})
    case 2:
      throw new Error('Unhandled error for testing')
    default:
      return new Response('Bad Request', {status: 400})
  }
})

// Versioned API endpoint
router.get('/api/:version/data', (req) => {
  const version = req.params?.version
  return new Response(
    JSON.stringify({
      api_version: version,
      data: {message: 'Hello from versioned API'},
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {'Content-Type': 'application/json'},
    },
  )
})

// Metrics endpoint - this should be added last
router.get('/metrics', prometheus.metricsHandler)

// Server startup logic
const port = process.env.PORT || 3003

console.log('🚀 Starting Prometheus Demo Server')
console.log('=====================================')
console.log(`📊 Metrics endpoint: http://localhost:${port}/metrics`)
console.log(`🏠 Demo page: http://localhost:${port}/`)
console.log(`� Health check: http://localhost:${port}/health`)
console.log(`🔧 Port: ${port}`)
console.log('=====================================')
console.log('')
console.log('Try these commands to generate metrics:')
console.log('curl http://localhost:' + port + '/metrics')
console.log('curl http://localhost:' + port + '/users/123')
console.log('curl http://localhost:' + port + '/products/awesome-widget')
console.log(
  'curl -X POST http://localhost:' +
    port +
    '/orders -H \'Content-Type: application/json\' -d \'{"amount": 99.99, "method": "card"}\'',
)
console.log('curl http://localhost:' + port + '/slow')
console.log('curl http://localhost:' + port + '/error')
console.log('')

console.log(`✅ Server running at http://localhost:${port}/`)

export default {
  port,
  fetch: router.fetch.bind(router),
}
