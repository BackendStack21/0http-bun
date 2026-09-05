const {Trouter} = require('trouter')
const qs = require('fast-querystring')
const next = require('./../next')
const {parseRequestUrl, sanitizeQuery, setCanonicalPath} = require('./../path')

const STATUS_404 = {
  status: 404,
}
const STATUS_500 = {
  status: 500,
}

const DANGEROUS_PARAM_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

module.exports = (config = {}) => {
  const cache = new Map()
  const cacheSize = config.cacheSize ?? 1000

  // Pre-create default responses to avoid object creation overhead
  const default404Response = new Response(null, STATUS_404)

  // Cache default functions to avoid closure creation
  const defaultRouteHandler = config.defaultRoute || (() => default404Response)
  const errorHandlerFn =
    config.errorHandler ||
    ((err) => {
      console.error(err)
      return new Response('Internal Server Error', STATUS_500)
    })

  // Optimize empty params/query object reuse (frozen to prevent cross-request mutation)
  const emptyParams = Object.freeze({})
  const emptyQuery = Object.freeze(Object.create(null))

  const router = new Trouter()
  router.port = config.port ?? 3000

  const _use = router.use

  router.use = (prefix, ...middlewares) => {
    if (typeof prefix === 'function') {
      middlewares = [prefix, ...middlewares]
      prefix = '/'
    }
    _use.call(router, prefix, middlewares)

    return router
  }

  router.fetch = (req) => {
    const {path: normalizedPath, queryString} = parseRequestUrl(req.url)

    setCanonicalPath(req, normalizedPath)
    if (queryString) {
      req.query = sanitizeQuery(qs.parse(queryString))
    } else {
      req.query = emptyQuery
    }

    // Optimized cache lookup with method-based Map structure
    const method = req.method
    let methodCache = cache.get(method)
    let match_result

    if (methodCache) {
      match_result = methodCache.get(normalizedPath)
      if (match_result === undefined) {
        match_result = router.find(method, normalizedPath)
        methodCache.set(normalizedPath, match_result)
        // LRU eviction: remove oldest entry when cache exceeds max size
        if (methodCache.size > cacheSize) {
          const firstKey = methodCache.keys().next().value
          methodCache.delete(firstKey)
        }
      } else {
        // LRU refresh: move accessed entry to end so it's evicted last
        methodCache.delete(normalizedPath)
        methodCache.set(normalizedPath, match_result)
      }
    } else {
      match_result = router.find(method, normalizedPath)
      methodCache = new Map([[normalizedPath, match_result]])
      cache.set(method, methodCache)
    }

    if (match_result?.handlers?.length > 0) {
      const params = match_result.params
      if (params) {
        let assigned = false
        for (const key in params) {
          if (
            !DANGEROUS_PARAM_KEYS.has(key) &&
            Object.prototype.hasOwnProperty.call(params, key)
          ) {
            if (!assigned) {
              req.params = req.params || {}
              assigned = true
            }
            req.params[key] = params[key]
          }
        }
        if (!assigned && !req.params) {
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
