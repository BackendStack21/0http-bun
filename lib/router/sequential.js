/* global Response */

const Trouter = require('trouter')
const next = require('./../next')
const LRU = require('lru-cache')
const { parse } = require('regexparam')

module.exports = (config = {}) => {
  if (config.defaultRoute === undefined) {
    config.defaultRoute = (req) => {
      const res = new Response(null, {
        status: 404
      })

      return res
    }
  }
  if (config.errorHandler === undefined) {
    config.errorHandler = (err, req) => {
      const res = new Response(err.message, {
        status: 500
      })

      return res
    }
  }
  if (config.cacheSize === undefined) {
    config.cacheSize = 1000
  }
  if (config.id === undefined) {
    config.id = (Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).toUpperCase()
  }

  const routers = {}
  const isCacheEnabled = config.cacheSize > 0
  const cache = isCacheEnabled ? new LRU({ max: config.cacheSize }) : null
  const router = new Trouter()
  router.id = config.id

  const _use = router.use

  router.use = (prefix, ...middlewares) => {
    if (typeof prefix === 'function') {
      middlewares = [prefix, ...middlewares]
      prefix = '/'
    }
    _use.call(router, prefix, middlewares)

    if (middlewares[0].id) {
      // caching router -> pattern relation for urls pattern replacement
      const { pattern } = parse(prefix, true)
      routers[middlewares[0].id] = pattern
    }

    return this
  }

  router.lookup = (req, step) => {
    const url = new URL(req.url)
    req.path = url.pathname || '/'
    req.query = url.queryparams
    req.search = url.search
    req.hostname = url.hostname

    let match
    if (isCacheEnabled) {
      const reqCacheKey = req.method + req.path
      match = cache.get(reqCacheKey)
      if (!match) {
        match = router.find(req.method, req.path)
        cache.set(reqCacheKey, match)
      }
    } else {
      match = router.find(req.method, req.path)
    }

    if (match.handlers.length !== 0) {
      const middlewares = [...match.handlers]
      if (step !== undefined) {
        // router is being used as a nested router
        middlewares.push((req, next) => {
          req.path = req.preRouterPath

          delete req.preRouterPath

          return step()
        })
      }

      if (!req.params) {
        req.params = {}
      }
      Object.assign(req.params, match.params)

      return next(middlewares, req, 0, routers, config.defaultRoute, config.errorHandler)
    } else {
      return config.defaultRoute(req)
    }
  }

  router.on = (method, pattern, ...handlers) => router.add(method, pattern, handlers)

  return router
}
