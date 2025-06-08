module.exports = function next(
  middlewares,
  req,
  index,
  defaultRoute,
  errorHandler,
) {
  // Optimized loop unrolling for common cases
  const length = middlewares.length
  if (index >= length) {
    return defaultRoute(req)
  }

  const middleware = middlewares[index]
  const nextIndex = index + 1

  try {
    return middleware(req, (err) => {
      if (err) {
        return errorHandler(err, req)
      }
      return next(middlewares, req, nextIndex, defaultRoute, errorHandler)
    })
  } catch (err) {
    return errorHandler(err, req)
  }
}
