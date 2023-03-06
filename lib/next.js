module.exports = function next(middlewares, req, index, defaultRoute, errorHandler) {
  const middleware = middlewares[index]
  if (!middleware) {
    return defaultRoute(req)
  }

  function step(err) {
    if (err) {
      return errorHandler(err, req)
    } else {
      return next(middlewares, req, index + 1, defaultRoute, errorHandler)
    }
  }

  try {
    return middleware(req, step)
  } catch (err) {
    return errorHandler(err, req)
  }
}
