/* global Response */

const Trouter = require('trouter')
const next = require('./../next')

module.exports = (config = {}) => {
  if (!config.defaultRoute) {
    config.defaultRoute = (req) => {
      const res = new Response(null, {
        status: 404
      })

      return res
    }
  }
  if (!config.errorHandler) {
    config.errorHandler = (err, req) => {
      const res = new Response(err.message, {
        status: 500
      })

      return res
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

  router.fetch = (req, step) => {
    const url = new URL(req.url)
    req.path = url.pathname || '/'
    req.query = url.queryparams
    req.search = url.search
    req.hostname = url.hostname

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
