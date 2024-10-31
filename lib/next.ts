import type { RequestHandler, ZeroRequest } from "../common";
const next = (
  middlewares: RequestHandler[],
  req: ZeroRequest,
  index: number,
  defaultRoute: (req: ZeroRequest) => Response,
  errorHandler: (
    err: Error | unknown,
    req: Request
  ) => Response | Promise<Response>
) => {
  if (index >= middlewares.length) {
    return defaultRoute(req);
  }
  const middleware = middlewares[index++];
  try {
    return middleware(req, (err?: unknown): any => {
      if (err) {
        return errorHandler(err, req);
      }
      return next(middlewares, req, index, defaultRoute, errorHandler);
    });
  } catch (err) {
    return errorHandler(err, req);
  }
};

export default next;
