const Trouter = require('trouter')
const next = require('./../next')

const status404 = {
  status: 404
}
const status500 = {
  status: 500
}

module.exports = (config = {}) => {
  if (!config.defaultRoute) {
    config.defaultRoute = () => {
      return new Response(null, status404)
    }
  }
  if (!config.errorHandler) {
    config.errorHandler = (err) => {
      return new Response(err.message, status500)
    }
  }

  const router = new Trouter()
  router.port = config.port || 3000

  const _use = router.use

  router.use = (prefix, ...middlewares) => {
    if (typeof prefix === 'function') {
      middlewares = [prefix, ...middlewares]
      prefix = '/'
    }
    _use.call(router, prefix, middlewares)

    return this
  }

  router.fetch = (req) => {
    const url = new URL(req.url)

    req.path = url.pathname || '/'
    req.query = url.queryparams

    const match = router.find(req.method, req.path)
    if (match.handlers.length > 0) {
      if (!req.params) {
        req.params = {}
      }
      Object.assign(req.params, match.params)

      return next(match.handlers, req, 0, config.defaultRoute, config.errorHandler)
    } else {
      return config.defaultRoute(req)
    }
  }

  router.on = (method, pattern, ...handlers) => router.add(method, pattern, handlers)

  return router
}
