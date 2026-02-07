import {Pattern, Methods} from 'trouter'
import {Logger} from 'pino'

export interface IRouterConfig {
  cacheSize?: number
  defaultRoute?: RequestHandler
  errorHandler?: (err: Error) => Response | Promise<Response>
  port?: number
}

export type StepFunction = (error?: unknown) => Response | Promise<Response>

export interface ParsedFile {
  name: string
  size: number
  type: string
  data: File
}

export type ZeroRequest = Request & {
  params: Record<string, string>
  query: Record<string, string>
  // Legacy compatibility properties (mirrored from ctx)
  user?: any
  jwt?: {
    payload: any
    header: any
    token: string
  }
  apiKey?: string
  // Context object for middleware data
  ctx?: {
    log?: Logger
    user?: any
    jwt?: {
      payload: any
      header: any
      token: string
    }
    apiKey?: string
    rateLimit?: {
      limit: number
      used: number
      remaining: number
      resetTime: Date
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
