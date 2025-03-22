const { Trouter } = require("trouter")
const qs = require("fast-querystring")
const next = require("./../next")

const STATUS_404 = {
  status: 404,
}
const STATUS_500 = {
  status: 500,
}

module.exports = (config = {}) => {
  const cache = new Map()

  if (!config.defaultRoute) {
    config.defaultRoute = () => {
      return new Response(null, STATUS_404)
    }
  }
  if (!config.errorHandler) {
    config.errorHandler = (err) => {
      return new Response(err.message, STATUS_500)
    }
  }

  const router = new Trouter()
  router.port = config.port || 3000

  const _use = router.use

  router.use = (prefix, ...middlewares) => {
    if (typeof prefix === "function") {
      middlewares = [prefix, ...middlewares]
      prefix = "/"
    }
    _use.call(router, prefix, middlewares)

    return this
  }

  router.fetch = (req) => {
    const url = req.url
    const startIndex = url.indexOf("/", 11)
    const queryIndex = url.indexOf("?", startIndex + 1)
    const path =
      queryIndex === -1
        ? url.substring(startIndex)
        : url.substring(startIndex, queryIndex)

    req.path = path || "/"
    req.query = queryIndex > 0 ? qs.parse(url.substring(queryIndex + 1)) : {}

    const cacheKey = `${req.method}:${req.path}`
    let match = null
    if (cache.has(cacheKey)) {
      match = cache.get(cacheKey)
    } else {
      match = router.find(req.method, req.path)
      cache.set(cacheKey, match)
    }

    if (match?.handlers?.length > 0) {
      if (!req.params) {
        req.params = {}
      }
      Object.assign(req.params, match.params)

      return next(
        match.handlers,
        req,
        0,
        config.defaultRoute,
        config.errorHandler
      )
    } else {
      return config.defaultRoute(req)
    }
  }

  router.on = (method, pattern, ...handlers) =>
    router.add(method, pattern, handlers)

  return router
}
