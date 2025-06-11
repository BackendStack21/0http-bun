/**
 * Advanced Body Parser Middleware for 0http-bun
 * Supports JSON, text, URL-encoded, and multipart form data parsing
 *
 * Security Features:
 * - Protected against prototype pollution attacks
 * - ReDoS (Regular Expression Denial of Service) protection
 * - Memory exhaustion prevention with strict size limits
 * - Excessive nesting protection for JSON
 * - Parameter count limits for form data
 * - Input validation and sanitization
 * - Error message sanitization to prevent information leakage
 */

/**
 * Parses size limit strings with suffixes (e.g. '500b', '1kb', '2mb')
 * @param {number|string} limit - Size limit
 * @returns {number} Size in bytes
 */
function parseLimit(limit) {
  if (typeof limit === 'number') {
    // Enforce maximum limit to prevent memory exhaustion
    return Math.min(Math.max(0, limit), 1024 * 1024 * 1024) // Max 1GB
  }

  if (typeof limit === 'string') {
    // Prevent ReDoS by limiting string length and using a more restrictive regex
    if (limit.length > 20) {
      throw new Error(`Invalid limit format: ${limit}`)
    }

    // More restrictive regex to prevent ReDoS attacks
    const match = limit.match(/^(\d{1,10}(?:\.\d{1,3})?)\s*(b|kb|mb|gb)$/i)
    if (!match) {
      throw new Error(`Invalid limit format: ${limit}`)
    }

    const value = parseFloat(match[1])
    if (isNaN(value) || value < 0) {
      throw new Error(`Invalid limit value: ${limit}`)
    }

    const unit = match[2].toLowerCase()

    let bytes
    switch (unit) {
      case 'b':
        bytes = value
        break
      case 'kb':
        bytes = value * 1024
        break
      case 'mb':
        bytes = value * 1024 * 1024
        break
      case 'gb':
        bytes = value * 1024 * 1024 * 1024
        break
      default:
        bytes = value
    }

    // Enforce maximum limit to prevent memory exhaustion
    return Math.min(bytes, 1024 * 1024 * 1024) // Max 1GB
  }

  return limit || 1024 * 1024 // Default 1MB
}

/**
 * Helper function to check if content type matches any of the JSON types
 * @param {string} contentType - Content type from request
 * @param {string[]} jsonTypes - Array of JSON content types
 * @returns {boolean} Whether content type matches any JSON type
 */
function isJsonType(contentType, jsonTypes) {
  if (!contentType) return false
  const lowerContentType = contentType.toLowerCase()
  return jsonTypes.some((type) => lowerContentType.includes(type.toLowerCase()))
}

/**
 * Helper function to check if request method typically has a body
 * @param {Request} req - Request object
 * @returns {boolean} Whether the request method has a body
 */
function hasBody(req) {
  return ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())
}

/**
 * Helper function to check if content type should be parsed
 * @param {Request} req - Request object
 * @param {string} type - Expected content type
 * @returns {boolean} Whether content should be parsed
 */
function shouldParse(req, type) {
  const contentType = req.headers.get('content-type')
  return contentType && contentType.toLowerCase().includes(type.toLowerCase())
}

/**
 * Helper function to parse nested keys in URL-encoded data
 * Protected against prototype pollution attacks
 * @param {Object} obj - Target object
 * @param {string} key - Key with potential nesting
 * @param {string} value - Value to set
 * @param {number} depth - Current nesting depth to prevent excessive recursion
 */
function parseNestedKey(obj, key, value, depth = 0) {
  // Prevent excessive nesting to avoid stack overflow
  if (depth > 20) {
    throw new Error('Maximum nesting depth exceeded')
  }

  // Protect against prototype pollution
  const prototypePollutionKeys = [
    '__proto__',
    'constructor',
    'prototype',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'valueOf',
    'toString',
  ]

  if (prototypePollutionKeys.includes(key)) {
    return // Silently ignore dangerous keys
  }

  const match = key.match(/^([^[]+)\[([^\]]*)\](.*)$/)
  if (!match) {
    obj[key] = value
    return
  }

  const [, baseKey, indexKey, remaining] = match

  // Protect against prototype pollution on base key
  if (prototypePollutionKeys.includes(baseKey)) {
    return
  }

  if (!obj[baseKey]) {
    obj[baseKey] = indexKey === '' ? [] : {}
  }

  // Ensure obj[baseKey] is a safe object/array
  if (typeof obj[baseKey] !== 'object' || obj[baseKey] === null) {
    obj[baseKey] = indexKey === '' ? [] : {}
  }

  if (remaining) {
    const nextKey = indexKey + remaining
    parseNestedKey(obj[baseKey], nextKey, value, depth + 1)
  } else {
    if (indexKey === '') {
      if (Array.isArray(obj[baseKey])) {
        obj[baseKey].push(value)
      }
    } else {
      // Protect against prototype pollution on index key
      if (!prototypePollutionKeys.includes(indexKey)) {
        obj[baseKey][indexKey] = value
      }
    }
  }
}

/**
 * Creates a JSON body parser middleware
 * @param {Object} options - Body parser configuration
 * @param {number|string} options.limit - Maximum body size in bytes (default: 1MB)
 * @param {Function} options.reviver - JSON.parse reviver function
 * @param {boolean} options.strict - Only parse arrays and objects (default: true)
 * @param {string} options.type - Content-Type to parse (default: application/json)
 * @param {boolean} options.deferNext - If true, don't call next() and let caller handle it
 * @returns {Function} Middleware function
 */
function createJSONParser(options = {}) {
  const {
    limit = '1mb',
    reviver,
    strict = true,
    type = 'application/json',
    deferNext = false,
  } = options

  const parsedLimit = parseLimit(limit)

  return async function jsonParserMiddleware(req, next) {
    if (!hasBody(req) || !shouldParse(req, type)) {
      return deferNext ? null : next()
    }

    try {
      const contentLength = req.headers.get('content-length')
      if (contentLength) {
        const length = parseInt(contentLength)
        if (isNaN(length) || length < 0) {
          return new Response('Invalid content-length header', {status: 400})
        }
        if (length > parsedLimit) {
          return new Response('Request body size exceeded', {status: 413})
        }
      }

      // Check if the request has a null body (no body was provided)
      if (req.body === null) {
        Object.defineProperty(req, 'body', {
          value: undefined,
          writable: true,
          enumerable: true,
          configurable: true,
        })
        return deferNext ? null : next()
      }

      const text = await req.text()
      // Store raw body text for verification
      req._rawBodyText = text

      // Validate text length to prevent memory exhaustion
      const textLength = new TextEncoder().encode(text).length
      if (textLength > parsedLimit) {
        return new Response('Request body size exceeded', {status: 413})
      }

      // Additional protection against excessively deep nesting
      if (text.length > 0) {
        // Count nesting levels to prevent stack overflow during parsing
        let nestingLevel = 0
        let maxNesting = 0
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '{' || text[i] === '[') {
            nestingLevel++
            maxNesting = Math.max(maxNesting, nestingLevel)
          } else if (text[i] === '}' || text[i] === ']') {
            nestingLevel--
          }
        }
        if (maxNesting > 100) {
          return new Response('JSON nesting too deep', {status: 400})
        }
      }

      // Handle empty string body (becomes empty object)
      if (text === '' || text.trim() === '') {
        Object.defineProperty(req, 'body', {
          value: {},
          writable: true,
          enumerable: true,
          configurable: true,
        })
        return deferNext ? null : next()
      }

      let body
      try {
        body = JSON.parse(text, reviver)
      } catch (parseError) {
        throw new Error(`Invalid JSON: ${parseError.message}`)
      }

      if (strict && typeof body !== 'object') {
        throw new Error('JSON body must be an object or array')
      }

      Object.defineProperty(req, 'body', {
        value: body,
        writable: true,
        enumerable: true,
        configurable: true,
      })

      return deferNext ? null : next()
    } catch (error) {
      throw error
    }
  }
}

/**
 * Creates a text body parser middleware
 * @param {Object} options - Body parser configuration
 * @param {number|string} options.limit - Maximum body size in bytes
 * @param {string} options.type - Content-Type to parse (default: text/*)
 * @param {boolean} options.deferNext - If true, don't call next() and let caller handle it
 * @returns {Function} Middleware function
 */
function createTextParser(options = {}) {
  const {limit = '1mb', type = 'text/', deferNext = false} = options

  const parsedLimit = parseLimit(limit)

  return async function textParserMiddleware(req, next) {
    if (!hasBody(req) || !shouldParse(req, type)) {
      return deferNext ? null : next()
    }

    try {
      const contentLength = req.headers.get('content-length')
      if (contentLength) {
        const length = parseInt(contentLength)
        if (isNaN(length) || length < 0) {
          return new Response('Invalid content-length header', {status: 400})
        }
        if (length > parsedLimit) {
          return new Response('Request body size exceeded', {status: 413})
        }
      }

      const text = await req.text()
      // Store raw body text for verification
      req._rawBodyText = text

      const textLength = new TextEncoder().encode(text).length
      if (textLength > parsedLimit) {
        return new Response('Request body size exceeded', {status: 413})
      }

      Object.defineProperty(req, 'body', {
        value: text,
        writable: true,
        enumerable: true,
        configurable: true,
      })

      return deferNext ? null : next()
    } catch (error) {
      throw error
    }
  }
}

/**
 * Creates a URL-encoded form parser middleware
 * @param {Object} options - Body parser configuration
 * @param {number|string} options.limit - Maximum body size in bytes
 * @param {boolean} options.extended - Use extended query string parsing
 * @param {boolean} options.parseNestedObjects - Parse nested object notation
 * @param {boolean} options.deferNext - If true, don't call next() and let caller handle it
 * @returns {Function} Middleware function
 */
function createURLEncodedParser(options = {}) {
  const {
    limit = '1mb',
    extended = true,
    parseNestedObjects = true,
    deferNext = false,
  } = options

  const parsedLimit = parseLimit(limit)

  return async function urlEncodedParserMiddleware(req, next) {
    if (
      !hasBody(req) ||
      !shouldParse(req, 'application/x-www-form-urlencoded')
    ) {
      return deferNext ? null : next()
    }

    try {
      const contentLength = req.headers.get('content-length')
      if (contentLength) {
        const length = parseInt(contentLength)
        if (isNaN(length) || length < 0) {
          return new Response('Invalid content-length header', {status: 400})
        }
        if (length > parsedLimit) {
          return new Response('Request body size exceeded', {status: 413})
        }
      }

      const text = await req.text()
      // Store raw body text for verification
      req._rawBodyText = text

      const textLength = new TextEncoder().encode(text).length
      if (textLength > parsedLimit) {
        return new Response('Request body size exceeded', {status: 413})
      }

      const body = {}
      const params = new URLSearchParams(text)

      // Prevent DoS through excessive parameters
      let paramCount = 0
      const maxParams = 1000 // Reasonable limit for URL-encoded parameters

      for (const [key, value] of params.entries()) {
        paramCount++
        if (paramCount > maxParams) {
          return new Response('Too many parameters', {status: 400})
        }

        // Validate key and value lengths to prevent memory exhaustion
        if (key.length > 1000 || value.length > 10000) {
          return new Response('Parameter too long', {status: 400})
        }

        if (parseNestedObjects) {
          try {
            parseNestedKey(body, key, value)
          } catch (parseError) {
            return new Response(
              `Invalid parameter structure: ${parseError.message}`,
              {status: 400},
            )
          }
        } else {
          // Protect against prototype pollution even when parseNestedObjects is false
          const prototypePollutionKeys = [
            '__proto__',
            'constructor',
            'prototype',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'valueOf',
            'toString',
          ]

          if (!prototypePollutionKeys.includes(key)) {
            if (body[key] !== undefined) {
              if (Array.isArray(body[key])) {
                body[key].push(value)
              } else {
                body[key] = [body[key], value]
              }
            } else {
              body[key] = value
            }
          }
        }
      }

      Object.defineProperty(req, 'body', {
        value: body,
        writable: true,
        enumerable: true,
        configurable: true,
      })

      return deferNext ? null : next()
    } catch (error) {
      throw error
    }
  }
}

/**
 * Creates a multipart/form-data parser middleware
 * @param {Object} options - Body parser configuration
 * @param {number|string} options.limit - Maximum body size in bytes
 * @param {boolean} options.deferNext - If true, don't call next() and let caller handle it
 * @returns {Function} Middleware function
 */
function createMultipartParser(options = {}) {
  const {limit = '10mb', deferNext = false} = options

  const parsedLimit = parseLimit(limit)

  return async function multipartParserMiddleware(req, next) {
    const contentType = req.headers.get('content-type')
    if (!hasBody(req) || !contentType?.startsWith('multipart/form-data')) {
      return deferNext ? null : next()
    }

    try {
      const contentLength = req.headers.get('content-length')
      if (contentLength) {
        const length = parseInt(contentLength)
        if (isNaN(length) || length < 0) {
          return new Response('Invalid content-length header', {status: 400})
        }
        if (length > parsedLimit) {
          return new Response('Request body size exceeded', {status: 413})
        }
      }

      const formData = await req.formData()

      // Calculate actual size of form data and validate
      let totalSize = 0
      let fieldCount = 0
      const maxFields = 100 // Reasonable limit for form fields

      for (const [key, value] of formData.entries()) {
        fieldCount++
        if (fieldCount > maxFields) {
          return new Response('Too many form fields', {status: 400})
        }

        // Validate field name length
        if (key.length > 1000) {
          return new Response('Field name too long', {status: 400})
        }

        if (value instanceof File) {
          totalSize += value.size
          // Validate file name length for security
          if (value.name && value.name.length > 255) {
            return new Response('Filename too long', {status: 400})
          }
          // Validate file size individually
          if (value.size > parsedLimit) {
            return new Response('File too large', {status: 413})
          }
        } else {
          const valueSize = new TextEncoder().encode(value).length
          totalSize += valueSize
          // Validate field value length
          if (valueSize > 100000) {
            // 100KB per field
            return new Response('Field value too long', {status: 400})
          }
        }
        totalSize += new TextEncoder().encode(key).length

        // Check total size periodically to prevent memory exhaustion
        if (totalSize > parsedLimit) {
          return new Response('Request body size exceeded', {status: 413})
        }
      }

      const body = {}
      const files = {}

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const mimetype = value.type?.split(';')[0] || value.type
          const fileData = new Uint8Array(await value.arrayBuffer())
          files[key] = {
            filename: value.name,
            name: value.name,
            size: value.size,
            type: value.type,
            mimetype: mimetype,
            data: fileData,
          }
        } else {
          if (body[key] !== undefined) {
            if (Array.isArray(body[key])) {
              body[key].push(value)
            } else {
              body[key] = [body[key], value]
            }
          } else {
            body[key] = value
          }
        }
      }

      Object.defineProperty(req, 'body', {
        value: body,
        writable: true,
        enumerable: true,
        configurable: true,
      })

      Object.defineProperty(req, 'files', {
        value: files,
        writable: true,
        enumerable: true,
        configurable: true,
      })

      return deferNext ? null : next()
    } catch (error) {
      throw error
    }
  }
}

/**
 * Combines multiple body parsers based on content type
 * @param {Object} options - Configuration for each parser type
 * @param {Object} options.json - JSON parser options
 * @param {Object} options.text - Text parser options
 * @param {Object} options.urlencoded - URL-encoded parser options
 * @param {Object} options.multipart - Multipart parser options
 * @param {string[]} options.jsonTypes - Custom JSON content types
 * @param {Function} options.jsonParser - Custom JSON parser function
 * @param {Function} options.onError - Custom error handler
 * @param {Function} options.verify - Body verification function
 * @param {boolean} options.parseNestedObjects - Parse nested object notation (for compatibility)
 * @param {string|number} options.jsonLimit - JSON size limit (backward compatibility)
 * @param {string|number} options.textLimit - Text size limit (backward compatibility)
 * @param {string|number} options.urlencodedLimit - URL-encoded size limit (backward compatibility)
 * @param {string|number} options.multipartLimit - Multipart size limit (backward compatibility)
 * @returns {Function} Middleware function
 */
function createBodyParser(options = {}) {
  const {
    json = {},
    text = {},
    urlencoded = {},
    multipart = {},
    jsonTypes = ['application/json'],
    jsonParser,
    onError,
    verify,
    parseNestedObjects = true,
    // Backward compatibility for direct limit options
    jsonLimit,
    textLimit,
    urlencodedLimit,
    multipartLimit,
  } = options

  // Map configuration keys to actual limits for the parsers
  const jsonOptions = {
    ...json,
    limit: jsonLimit || json.jsonLimit || json.limit || '1mb',
  }
  const textOptions = {
    ...text,
    limit: textLimit || text.textLimit || text.limit || '1mb',
  }
  const urlencodedOptions = {
    ...urlencoded,
    limit:
      urlencodedLimit ||
      urlencoded.urlencodedLimit ||
      urlencoded.limit ||
      '1mb',
    parseNestedObjects:
      urlencoded.parseNestedObjects !== undefined
        ? urlencoded.parseNestedObjects
        : parseNestedObjects,
  }
  const multipartOptions = {
    ...multipart,
    limit:
      multipartLimit || multipart.multipartLimit || multipart.limit || '10mb',
  }

  // Create parsers with custom types consideration
  const jsonParserMiddleware = createJSONParser({
    ...jsonOptions,
    type: 'application/', // Broad match for JSON types
    deferNext: !!verify, // Defer next if verification is enabled
  })
  const textParserMiddleware = createTextParser({
    ...textOptions,
    deferNext: !!verify,
  })
  const urlEncodedParserMiddleware = createURLEncodedParser({
    ...urlencodedOptions,
    deferNext: !!verify,
  })
  const multipartParserMiddleware = createMultipartParser({
    ...multipartOptions,
    deferNext: !!verify,
  })

  return async function bodyParserMiddleware(req, next) {
    const contentType = req.headers.get('content-type')

    // For GET requests or requests without body, set body to undefined
    if (!hasBody(req)) {
      Object.defineProperty(req, 'body', {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true,
      })
      return next()
    }

    // If no content type, set body to undefined
    if (!contentType) {
      Object.defineProperty(req, 'body', {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true,
      })
      return next()
    }

    try {
      let result

      // Custom JSON parser handling for custom JSON types (case-insensitive)
      if (jsonParser && isJsonType(contentType, jsonTypes)) {
        const text = await req.text()
        const body = jsonParser(text)
        Object.defineProperty(req, 'body', {
          value: body,
          writable: true,
          enumerable: true,
          configurable: true,
        })

        // No result set, will be handled after verification
      } else {
        // Check if content type matches any JSON types first (including custom ones)
        if (isJsonType(contentType, jsonTypes)) {
          result = await jsonParserMiddleware(req, next)
        } else {
          // Route to appropriate parser based on content type (case-insensitive)
          const lowerContentType = contentType.toLowerCase()
          if (lowerContentType.includes('application/json')) {
            result = await jsonParserMiddleware(req, next)
          } else if (
            lowerContentType.includes('application/x-www-form-urlencoded')
          ) {
            result = await urlEncodedParserMiddleware(req, next)
          } else if (lowerContentType.includes('multipart/form-data')) {
            result = await multipartParserMiddleware(req, next)
          } else if (lowerContentType.includes('text/')) {
            result = await textParserMiddleware(req, next)
          } else {
            // For unsupported content types, set body to undefined
            Object.defineProperty(req, 'body', {
              value: undefined,
              writable: true,
              enumerable: true,
              configurable: true,
            })
            result = verify ? null : next() // Defer if verification enabled
          }
        }
      }

      // If a parser returned an error response, return it immediately
      if (result && result instanceof Response) {
        return result
      }

      // Apply verification after parsing if provided
      if (verify && req.body !== undefined) {
        try {
          // For verification, we need to pass the raw body text
          // Get the original text/data that was parsed
          let rawBody = ''
          if (req._rawBodyText) {
            rawBody = req._rawBodyText
          }
          verify(req, rawBody)
        } catch (verifyError) {
          // Sanitize error message to prevent information leakage
          const sanitizedMessage = verifyError.message
            ? verifyError.message.substring(0, 100)
            : 'Verification failed'
          return new Response(`Verification failed: ${sanitizedMessage}`, {
            status: 400,
          })
        }
      }

      // If result is null (deferred) or verification passed, call next
      return result || next()
    } catch (error) {
      if (onError) {
        return onError(error, req, next)
      }
      // Sanitize error message to prevent information leakage
      const sanitizedMessage = error.message
        ? error.message.substring(0, 100)
        : 'Body parsing failed'
      return new Response(sanitizedMessage, {status: 400})
    }
  }
}

// CommonJS exports
module.exports = {
  createBodyParser,
  createJSONParser,
  createTextParser,
  createURLEncodedParser,
  createMultipartParser,
  hasBody,
  shouldParse,
  parseLimit,
}

// Default export is the main body parser
module.exports.default = createBodyParser
