// Export all middleware modules
const loggerModule = require('./logger')
const jwtAuthModule = require('./jwt-auth')
const rateLimitModule = require('./rate-limit')
const corsModule = require('./cors')
const bodyParserModule = require('./body-parser')
const prometheusModule = require('./prometheus')

module.exports = {
  // Simple interface for common use cases (matches test expectations)
  logger: loggerModule.createLogger,
  jwtAuth: jwtAuthModule.createJWTAuth,
  rateLimit: rateLimitModule.createRateLimit,
  cors: corsModule.createCORS,
  bodyParser: bodyParserModule.createBodyParser,
  prometheus: prometheusModule.createPrometheusIntegration,

  // Complete factory functions for advanced usage
  createLogger: loggerModule.createLogger,
  simpleLogger: loggerModule.simpleLogger,

  // Authentication middleware
  createJWTAuth: jwtAuthModule.createJWTAuth,
  createAPIKeyAuth: jwtAuthModule.createAPIKeyAuth,
  extractTokenFromHeader: jwtAuthModule.extractTokenFromHeader,
  API_KEY_SYMBOL: jwtAuthModule.API_KEY_SYMBOL,
  maskApiKey: jwtAuthModule.maskApiKey,

  // Rate limiting middleware
  createRateLimit: rateLimitModule.createRateLimit,
  createSlidingWindowRateLimit: rateLimitModule.createSlidingWindowRateLimit,
  MemoryStore: rateLimitModule.MemoryStore,
  defaultKeyGenerator: rateLimitModule.defaultKeyGenerator,
  defaultHandler: rateLimitModule.defaultHandler,

  // CORS middleware
  createCORS: corsModule.createCORS,
  simpleCORS: corsModule.simpleCORS,
  getAllowedOrigin: corsModule.getAllowedOrigin,

  // Body parser middleware
  createJSONParser: bodyParserModule.createJSONParser,
  createTextParser: bodyParserModule.createTextParser,
  createURLEncodedParser: bodyParserModule.createURLEncodedParser,
  createMultipartParser: bodyParserModule.createMultipartParser,
  createBodyParser: bodyParserModule.createBodyParser,
  hasBody: bodyParserModule.hasBody,
  shouldParse: bodyParserModule.shouldParse,
  parseLimit: bodyParserModule.parseLimit,
  RAW_BODY_SYMBOL: bodyParserModule.RAW_BODY_SYMBOL,

  // Prometheus metrics middleware
  createPrometheusMiddleware: prometheusModule.createPrometheusMiddleware,
  createMetricsHandler: prometheusModule.createMetricsHandler,
  createPrometheusIntegration: prometheusModule.createPrometheusIntegration,
  createDefaultMetrics: prometheusModule.createDefaultMetrics,
  extractRoutePattern: prometheusModule.extractRoutePattern,
}
