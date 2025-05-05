module.exports = function next(
  middlewares,
  req,
  index,
  defaultRoute,
  errorHandler,
) {
  if (index >= middlewares.length) {
    return defaultRoute(req)
  }

  const middleware = middlewares[index++]

  try {
    return middleware(req, (err) => {
      if (err) {
        return errorHandler(err, req)
      }
      return next(middlewares, req, index, defaultRoute, errorHandler)
    })
  } catch (err) {
    return errorHandler(err, req)
  }
}
