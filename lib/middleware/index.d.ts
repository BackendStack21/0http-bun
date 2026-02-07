import {RequestHandler, ZeroRequest} from '../../common'

// Logger middleware types
export interface LoggerOptions {
  pinoOptions?: any
  serializers?: Record<string, (obj: any) => any>
  logBody?: boolean
  excludePaths?: string[]
}

export function createLogger(options?: LoggerOptions): RequestHandler
export function simpleLogger(): RequestHandler

// JWT Authentication middleware types
export interface JWKSLike {
  getKey?: (protectedHeader: any, token: string) => Promise<any>
  [key: string]: any
}

export interface JWTAuthOptions {
  secret?:
    | string
    | Uint8Array
    | ((req: ZeroRequest) => Promise<string | Uint8Array>)
    | ((protectedHeader: any, token: string) => Promise<string | Uint8Array>)
  jwksUri?: string
  jwks?: JWKSLike
  jwtOptions?: {
    algorithms?: string[]
    audience?: string | string[]
    issuer?: string | string[]
    subject?: string
    clockTolerance?: number
    maxTokenAge?: number
  }
  // Token extraction options
  getToken?: (req: ZeroRequest) => string | null
  tokenHeader?: string
  tokenQuery?: string
  // Authentication behavior options
  optional?: boolean
  excludePaths?: string[]
  // API key authentication options
  apiKeys?:
    | string
    | string[]
    | ((
        key: string,
        req: ZeroRequest,
      ) => Promise<boolean | any> | boolean | any)
  apiKeyHeader?: string
  apiKeyValidator?:
    | ((key: string) => Promise<boolean | any> | boolean | any)
    | ((
        key: string,
        req: ZeroRequest,
      ) => Promise<boolean | any> | boolean | any)
  validateApiKey?:
    | ((key: string) => Promise<boolean | any> | boolean | any)
    | ((
        key: string,
        req: ZeroRequest,
      ) => Promise<boolean | any> | boolean | any)
  // JWT specific options (can also be in jwtOptions)
  audience?: string | string[]
  issuer?: string
  algorithms?: string[]
  // Token type validation
  requiredTokenType?: string
  // Custom response and error handling
  unauthorizedResponse?:
    | Response
    | ((error: Error, req: ZeroRequest) => Response | any)
    | {
        status?: number
        body?: any
        headers?: Record<string, string>
      }
  onError?: (error: Error, req: ZeroRequest) => Response | any
}

export interface APIKeyAuthOptions {
  keys:
    | string
    | string[]
    | ((key: string, req: ZeroRequest) => Promise<boolean> | boolean)
  header?: string
  getKey?: (req: ZeroRequest) => string | null
}

export interface TokenExtractionOptions {
  getToken?: (req: ZeroRequest) => string | null
  tokenHeader?: string
  tokenQuery?: string
}

export function createJWTAuth(options?: JWTAuthOptions): RequestHandler
export function createAPIKeyAuth(options: APIKeyAuthOptions): RequestHandler
export function extractTokenFromHeader(req: ZeroRequest): string | null
export const API_KEY_SYMBOL: symbol
export function maskApiKey(key: string): string

// Rate limiting middleware types
export interface RateLimitOptions {
  windowMs?: number
  max?: number
  message?: string
  keyGenerator?: (req: ZeroRequest) => Promise<string> | string
  handler?: (
    req: ZeroRequest,
    totalHits: number,
    max: number,
    resetTime: Date,
  ) => Promise<Response> | Response
  store?: RateLimitStore
  standardHeaders?: boolean | 'minimal'
  excludePaths?: string[]
  skip?: (req: ZeroRequest) => boolean
}

export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
  ): Promise<{totalHits: number; resetTime: Date}>
  reset(key: string): Promise<void>
}

export class MemoryStore implements RateLimitStore {
  constructor()
  increment(
    key: string,
    windowMs: number,
  ): Promise<{totalHits: number; resetTime: Date}>
  reset(key: string): Promise<void>
  cleanup(now: number): void
}

export function createRateLimit(options?: RateLimitOptions): RequestHandler
export function createSlidingWindowRateLimit(
  options?: RateLimitOptions,
): RequestHandler
export function defaultKeyGenerator(req: ZeroRequest): string
export function defaultHandler(
  req: ZeroRequest,
  totalHits: number,
  max: number,
  resetTime: Date,
): Response

// CORS middleware types
export interface CORSOptions {
  origin?:
    | string
    | string[]
    | boolean
    | ((origin: string, req: ZeroRequest) => boolean | string)
  methods?: string[]
  allowedHeaders?: string[] | ((req: ZeroRequest) => string[])
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
  optionsSuccessStatus?: number
}

export function createCORS(options?: CORSOptions): RequestHandler
export function simpleCORS(): RequestHandler
export function getAllowedOrigin(
  origin: any,
  requestOrigin: string,
  req: ZeroRequest,
): string | false

// Body parser middleware types
export interface JSONParserOptions {
  limit?: number | string
  reviver?: (key: string, value: any) => any
  strict?: boolean
  type?: string
  deferNext?: boolean
}

export interface TextParserOptions {
  limit?: number | string
  type?: string
  defaultCharset?: string
  deferNext?: boolean
}

export interface URLEncodedParserOptions {
  limit?: number | string
  extended?: boolean
  parseNestedObjects?: boolean
  deferNext?: boolean
}

export interface MultipartParserOptions {
  limit?: number | string
  deferNext?: boolean
}

export interface BodyParserOptions {
  json?: JSONParserOptions
  text?: TextParserOptions
  urlencoded?: URLEncodedParserOptions
  multipart?: MultipartParserOptions
  jsonTypes?: string[]
  jsonParser?: (text: string) => any
  onError?: (error: Error, req: ZeroRequest, next: () => any) => any
  verify?: (req: ZeroRequest, rawBody: string) => void
  parseNestedObjects?: boolean
  jsonLimit?: number | string
  textLimit?: number | string
  urlencodedLimit?: number | string
  multipartLimit?: number | string
}

export interface ParsedFile {
  name: string
  size: number
  type: string
  data: File
}

export function createJSONParser(options?: JSONParserOptions): RequestHandler
export function createTextParser(options?: TextParserOptions): RequestHandler
export function createURLEncodedParser(
  options?: URLEncodedParserOptions,
): RequestHandler
export function createMultipartParser(
  options?: MultipartParserOptions,
): RequestHandler
export function createBodyParser(options?: BodyParserOptions): RequestHandler
export function hasBody(req: ZeroRequest): boolean
export function shouldParse(req: ZeroRequest, type: string): boolean
export function parseLimit(limit: number | string): number
export const RAW_BODY_SYMBOL: symbol

// Prometheus metrics middleware types
export interface PrometheusMetrics {
  httpRequestDuration: any // prom-client Histogram
  httpRequestTotal: any // prom-client Counter
  httpRequestSize: any // prom-client Histogram
  httpResponseSize: any // prom-client Histogram
  httpActiveConnections: any // prom-client Gauge
}

export interface PrometheusMiddlewareOptions {
  /** Custom metrics object to use instead of default metrics */
  metrics?: PrometheusMetrics
  /** Paths to exclude from metrics collection (default: ['/health', '/ping', '/favicon.ico', '/metrics']) */
  excludePaths?: string[]
  /** Whether to collect default Node.js metrics (default: true) */
  collectDefaultMetrics?: boolean
  /** Custom route normalization function */
  normalizeRoute?: (req: ZeroRequest) => string
  /** Custom label extraction function */
  extractLabels?: (
    req: ZeroRequest,
    response: Response,
  ) => Record<string, string>
  /** HTTP methods to skip from metrics collection */
  skipMethods?: string[]
}

export interface MetricsHandlerOptions {
  /** The endpoint path for metrics (default: '/metrics') */
  endpoint?: string
  /** Custom Prometheus registry to use */
  registry?: any // prom-client Registry
}

export interface PrometheusIntegration {
  /** The middleware function */
  middleware: RequestHandler
  /** The metrics handler function */
  metricsHandler: RequestHandler
  /** The Prometheus registry */
  registry: any // prom-client Registry
  /** The prom-client module */
  promClient: any
}

export function createPrometheusMiddleware(
  options?: PrometheusMiddlewareOptions,
): RequestHandler
export function createMetricsHandler(
  options?: MetricsHandlerOptions,
): RequestHandler
export function createPrometheusIntegration(
  options?: PrometheusMiddlewareOptions & MetricsHandlerOptions,
): PrometheusIntegration
export function createDefaultMetrics(): PrometheusMetrics
export function extractRoutePattern(req: ZeroRequest): string

// Simple interface exports for common use cases
export const logger: typeof createLogger
export const jwtAuth: typeof createJWTAuth
export const rateLimit: typeof createRateLimit
export const cors: typeof createCORS
export const bodyParser: typeof createBodyParser
export const prometheus: typeof createPrometheusIntegration
