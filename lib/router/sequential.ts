import type { IRouterConfig, RequestHandler, ZeroRequest } from "../../common";
import next from "../next";
import { Trouter, type Methods, type Pattern } from "trouter";
import qs from "fast-querystring";
import { parse } from "regexparam";

const STATUS_404 = {
  status: 404,
};
const STATUS_500 = {
  status: 500,
};
export interface IRouter {
  all(pattern: Pattern, ...handlers: RequestHandler[]): this;
  add(method: Methods, pattern: Pattern, ...handlers: RequestHandler[]): this;
  get(pattern: Pattern, ...handlers: RequestHandler[]): this;
  head(pattern: Pattern, ...handlers: RequestHandler[]): this;
  patch(pattern: Pattern, ...handlers: RequestHandler[]): this;
  options(pattern: Pattern, ...handlers: RequestHandler[]): this;
  connect(pattern: Pattern, ...handlers: RequestHandler[]): this;
  delete(pattern: Pattern, ...handlers: RequestHandler[]): this;
  trace(pattern: Pattern, ...handlers: RequestHandler[]): this;
  post(pattern: Pattern, ...handlers: RequestHandler[]): this;
  put(pattern: Pattern, ...handlers: RequestHandler[]): this;
}
const MAP = {
  "": 0,
  GET: 1,
  HEAD: 2,
  PATCH: 3,
  OPTIONS: 4,
  CONNECT: 5,
  DELETE: 6,
  TRACE: 7,
  POST: 8,
  PUT: 9,
};
export type MAP_key =
  | ""
  | "GET"
  | "HEAD"
  | "PATCH"
  | "OPTIONS"
  | "CONNECT"
  | "DELETE"
  | "TRACE"
  | "POST"
  | "PUT";
declare module "trouter" {
  interface Trouter {
    routes: {
      keys: string[];
      pattern: RegExp;
      origin_pattern: Pattern;
      method: Methods;
      handlers: RequestHandler[];
      midx: number;
    }[];
  }
}

export class IRouter extends Trouter {
  port?: number;
  defaultRoute: (_req: ZeroRequest) => Response;
  errorHandler: (err: Error | unknown) => Response | Promise<Response>;

  constructor(config?: IRouterConfig) {
    super();
    this.defaultRoute =
      config?.defaultRoute || ((_req) => new Response(null, STATUS_404));
    this.errorHandler =
      config?.errorHandler ||
      ((err) => {
        return new Response((err as Error).message, STATUS_500);
      });
    this.port = config?.port;
    this.all = this.add.bind(this, "" as Methods);
    this.get = this.add.bind(this, "GET");
    this.head = this.add.bind(this, "HEAD");
    this.patch = this.add.bind(this, "PATCH");
    this.options = this.add.bind(this, "OPTIONS");
    this.connect = this.add.bind(this, "CONNECT");
    this.delete = this.add.bind(this, "DELETE");
    this.trace = this.add.bind(this, "TRACE");
    this.post = this.add.bind(this, "POST");
    this.put = this.add.bind(this, "PUT");
  }
  on = (method: Methods, pattern: Pattern, ...handlers: RequestHandler[]) =>
    this.add(method, pattern, ...handlers);

  fetch = (req: Request) => {
    const url = req.url;
    const startIndex = url.indexOf("/", 11);
    const queryIndex = url.indexOf("?", startIndex + 1);
    const path =
      queryIndex === -1
        ? url.substring(startIndex)
        : url.substring(startIndex, queryIndex);

    (req as ZeroRequest).path = path || "/";
    (req as ZeroRequest).query =
      queryIndex > 0 ? qs.parse(url.substring(queryIndex + 1)) : {};

    const match = this.find(req.method as Methods, (req as ZeroRequest).path);
    if (match.handlers.length > 0) {
      if (!(req as ZeroRequest).params) {
        (req as ZeroRequest).params = {};
      }
      Object.assign((req as ZeroRequest).params, match.params);

      return next(
        match.handlers as RequestHandler[],
        req as ZeroRequest,
        0,
        this.defaultRoute,
        this.errorHandler
      );
    } else {
      return this.defaultRoute(req as ZeroRequest);
    }
  };

  add = (method: Methods, route: Pattern, ...fns: RequestHandler[]) => {
    let { keys, pattern } = parse(route as string);
    let handlers = [...fns];
    this.routes.push({
      keys,
      pattern,
      method,
      handlers,
      midx: MAP[method as unknown as MAP_key],
      origin_pattern: route,
    });
    return this;
  };
  use(pattern: RequestHandler, ...handlers: RequestHandler[]): this;
  use(router: IRouter): this;
  use(pattern: Pattern, ...handlers: RequestHandler[]): this;
  use(prefix: Pattern, router: IRouter): this;
  use(
    prefix: IRouter | Pattern | RequestHandler,
    ...middlewares: RequestHandler[] | [IRouter]
  ) {
    if (typeof prefix === "function") {
      middlewares = [
        prefix as RequestHandler,
        ...(middlewares as RequestHandler[]),
      ];
      prefix = "/";
    } else if (prefix instanceof IRouter) {
      // console.log("prefix.routes >>>", prefix.routes);
      this.routes.push(...prefix.routes);
      return;
    } else if (
      (typeof prefix === "string" || prefix instanceof RegExp) &&
      middlewares[0] instanceof IRouter
    ) {
      const sub_router = middlewares[0];
      sub_router.routes.forEach((route) => {
        // console.log("route >>>", route);
        const { keys, pattern } = parse(
          ((prefix as string) + route.origin_pattern) as string
        );
        this.routes.push({
          ...route,
          keys: Array.from(new Set([...route.keys, ...keys])),
          pattern,
          origin_pattern: (prefix as string) + route.origin_pattern,
        });
      });
      return;
    }

    // super.use(prefix as Pattern, ...(middlewares as Function[]));
    let handlers = [...(middlewares as RequestHandler[])];
    let { keys, pattern } = parse(prefix as string, true);
    this.routes.push({
      keys,
      pattern,
      method: "" as Methods,
      handlers,
      origin_pattern: prefix,
      midx: MAP[""],
    });
    return this;
  }
}

export default (config: IRouterConfig = {}) => {
  const router = new IRouter(config);
  router.port = config.port || 3000;
  return router;
};
