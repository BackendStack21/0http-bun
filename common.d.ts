import {Pattern, Methods} from 'trouter'

export interface IRouterConfig {
  defaultRoute?: RequestHandler
  errorHandler?: (err: Error) => Response | Promise<Response>
  port?: number
}

export type StepFunction = (error?: unknown) => Response | Promise<Response>

type ZeroRequest = Request & {
  params: Record<string, string>
  query: Record<string, string>
  ctx?: Record<string, any>
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
