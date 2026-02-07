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
    const result = middleware(req, (err) => {
      if (err) {
        return errorHandler(err, req)
      }
      return next(middlewares, req, nextIndex, defaultRoute, errorHandler)
    })

    // Catch rejected promises from async middleware
    if (result && typeof result.catch === 'function') {
      return result.catch((err) => errorHandler(err, req))
    }

    return result
  } catch (err) {
    return errorHandler(err, req)
  }
}
