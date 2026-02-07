/**
 * In-memory rate limiter implementation
 * For production use, consider using Redis-based storage
 */
class MemoryStore {
  constructor() {
    this.store = new Map()
    this.resetTimes = new Map()
  }

  increment(key, windowMs) {
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    const storeKey = `${key}:${windowStart}`

    // Clean up old entries
    this.cleanup(now)

    const current = this.store.get(storeKey) || 0
    const newValue = current + 1

    this.store.set(storeKey, newValue)
    this.resetTimes.set(storeKey, windowStart + windowMs)

    return {
      totalHits: newValue,
      resetTime: new Date(windowStart + windowMs),
    }
  }

  cleanup(now) {
    for (const [key, resetTime] of this.resetTimes.entries()) {
      if (now >= resetTime) {
        this.store.delete(key)
        this.resetTimes.delete(key)
      }
    }
  }

  async reset(key) {
    for (const [storeKey] of this.store.entries()) {
      if (storeKey.startsWith(key + ':')) {
        this.store.delete(storeKey)
        this.resetTimes.delete(storeKey)
      }
    }
  }
}

/**
 * Creates a rate limiting middleware
 * @param {Object} options - Rate limiter configuration
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum number of requests per window (default: 100)
 * @param {Function} options.keyGenerator - Function to generate rate limit key from request
 * @param {Function} options.handler - Custom handler for rate limit exceeded
 * @param {string} options.message - Custom message for rate limit exceeded (plain text)
 * @param {Object} options.store - Custom store implementation
 * @param {boolean} options.standardHeaders - Whether to send standard rate limit headers
 * @param {Array<string>} options.excludePaths - Paths to exclude from rate limiting
 * @param {Function} options.skip - Function to determine if request should be skipped
 * @returns {Function} Middleware function
 */
function createRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler,
    message,
    store = new MemoryStore(),
    standardHeaders = true,
    excludePaths = [],
    skip,
  } = options

  /**
   * Helper function to add rate limit headers to a response
   * @param {Response} response - Response object to add headers to
   * @param {number} totalHits - Current hit count
   * @param {Date} resetTime - When the rate limit resets
   * @returns {Response} Response with headers added
   */
  const addRateLimitHeaders = (response, totalHits, resetTime) => {
    if (!standardHeaders || !response?.headers) return response

    if (standardHeaders === 'minimal') {
      // L-6: Only add Retry-After on 429 responses to avoid disclosing config
      if (response.status === 429) {
        const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        response.headers.set('Retry-After', Math.max(0, retryAfter).toString())
      }
      return response
    }

    // Full headers (standardHeaders === true)
    response.headers.set('X-RateLimit-Limit', max.toString())
    response.headers.set(
      'X-RateLimit-Remaining',
      Math.max(0, max - totalHits).toString(),
    )
    response.headers.set(
      'X-RateLimit-Reset',
      Math.ceil(resetTime.getTime() / 1000).toString(),
    )
    response.headers.set('X-RateLimit-Used', totalHits.toString())
    return response
  }

  return async function rateLimitMiddleware(req, next) {
    const activeStore = store

    const url = new URL(req.url)
    if (
      excludePaths.some(
        (path) => url.pathname === path || url.pathname.startsWith(path + '/'),
      )
    ) {
      return next()
    }

    // Check skip function first - if it returns true, completely bypass rate limiting
    if (typeof skip === 'function' && skip(req)) {
      return next()
    }

    // Generate key and record the request immediately - let errors bubble up
    const key = await keyGenerator(req)
    const {totalHits, resetTime} = await activeStore.increment(key, windowMs)

    // Check if rate limit exceeded
    if (totalHits > max) {
      let response

      // If a custom message is provided, use it as plain text
      if (message) {
        response = new Response(message, {status: 429})
      } else {
        response = await handler(req, totalHits, max, resetTime)
        if (typeof response === 'string') {
          response = new Response(response, {status: 429})
        }
      }

      return addRateLimitHeaders(response, totalHits, resetTime)
    }

    // Set rate limit context
    req.ctx = req.ctx || {}
    req.ctx.rateLimit = {
      limit: max,
      used: totalHits,
      remaining: Math.max(0, max - totalHits),
      resetTime,
      current: totalHits,
      reset: resetTime,
    }
    req.rateLimit = {
      limit: max,
      remaining: Math.max(0, max - totalHits),
      current: totalHits,
      reset: resetTime,
    }

    // Continue with request processing - let any errors bubble up
    const response = await next()
    if (response instanceof Response) {
      return addRateLimitHeaders(response, totalHits, resetTime)
    }
    return response
  }
}

/**
 * Default key generator - uses connection-level IP address
 * Checks req.ip, req.remoteAddress, and req.socket?.remoteAddress in order.
 * NOTE: If behind a reverse proxy, provide a custom keyGenerator that
 * reads the appropriate header after configuring your proxy to set it.
 * @param {Request} req - Request object
 * @returns {string} Rate limit key
 */
let _unknownKeyWarned = false

function defaultKeyGenerator(req) {
  // Use connection-level IP if available (set by Bun's server or upstream middleware)
  const ip = req.ip || req.remoteAddress || req.socket?.remoteAddress
  if (ip) return ip

  // I-1: Generate unique key per request to avoid shared bucket DoS
  if (!_unknownKeyWarned) {
    console.warn(
      '[0http-bun] SECURITY WARNING: Rate limiter cannot determine client IP. ' +
        'Each request without an IP gets a unique key (no shared bucket). ' +
        'Configure a custom keyGenerator for proper rate limiting behind proxies.',
    )
    _unknownKeyWarned = true
  }
  return `unknown:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

/**
 * Default rate limit exceeded handler
 * @param {Request} req - Request object
 * @param {number} totalHits - Current hit count
 * @param {number} max - Maximum allowed hits
 * @param {Date} resetTime - When the rate limit resets
 * @returns {Response} Response object
 */
function defaultHandler(req, totalHits, max, resetTime) {
  const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    },
  )
}

/**
 * Creates a sliding window rate limiter
 * More precise than fixed window but uses more memory
 * @param {Object} options - Rate limiter configuration
 * @returns {Function} Middleware function
 */
function createSlidingWindowRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler,
    maxKeys = 10000,
  } = options

  const requests = new Map() // key -> array of timestamps

  // Periodic cleanup of stale entries
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [key, timestamps] of requests.entries()) {
        const filtered = timestamps.filter((ts) => now - ts < windowMs)
        if (filtered.length === 0) {
          requests.delete(key)
        } else {
          requests.set(key, filtered)
        }
      }
    },
    Math.min(windowMs, 60000),
  ) // Clean up at most every minute

  // Allow garbage collection if reference is lost
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return async function slidingWindowRateLimitMiddleware(req, next) {
    // Generate key and record the request immediately - let errors bubble up
    const key = await keyGenerator(req)
    const now = Date.now()

    // Get existing requests for this key
    let userRequests = requests.get(key) || []

    // Remove old requests outside the window
    userRequests = userRequests.filter(
      (timestamp) => now - timestamp < windowMs,
    )

    // Check if limit exceeded
    if (userRequests.length >= max) {
      const response = await handler(
        req,
        userRequests.length,
        max,
        new Date(now + windowMs),
      )
      return response
    }

    // Add current request
    userRequests.push(now)
    requests.set(key, userRequests)

    // Enforce max keys to prevent unbounded memory growth
    if (requests.size > maxKeys) {
      // Remove oldest entry
      const firstKey = requests.keys().next().value
      requests.delete(firstKey)
    }

    // Add rate limit info to context
    req.ctx = req.ctx || {}
    req.ctx.rateLimit = {
      limit: max,
      used: userRequests.length,
      remaining: max - userRequests.length,
      resetTime: new Date(userRequests[0] + windowMs),
    }

    return next()
  }
}

module.exports = {
  createRateLimit,
  createSlidingWindowRateLimit,
  MemoryStore,
  defaultKeyGenerator,
  defaultHandler,
}
