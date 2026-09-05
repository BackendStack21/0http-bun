/**
 * Shared URL/path helpers used by the router and middleware.
 *
 * Goals:
 * - One canonical pathname for routing AND excludePaths checks
 * - Resolve `.` / `..` after decoding so `%2e%2e` cannot bypass filters
 * - Preserve encoded slashes (`%2F`) so they cannot be used as segment separators
 * - Avoid `new URL()` allocations on the hot path when `req.path` is already set
 */

const DANGEROUS_QUERY_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Write-once canonical pathname. Security middleware must not trust `req.path`,
 * which application code can overwrite.
 */
const CANONICAL_PATH_SYMBOL = Symbol.for('0http.canonicalPath')

/**
 * Split a request URL into pathname and raw query string without using `new URL()`.
 * @param {string} url
 * @returns {{rawPath: string, queryString: string|null}}
 */
function splitUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return {rawPath: '/', queryString: null}
  }

  let pathStart = 0
  let pathEnd = url.length
  let queryString = null

  const protocolEnd = url.indexOf('://')
  if (protocolEnd !== -1) {
    pathStart = url.indexOf('/', protocolEnd + 3)
    if (pathStart === -1) {
      pathStart = url.length
    }
  }

  const queryStart = url.indexOf('?', pathStart)
  if (queryStart !== -1) {
    pathEnd = queryStart
    queryString = url.substring(queryStart + 1)
  }

  const rawPath = pathStart < pathEnd ? url.substring(pathStart, pathEnd) : '/'
  return {rawPath, queryString}
}

/**
 * Resolve `.` and `..` segments. Never walks above the root.
 * @param {string} path
 * @returns {string}
 */
function resolveDotSegments(path) {
  const parts = path.split('/')
  const stack = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '' || part === '.') continue
    if (part === '..') {
      stack.pop()
      continue
    }
    stack.push(part)
  }
  return '/' + stack.join('/')
}

/**
 * Canonicalize a pathname: collapse slashes, decode (preserving %2F), resolve dots.
 * @param {string} path
 * @returns {string}
 */
function normalizePathname(path) {
  if (!path || path === '/') return '/'

  let normalized = path.startsWith('/') ? path : '/' + path
  if (normalized.includes('//')) {
    normalized = normalized.replace(/\/\/+/g, '/')
  }

  if (normalized.includes('%')) {
    try {
      normalized = decodeURIComponent(normalized.replace(/%2[fF]/g, '%252F'))
    } catch (_) {
      // Malformed URI — keep the collapsed path
    }
  }

  if (normalized.includes('.')) {
    normalized = resolveDotSegments(normalized)
  }

  return normalized || '/'
}

/**
 * Parse a request URL into a canonical path + raw query string.
 * @param {string} url
 * @returns {{path: string, queryString: string|null}}
 */
function parseRequestUrl(url) {
  const {rawPath, queryString} = splitUrl(url)
  return {path: normalizePathname(rawPath), queryString}
}

/**
 * Record the router-canonical path. `req.path` is set for app code; the
 * non-enumerable symbol is what security middleware trusts.
 * @param {object} req
 * @param {string} path
 */
function setCanonicalPath(req, path) {
  if (!req) return
  try {
    Object.defineProperty(req, CANONICAL_PATH_SYMBOL, {
      value: path,
      writable: false,
      configurable: false,
      enumerable: false,
    })
  } catch (_) {
    if (typeof req[CANONICAL_PATH_SYMBOL] !== 'string') {
      req[CANONICAL_PATH_SYMBOL] = path
    }
  }
  req.path = path
}

/**
 * Canonical pathname for security checks.
 * Prefers the write-once symbol set by the router; never trusts mutable `req.path`.
 * @param {{path?: string, url?: string}} req
 * @returns {string}
 */
function getRequestPath(req) {
  if (req && typeof req[CANONICAL_PATH_SYMBOL] === 'string') {
    return req[CANONICAL_PATH_SYMBOL]
  }
  return parseRequestUrl(req && req.url ? req.url : '').path
}

/**
 * Exact or boundary match (NOT prefix).
 * `/health` matches `/health` and `/health/live`, but not `/healthcheck`.
 * @param {string} pathname
 * @param {string[]} excludePaths
 * @returns {boolean}
 */
function isExcludedPath(pathname, excludePaths) {
  if (!excludePaths || excludePaths.length === 0) return false
  for (let i = 0; i < excludePaths.length; i++) {
    const p = excludePaths[i]
    if (pathname === p || (p.length > 0 && pathname.startsWith(p + '/'))) {
      return true
    }
  }
  return false
}

/**
 * Remove prototype-pollution keys from a parsed query object.
 * @param {Record<string, unknown>} query
 * @returns {Record<string, unknown>}
 */
function sanitizeQuery(query) {
  if (!query) return query
  delete query['__proto__']
  delete query['constructor']
  delete query['prototype']
  return query
}

module.exports = {
  CANONICAL_PATH_SYMBOL,
  DANGEROUS_QUERY_KEYS,
  splitUrl,
  resolveDotSegments,
  normalizePathname,
  parseRequestUrl,
  setCanonicalPath,
  getRequestPath,
  isExcludedPath,
  sanitizeQuery,
}
