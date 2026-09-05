import {Pattern, Methods} from 'trouter'
import {Logger} from 'pino'

export interface IRouterConfig {
  cacheSize?: number
  defaultRoute?: RequestHandler
  errorHandler?: (err: Error, req?: ZeroRequest) => Response | Promise<Response>
  port?: number
}

export type StepFunction = (error?: unknown) => Response | Promise<Response>

export interface ParsedFile {
  filename?: string
  originalName?: string
  name: string
  size: number
  type: string
  mimetype?: string
  data: Uint8Array
}

export type ZeroRequest = Request & {
  // Canonical pathname set by the router (slash-collapsed, decoded, dot-resolved)
  path?: string
  params: Record<string, string>
  query: Record<string, string>
  // Parsed body / files (set by body-parser middleware)
  body?: any
  files?: Record<string, ParsedFile | ParsedFile[]>
  // Connection-level IP address (set via Bun.serve's server.requestIP or upstream middleware)
  ip?: string
  remoteAddress?: string
  socket?: {
    remoteAddress?: string
  }
  // Rate limit info (set by rate-limit middleware)
  rateLimit?: {
    limit: number
    remaining: number
    current: number
    reset: Date
  }
  // Legacy compatibility properties (mirrored from ctx)
  user?: any
  jwt?: {
    payload: any
    header: any
  }
  apiKey?: string
  log?: Logger
  requestId?: string
  // Context object for middleware data
  ctx?: {
    log?: Logger
    requestId?: string
    user?: any
    jwt?: {
      payload: any
      header: any
    }
    apiKey?: string
    authError?: string
    authAttempted?: boolean
    rateLimit?: {
      limit: number
      used: number
      remaining: number
      resetTime: Date
      current: number
      reset: Date
    }
    body?: any
    files?: Record<string, ParsedFile | ParsedFile[]>
    [key: string]: any
  }
}

export type RequestHandler = (
  req: ZeroRequest,
  next: StepFunction,
) => Response | Promise<Response>

export interface IRouter {
  fetch: (req: Request) => Response | Promise<Response>

  use(...handlers: RequestHandler[]): this
  use(router: IRouter): this
  use(pattern: Pattern, ...handlers: RequestHandler[]): this
  use(prefix: Pattern, router: IRouter): this

  on(method: Methods, pattern: Pattern, ...middlewares: RequestHandler[]): this

  all(pattern: Pattern, ...handlers: RequestHandler[]): this
  get(pattern: Pattern, ...handlers: RequestHandler[]): this
  head(pattern: Pattern, ...handlers: RequestHandler[]): this
  patch(pattern: Pattern, ...handlers: RequestHandler[]): this
  options(pattern: Pattern, ...handlers: RequestHandler[]): this
  connect(pattern: Pattern, ...handlers: RequestHandler[]): this
  delete(pattern: Pattern, ...handlers: RequestHandler[]): this
  trace(pattern: Pattern, ...handlers: RequestHandler[]): this
  post(pattern: Pattern, ...handlers: RequestHandler[]): this
  put(pattern: Pattern, ...handlers: RequestHandler[]): this
}
