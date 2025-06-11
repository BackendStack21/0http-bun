const {jwtVerify, createRemoteJWKSet, errors} = require('jose')

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
  } = options

  // API key mode doesn't require JWT secret
  const hasApiKeyMode = apiKeys || apiKeyValidator || validateApiKey
  if (!secret && !jwksUri && !jwks && !hasApiKeyMode) {
    throw new Error('JWT middleware requires either secret or jwksUri')
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
    keyLike = createRemoteJWKSet(new URL(jwksUri))
  } else if (typeof secret === 'function') {
    keyLike = secret
  } else {
    keyLike = secret
  }

  // Default JWT verification options
  const defaultJwtOptions = {
    algorithms: algorithms || ['HS256', 'RS256'],
    audience,
    issuer,
    ...jwtOptions,
  }

  return async function jwtAuthMiddleware(req, next) {
    const url = new URL(req.url)

    // Skip authentication for excluded paths
    if (excludePaths.some((path) => url.pathname.startsWith(path))) {
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
            // Set API key context
            req.ctx = req.ctx || {}
            req.ctx.apiKey = apiKey

            // If validation result is an object, use it as user data, otherwise default
            const userData =
              validationResult && typeof validationResult === 'object'
                ? validationResult
                : {apiKey}

            req.ctx.user = userData
            req.apiKey = apiKey
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
      const {payload, protectedHeader} = await jwtVerify(
        token,
        keyLike,
        defaultJwtOptions,
      )

      // Add user info to request context
      req.ctx = req.ctx || {}
      req.ctx.user = payload
      req.ctx.jwt = {
        payload,
        header: protectedHeader,
        token,
      }
      req.user = payload // Mirror to root for compatibility
      req.jwt = {
        payload,
        header: protectedHeader,
        token,
      }

      return next()
    } catch (error) {
      if (optional && (!hasApiKeyMode || !req.headers.get(apiKeyHeader))) {
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
    // Check if this is the simplified validateApiKey function (expects only key)
    if (apiKeyValidator.length === 1) {
      const result = await apiKeyValidator(apiKey)
      return result || false
    }
    // Otherwise call with both key and req
    const result = await apiKeyValidator(apiKey, req)
    return result || false
  }

  if (typeof apiKeys === 'function') {
    const result = await apiKeys(apiKey, req)
    return result || false
  }

  if (Array.isArray(apiKeys)) {
    return apiKeys.includes(apiKey)
  }

  return apiKeys === apiKey
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
      // Fall back to default handling if custom handler fails
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
      // Fall back to default response if custom response fails
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
  } else if (error instanceof errors.JWTExpired) {
    message = 'Token expired'
  } else if (error instanceof errors.JWTInvalid) {
    message = 'Invalid token format'
  } else if (error instanceof errors.JWKSNoMatchingKey) {
    message = 'Token signature verification failed'
  } else if (error.message.includes('audience')) {
    message = 'Invalid token audience'
  } else if (error.message.includes('issuer')) {
    message = 'Invalid token issuer'
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
      : (key) => (Array.isArray(keys) ? keys.includes(key) : keys === key)

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

      // Add API key info to context
      req.ctx = req.ctx || {}
      req.ctx.apiKey = apiKey

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
  extractToken,
  validateApiKeyInternal,
  handleAuthError,
}
