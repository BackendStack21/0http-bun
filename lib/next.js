module.exports = function next (middlewares, req, index, routers = {}, defaultRoute, errorHandler) {
  const middleware = middlewares[index]
  if (!middleware) {
    return defaultRoute(req)
  }

  function step (err) {
    if (err) {
      return errorHandler(err, req)
    } else {
      return next(middlewares, req, index + 1, routers, defaultRoute, errorHandler)
    }
  }

  try {
    if (middleware.id) {
      // nested routes support
      const pattern = routers[middleware.id]
      if (pattern) {
        req.preRouterPath = req.path

        req.path = req.path.replace(pattern, '')
        if (!req.path.startsWith('/')) {
          req.path = '/' + req.path
        }
      }

      return middleware.lookup(req, step)
    } else {
      return middleware(req, step)
    }
  } catch (err) {
    return errorHandler(err, req)
  }
}
