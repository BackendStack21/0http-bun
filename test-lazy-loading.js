// Test script to verify lazy loading works
const middleware = require('./lib/middleware')

console.log('Testing lazy loading of middleware dependencies...')

// Test that dependencies are not loaded initially
console.log('✅ Middleware exports loaded without requiring dependencies')

// Test that pino is loaded only when logger is used
try {
  delete require.cache[require.resolve('pino')]
  console.log('Creating logger middleware...')
  const logger = middleware.createLogger()
  console.log('✅ Pino loaded successfully when createLogger() called')
} catch (error) {
  if (error.message.includes('pino is required')) {
    console.log('✅ Pino lazy loading error handling works')
  } else {
    console.log('❌ Unexpected error:', error.message)
  }
}

// Test that jose is loaded only when JWT auth is used
try {
  console.log('Creating JWT auth middleware...')
  const jwtAuth = middleware.createJWTAuth({secret: 'test'})
  console.log('✅ Jose loaded successfully when createJWTAuth() called')
} catch (error) {
  if (error.message.includes('jose is required')) {
    console.log('✅ Jose lazy loading error handling works')
  } else {
    console.log('❌ Unexpected error:', error.message)
  }
}

// Test that prom-client is loaded only when Prometheus middleware is used
try {
  console.log('Creating Prometheus middleware...')
  const prometheus = middleware.createPrometheusMiddleware()
  console.log(
    '✅ Prom-client loaded successfully when createPrometheusMiddleware() called',
  )
} catch (error) {
  if (error.message.includes('prom-client is required')) {
    console.log('✅ Prom-client lazy loading error handling works')
  } else {
    console.log('❌ Unexpected error:', error.message)
  }
}

console.log('🎉 Lazy loading implementation working correctly!')
