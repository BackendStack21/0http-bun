export interface IRouterConfig {
  defaultRoute?: (req: ZeroRequest) => Response;
  errorHandler?: (err: Error | unknown) => Response | Promise<Response>;
  port?: number;
}

export type StepFunction = (error?: unknown) => Response | Promise<Response>;

export type ZeroRequest = Request & {
  params: Record<string, string>;
  query: Record<string, string>;
  path: string;
  ctx?: Record<string, unknown>;
};

export type RequestHandler = (
  req: ZeroRequest,
  next: StepFunction,
) => Response | Promise<Response>;

// export interface IRouter {
//   port?: number;
//   fetch: (req: ZeroRequest) => Response | Promise<Response>;
//   defaultRoute: RequestHandler;
//   errorHandler: (err: Error | unknown) => Response | Promise<Response>;

//   use(...handlers: RequestHandler[]): this;
//   use(router: IRouter): this;
//   use(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   use(prefix: Pattern, router: IRouter): this;

//   on(method: Methods, pattern: Pattern, ...middlewares: RequestHandler[]): this;

//   all(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   add(method: Methods, pattern: Pattern, ...handlers: RequestHandler[]): this;
//   get(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   head(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   patch(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   options(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   connect(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   delete(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   trace(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   post(pattern: Pattern, ...handlers: RequestHandler[]): this;
//   put(pattern: Pattern, ...handlers: RequestHandler[]): this;
// }
// export { IRouter } from "./lib/router/sequential";
