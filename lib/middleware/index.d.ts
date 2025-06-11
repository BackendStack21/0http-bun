import {RequestHandler, ZeroRequest, StepFunction} from '../../common'
import {Logger} from 'pino'

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
export function extractToken(
  req: ZeroRequest,
  options?: TokenExtractionOptions,
): string | null
export function validateApiKeyInternal(
  apiKey: string,
  apiKeys: JWTAuthOptions['apiKeys'],
  apiKeyValidator: JWTAuthOptions['apiKeyValidator'],
  req: ZeroRequest,
): Promise<boolean | any>
export function handleAuthError(
  error: Error,
  handlers: {
    unauthorizedResponse?: JWTAuthOptions['unauthorizedResponse']
    onError?: JWTAuthOptions['onError']
  },
  req: ZeroRequest,
): Response

// Rate limiting middleware types
export interface RateLimitOptions {
  windowMs?: number
  max?: number
  keyGenerator?: (req: ZeroRequest) => Promise<string> | string
  handler?: (
    req: ZeroRequest,
    totalHits: number,
    max: number,
    resetTime: Date,
  ) => Promise<Response> | Response
  store?: RateLimitStore
  standardHeaders?: boolean
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
  allowedHeaders?: string[]
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
  limit?: number
  reviver?: (key: string, value: any) => any
  strict?: boolean
  type?: string
}

export interface TextParserOptions {
  limit?: number
  type?: string
  defaultCharset?: string
}

export interface URLEncodedParserOptions {
  limit?: number
  extended?: boolean
}

export interface MultipartParserOptions {
  limit?: number
}

export interface BodyParserOptions {
  json?: JSONParserOptions
  text?: TextParserOptions
  urlencoded?: URLEncodedParserOptions
  multipart?: MultipartParserOptions
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
