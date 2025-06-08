const {Trouter} = require('trouter')
const qs = require('fast-querystring')
const next = require('./../next')

const STATUS_404 = {
  status: 404,
}
const STATUS_500 = {
  status: 500,
}

module.exports = (config = {}) => {
  const cache = new Map()

  // Pre-create default responses to avoid object creation overhead
  const default404Response = new Response(null, STATUS_404)

  // Cache default functions to avoid closure creation
  const defaultRouteHandler = config.defaultRoute || (() => default404Response)
  const errorHandlerFn =
    config.errorHandler || ((err) => new Response(err.message, STATUS_500))

  // Optimize empty params object reuse
  const emptyParams = {}

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
    const url = req.url

    // Highly optimized URL parsing - single pass through the string
    let pathStart = 0
    let pathEnd = url.length
    let queryString = null

    // Find protocol end
    const protocolEnd = url.indexOf('://')
    if (protocolEnd !== -1) {
      // Find host end (start of path)
      pathStart = url.indexOf('/', protocolEnd + 3)
      if (pathStart === -1) {
        pathStart = url.length
      }
    }

    // Find query start
    const queryStart = url.indexOf('?', pathStart)
    if (queryStart !== -1) {
      pathEnd = queryStart
      queryString = url.substring(queryStart + 1)
    }

    const path = pathStart < pathEnd ? url.substring(pathStart, pathEnd) : '/'

    req.path = path
    req.query = queryString ? qs.parse(queryString) : {}

    // Optimized cache lookup with method-based Map structure
    const method = req.method
    let methodCache = cache.get(method)
    let match_result

    if (methodCache) {
      match_result = methodCache.get(path)
      if (match_result === undefined) {
        match_result = router.find(method, path)
        methodCache.set(path, match_result)
      }
    } else {
      match_result = router.find(method, path)
      methodCache = new Map([[path, match_result]])
      cache.set(method, methodCache)
    }

    if (match_result?.handlers?.length > 0) {
      // Fast path for params assignment
      const params = match_result.params
      if (params) {
        // Check if params object has properties without Object.keys()
        let hasParams = false
        for (const key in params) {
          hasParams = true
          break
        }

        if (hasParams) {
          req.params = req.params || {}
          // Direct property copy - faster than Object.keys() + loop
          for (const key in params) {
            req.params[key] = params[key]
          }
        } else if (!req.params) {
          req.params = emptyParams
        }
      } else if (!req.params) {
        req.params = emptyParams
      }

      return next(
        match_result.handlers,
        req,
        0,
        defaultRouteHandler,
        errorHandlerFn,
      )
    } else {
      return defaultRouteHandler(req)
    }
  }

  router.on = (method, pattern, ...handlers) =>
    router.add(method, pattern, handlers)

  return router
}
