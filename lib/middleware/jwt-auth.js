// Lazy load jose to improve startup performance
let joseLib = null
function loadJose() {
  if (!joseLib) {
    try {
      joseLib = require('jose')
    } catch (error) {
      throw new Error(
        'jose is required for JWT middleware. Install it with: bun install jose',
      )
    }
  }
  return joseLib
}

const crypto = require('crypto')

/**
 * Symbol key for storing raw API key to prevent accidental serialization (M-7 fix)
 */
const API_KEY_SYMBOL = Symbol.for('0http.apiKey')

/**
 * Masks an API key for safe storage/logging.
 * Shows first 4 and last 4 characters, masks the rest.
 * @param {string} key - Raw API key
 * @returns {string} Masked key
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '****'
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    // Still perform comparison to maintain constant time
    crypto.timingSafeEqual(aBuf, aBuf)
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

/**
 * Creates JWT authentication middleware
 * @param {Object} options - JWT configuration options
 * @param {string|Uint8Array|Function} options.secret - JWT secret or key getter function
 * @param {string} options.jwksUri - JWKS URI for remote key verification
 * @param {Object} options.jwtOptions - Additional JWT verification options
 * @param {Function} options.getToken - Custom token extraction function
 * @param {string} options.tokenHeader - Custom header for token extraction
 * @param {string} options.tokenQuery - Query parameter name for token extraction
 * @param {boolean} options.optional - Whether authentication is optional
 * @param {Array<string>} options.excludePaths - Paths to exclude from authentication
 * @param {Array<string>|Function} options.apiKeys - Valid API keys for API key authentication
 * @param {string} options.apiKeyHeader - Header name for API key
 * @param {Function} options.apiKeyValidator - Custom API key validation function
 * @param {Function} options.unauthorizedResponse - Custom unauthorized response generator
 * @param {Function} options.onError - Custom error handler
 * @param {string|Array<string>} options.audience - Expected JWT audience
 * @param {string} options.issuer - Expected JWT issuer
 * @returns {Function} Middleware function
 */
function createJWTAuth(options = {}) {
  const {
    secret,
    jwksUri,
    jwks,
    jwtOptions = {},
    getToken,
    tokenHeader,
    tokenQuery,
    optional = false,
    excludePaths = [],
    apiKeys,
    apiKeyHeader = 'x-api-key',
    apiKeyValidator,
    validateApiKey,
    unauthorizedResponse,
    onError,
    audience,
    issuer,
    algorithms,
    requiredTokenType,
  } = options

  // API key mode doesn't require JWT secret
  const hasApiKeyMode = apiKeys || apiKeyValidator || validateApiKey
  if (!secret && !jwksUri && !jwks && !hasApiKeyMode) {
    throw new Error('JWT middleware requires either secret or jwksUri')
  }

  // H-8: Warn about security risk of JWT tokens in query parameters
  if (tokenQuery) {
    console.warn(
      `[0http-bun] SECURITY WARNING: JWT tokenQuery ("${tokenQuery}") is deprecated. ` +
        'Tokens in query parameters are logged in server access logs, browser history, and Referer headers. ' +
        'Use Authorization header or a custom getToken function instead.',
    )
  }

  // M-8: Validate JWKS URI uses HTTPS in production
  if (jwksUri) {
    const parsedUri = new URL(jwksUri)
    if (
      parsedUri.protocol !== 'https:' &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new Error(
        'JWT middleware: JWKS URI must use HTTPS in production to prevent MitM key substitution. ' +
          `Got: ${parsedUri.protocol}// Set NODE_ENV to a non-production value to bypass this check.`,
      )
    }
    if (parsedUri.protocol !== 'https:') {
      console.warn(
        `[0http-bun] SECURITY WARNING: JWKS URI "${jwksUri}" uses ${parsedUri.protocol} instead of https:. ` +
          'This is insecure and will be rejected in production (NODE_ENV=production).',
      )
    }
  }

  // Setup key resolver for JWT
  let keyLike
  if (jwks) {
    // If jwks is a mock or custom resolver with getKey method
    if (typeof jwks.getKey === 'function') {
      keyLike = async (protectedHeader, token) => {
        return jwks.getKey(protectedHeader, token)
      }
    } else {
      keyLike = jwks
    }
  } else if (jwksUri) {
    const {createRemoteJWKSet} = loadJose()
    keyLike = createRemoteJWKSet(new URL(jwksUri))
  } else if (typeof secret === 'function') {
    keyLike = secret
  } else {
    keyLike = secret
  }

  // Default JWT verification options
  const resolvedAlgorithms = algorithms || jwtOptions.algorithms || ['HS256']

  // Prevent algorithm confusion attacks
  const hasSymmetric = resolvedAlgorithms.some((alg) => alg.startsWith('HS'))
  const hasAsymmetric = resolvedAlgorithms.some(
    (alg) =>
      alg.startsWith('RS') || alg.startsWith('ES') || alg.startsWith('PS'),
  )
  if (hasSymmetric && hasAsymmetric) {
    throw new Error(
      'JWT middleware: mixing symmetric (HS*) and asymmetric (RS*/ES*/PS*) algorithms is not allowed. This prevents algorithm confusion attacks.',
    )
  }

  const defaultJwtOptions = {
    ...jwtOptions,
    algorithms: resolvedAlgorithms,
    audience,
    issuer,
  }

  return async function jwtAuthMiddleware(req, next) {
    const url = new URL(req.url)

    // Skip authentication for excluded paths
    if (
      excludePaths.some(
        (path) => url.pathname === path || url.pathname.startsWith(path + '/'),
      )
    ) {
      return next()
    }

    try {
      // Try API key authentication first if configured
      if (hasApiKeyMode) {
        const apiKey = req.headers.get(apiKeyHeader)
        if (apiKey) {
          const validationResult = await validateApiKeyInternal(
            apiKey,
            apiKeys,
            apiKeyValidator || validateApiKey,
            req,
          )
          if (validationResult !== false) {
            // Set API key context — store masked version to prevent leakage (M-7 fix)
            req.ctx = req.ctx || {}
            req.ctx.apiKey = maskApiKey(apiKey)
            req[API_KEY_SYMBOL] = apiKey // Raw key via Symbol for programmatic access only

            // If validation result is an object, use it as user data, otherwise default
            const userData =
              validationResult && typeof validationResult === 'object'
                ? validationResult
                : {apiKey: maskApiKey(apiKey)}

            req.ctx.user = userData
            req.apiKey = maskApiKey(apiKey)
            req.user = userData
            return next()
          } else {
            return handleAuthError(
              new Error('Invalid API key'),
              {unauthorizedResponse, onError},
              req,
            )
          }
        }
      }

      // Extract JWT token from request
      const token = extractToken(req, {getToken, tokenHeader, tokenQuery})

      if (!token) {
        if (optional) {
          return next()
        }
        return handleAuthError(
          new Error('Authentication required'),
          {unauthorizedResponse, onError},
          req,
        )
      }

      // Only verify JWT if we have JWT configuration
      if (!keyLike) {
        return handleAuthError(
          new Error('JWT verification not configured'),
          {unauthorizedResponse, onError},
          req,
        )
      }

      // Verify JWT token
      const {jwtVerify} = loadJose()
      const {payload, protectedHeader} = await jwtVerify(
        token,
        keyLike,
        defaultJwtOptions,
      )

      // L-4: Validate JWT token type header if configured
      if (requiredTokenType) {
        const tokenType = protectedHeader.typ
        if (
          !tokenType ||
          tokenType.toLowerCase() !== requiredTokenType.toLowerCase()
        ) {
          return handleAuthError(
            new Error('Invalid token type'),
            {unauthorizedResponse, onError},
            req,
          )
        }
      }

      // Add user info to request context
      req.ctx = req.ctx || {}
      req.ctx.user = payload
      req.ctx.jwt = {
        payload,
        header: protectedHeader,
      }
      req.user = payload // Mirror to root for compatibility
      req.jwt = {
        payload,
        header: protectedHeader,
      }

      return next()
    } catch (error) {
      if (optional && (!hasApiKeyMode || !req.headers.get(apiKeyHeader))) {
        req.ctx = req.ctx || {}
        req.ctx.authError = error.message
        req.ctx.authAttempted = true
        return next()
      }

      return handleAuthError(error, {unauthorizedResponse, onError}, req)
    }
  }
}

/**
 * Validates API key
 * @param {string} apiKey - API key to validate
 * @param {Array<string>|Function} apiKeys - Valid API keys or validator function
 * @param {Function} apiKeyValidator - Custom validator function
 * @param {Request} req - Request object
 * @returns {boolean|Object} Whether API key is valid or user object
 */
async function validateApiKeyInternal(apiKey, apiKeys, apiKeyValidator, req) {
  if (apiKeyValidator) {
    const result = await apiKeyValidator(apiKey, req)
    return result || false
  }

  if (typeof apiKeys === 'function') {
    const result = await apiKeys(apiKey, req)
    return result || false
  }

  if (Array.isArray(apiKeys)) {
    return apiKeys.some((key) => timingSafeCompare(key, apiKey))
  }

  return timingSafeCompare(apiKeys, apiKey)
}

/**
 * Extracts JWT token from request
 * @param {Request} req - Request object
 * @param {Object} options - Extraction options
 * @returns {string|null} JWT token or null if not found
 */
function extractToken(req, options = {}) {
  const {getToken, tokenHeader, tokenQuery} = options

  // Use custom token extractor if provided
  if (getToken) {
    return getToken(req)
  }

  // Try custom header
  if (tokenHeader) {
    const token = req.headers.get(tokenHeader)
    if (token) return token
  }

  // Try query parameter
  if (tokenQuery) {
    const url = new URL(req.url)
    const token = url.searchParams.get(tokenQuery)
    if (token) return token
  }

  // Default: Authorization header
  return extractTokenFromHeader(req)
}

/**
 * Handles authentication errors
 * @param {Error} error - Authentication error
 * @param {Object} handlers - Error handling functions
 * @param {Request} req - Request object
 * @returns {Response} Error response
 */
function handleAuthError(error, handlers = {}, req) {
  const {unauthorizedResponse, onError} = handlers

  // Call custom error handler if provided
  if (onError) {
    try {
      const result = onError(error, req)
      if (result instanceof Response) {
        return result
      }
    } catch (handlerError) {
      // I-4: Log errors from custom handlers to aid debugging
      console.error('[0http-bun] Custom onError handler threw:', handlerError)
    }
  }

  // Use custom unauthorized response if provided
  if (unauthorizedResponse) {
    try {
      // If it's already a Response object, return it directly
      if (unauthorizedResponse instanceof Response) {
        return unauthorizedResponse
      }

      // If it's a function, call it
      if (typeof unauthorizedResponse === 'function') {
        const response = unauthorizedResponse(error, req)
        if (response instanceof Response) {
          return response
        }
        // If not a Response object, treat as response data
        if (response && typeof response === 'object') {
          return new Response(
            typeof response.body === 'string'
              ? response.body
              : JSON.stringify(response.body || response),
            {
              status: response.status || 401,
              headers: response.headers || {'Content-Type': 'application/json'},
            },
          )
        }
      }
    } catch (responseError) {
      // I-4: Log errors from custom response handlers to aid debugging
      console.error(
        '[0http-bun] Custom unauthorizedResponse handler threw:',
        responseError,
      )
    }
  }

  // Default error handling
  let statusCode = 401
  let message = 'Invalid token'

  if (error.message === 'Authentication required') {
    message = 'Authentication required'
  } else if (error.message === 'Invalid API key') {
    message = 'Invalid API key'
  } else if (error.message === 'JWT verification not configured') {
    message = 'JWT verification not configured'
  } else if (error.message === 'Invalid token type') {
    message = 'Invalid token type'
  } else {
    message = 'Invalid or expired token'
  }

  return new Response(JSON.stringify({error: message}), {
    status: statusCode,
    headers: {'Content-Type': 'application/json'},
  })
}

/**
 * Extracts JWT token from Authorization header
 * @param {Request} req - Request object
 * @returns {string|null} JWT token or null if not found
 */
function extractTokenFromHeader(req) {
  const authorization = req.headers.get('authorization')

  if (!authorization) {
    return null
  }

  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }

  return parts[1]
}

/**
 * Creates a simple API key authentication middleware
 * @param {Object} options - API key configuration
 * @param {string|Array<string>|Function} options.keys - Valid API keys or validation function
 * @param {string} options.header - Header name for API key (default: 'x-api-key')
 * @param {Function} options.getKey - Custom key extraction function
 * @returns {Function} Middleware function
 */
function createAPIKeyAuth(options = {}) {
  const {keys, header = 'x-api-key', getKey} = options

  if (!keys) {
    throw new Error('API key middleware requires keys configuration')
  }

  const validateKey =
    typeof keys === 'function'
      ? keys
      : (key) =>
          Array.isArray(keys)
            ? keys.some((k) => timingSafeCompare(k, key))
            : timingSafeCompare(keys, key)

  return async function apiKeyAuthMiddleware(req, next) {
    try {
      // Extract API key
      const apiKey = getKey ? getKey(req) : req.headers.get(header)

      if (!apiKey) {
        return new Response(JSON.stringify({error: 'API key required'}), {
          status: 401,
          headers: {'Content-Type': 'application/json'},
        })
      }

      // Validate API key
      const isValid = await validateKey(apiKey, req)

      if (!isValid) {
        return new Response(JSON.stringify({error: 'Invalid API key'}), {
          status: 401,
          headers: {'Content-Type': 'application/json'},
        })
      }

      // Add API key info to context — store masked version (M-7 fix)
      req.ctx = req.ctx || {}
      req.ctx.apiKey = maskApiKey(apiKey)
      req[API_KEY_SYMBOL] = apiKey // Raw key via Symbol for programmatic access only

      return next()
    } catch (error) {
      return new Response(JSON.stringify({error: 'Authentication failed'}), {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      })
    }
  }
}

module.exports = {
  createJWTAuth,
  createAPIKeyAuth,
  extractTokenFromHeader,
  API_KEY_SYMBOL,
  maskApiKey,
}
