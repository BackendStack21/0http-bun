const crypto = require('crypto')

// Lazy load pino to improve startup performance
let pino = null
function loadPino() {
  if (!pino) {
    try {
      pino = require('pino')
    } catch (error) {
      throw new Error(
        'pino is required for logger middleware. Install it with: bun install pino',
      )
    }
  }
  return pino
}

/**
 * Creates a logging middleware using Pino logger
 * @param {Object} options - Logger configuration options
 * @param {Object} options.pinoOptions - Pino logger options
 * @param {Function} options.serializers - Custom serializers for request/response
 * @param {boolean} options.logBody - Whether to log request/response bodies
 * @param {Array<string>} options.excludePaths - Paths to exclude from logging
 * @param {Object} options.logger - Injected logger instance
 * @param {string} options.level - Log level (alternative to pinoOptions.level)
 * @param {string} options.requestIdHeader - Header name to read request ID from
 * @param {Function} options.generateRequestId - Custom request ID generator function
 * @returns {Function} Middleware function
 */
function createLogger(options = {}) {
  const {
    pinoOptions = {},
    logBody = false,
    excludePaths = ['/health', '/ping', '/favicon.ico'],
    logger: injectedLogger,
    level,
    serializers,
    requestIdHeader,
    generateRequestId,
  } = options

  // Build final pino options with proper precedence
  const pinoLib = loadPino()
  const finalPinoOptions = {
    level: level || pinoOptions.level || process.env.LOG_LEVEL || 'info',
    timestamp: pinoLib.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({level: label.toUpperCase()}),
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
        ...(logBody && req.body ? {body: req.body} : {}),
      }),
      // Default res serializer removed to allow logResponse to handle it fully
      err: pinoLib.stdSerializers.err,
      // Merge in custom serializers if provided
      ...(serializers || {}),
    },
    ...pinoOptions,
  }

  // Use injected logger if provided (for tests), otherwise create a new one
  const logger = injectedLogger || pinoLib(finalPinoOptions)

  return function loggerMiddleware(req, next) {
    const startTime = process.hrtime.bigint()
    const url = new URL(req.url)

    if (excludePaths.some((path) => url.pathname.startsWith(path))) {
      return next()
    }

    // Generate or extract request ID
    let requestId
    if (requestIdHeader && req.headers.get(requestIdHeader)) {
      requestId = req.headers.get(requestIdHeader)
    } else if (generateRequestId) {
      requestId = generateRequestId()
    } else {
      requestId = crypto.randomUUID()
    }

    // Add logger and requestId to context and root
    req.ctx = req.ctx || {}
    req.ctx.requestId = requestId
    req.requestId = requestId

    // Create child logger with request context
    const childLogger = logger.child({
      requestId: requestId,
      method: req.method,
      path: url.pathname,
    })
    req.ctx.log = childLogger
    req.log = childLogger

    // Check if we should log based on level
    const effectiveLevel =
      level || pinoOptions.level || process.env.LOG_LEVEL || 'info'
    const shouldLogInfo = shouldLog('info', effectiveLevel)

    // Log request started
    if (shouldLogInfo) {
      const logObj = {
        msg: 'Request started',
        method: req.method,
        url: url.pathname,
      }

      // Apply custom serializers if provided
      if (serializers && serializers.req) {
        Object.assign(logObj, serializers.req(req))
      } else if (logBody && req.body) {
        // Add body to log if logBody is enabled and no custom serializer
        logObj.body = req.body
      }

      childLogger.info(logObj)
    }

    try {
      const result = next()
      if (result instanceof Promise) {
        return result
          .then((response) => {
            logResponse(
              childLogger,
              response,
              startTime,
              req,
              url,
              shouldLogInfo,
              serializers,
              logBody,
            )
            return response
          })
          .catch((error) => {
            logError(childLogger, error, startTime)
            throw error
          })
      } else {
        logResponse(
          childLogger,
          result,
          startTime,
          req,
          url,
          shouldLogInfo,
          serializers,
          logBody,
        )
        return result
      }
    } catch (error) {
      logError(childLogger, error, startTime)
      throw error
    }
  }
}

// Helper function to determine if we should log at a given level
function shouldLog(logLevel, configuredLevel) {
  const levels = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  }

  const logLevelNum = levels[logLevel] || 30
  const configuredLevelNum = levels[configuredLevel] || 30

  return logLevelNum >= configuredLevelNum
}

function logResponse(
  logger,
  response,
  startTime,
  req,
  url,
  shouldLogInfo,
  customSerializers, // serializers from createLogger options
  logBodyOpt, // logBody from createLogger options
) {
  if (!shouldLogInfo) return

  const duration = Number(process.hrtime.bigint() - startTime) / 1000000

  let responseSize
  if (response) {
    if (response.headers && response.headers.get) {
      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        responseSize = parseInt(contentLength, 10)
      }
    }

    if (responseSize === undefined) {
      const bodyToMeasure = response.hasOwnProperty('_bodyForLogger')
        ? response._bodyForLogger
        : response.body
      if (bodyToMeasure instanceof ReadableStream) {
        responseSize = undefined
      } else if (typeof bodyToMeasure === 'string') {
        responseSize = Buffer.byteLength(bodyToMeasure, 'utf8')
      } else if (bodyToMeasure instanceof ArrayBuffer) {
        responseSize = bodyToMeasure.byteLength
      } else if (bodyToMeasure instanceof Uint8Array) {
        responseSize = bodyToMeasure.length
      } else if (bodyToMeasure === null || bodyToMeasure === undefined) {
        responseSize = 0
      }
    }
  }

  const logEntry = {
    msg: 'Request completed',
    method: req.method,
    url: url.pathname,
    status: response && response.status,
    duration: duration,
  }

  if (responseSize !== undefined) {
    logEntry.responseSize = responseSize
  }

  // Handle response serialization
  if (customSerializers && customSerializers.res) {
    // Custom serializer is responsible for all response fields it wants to log
    const serializedRes = customSerializers.res(response)
    Object.assign(logEntry, serializedRes)
  } else {
    // No custom res serializer: default handling for headers
    if (
      response &&
      response.headers &&
      typeof response.headers.entries === 'function'
    ) {
      logEntry.headers = Object.fromEntries(response.headers.entries())
    } else if (response && response.headers) {
      logEntry.headers = response.headers
    } else {
      logEntry.headers = {}
    }
  }

  // If logBodyOpt is true and body wasn't added by a custom serializer (or no custom serializer)
  if (logBodyOpt && response && !logEntry.hasOwnProperty('body')) {
    logEntry.body = response.hasOwnProperty('_bodyForLogger')
      ? response._bodyForLogger
      : response.body
  }

  logger.info(logEntry)
}

function logError(logger, error, startTime) {
  const duration = Number(process.hrtime.bigint() - startTime) / 1000000
  logger.error({
    msg: 'Request failed',
    error: error && error.message,
    duration: duration,
  })
}

/**
 * Simple request logger for development
 * @returns {Function} Middleware function
 */
function simpleLogger() {
  return function simpleLoggerMiddleware(req, next) {
    const startTime = Date.now()
    const method = req.method
    const url = new URL(req.url)
    const pathname = url.pathname

    console.log(`→ ${method} ${pathname}`)

    try {
      const result = next()

      if (result instanceof Promise) {
        return result
          .then((response) => {
            const duration = Date.now() - startTime
            console.log(
              `← ${method} ${pathname} ${response.status} (${duration}ms)`,
            )
            return response
          })
          .catch((error) => {
            const duration = Date.now() - startTime
            console.log(
              `✗ ${method} ${pathname} ERROR (${duration}ms): ${error.message}`,
            )
            throw error
          })
      } else {
        const duration = Date.now() - startTime
        console.log(`← ${method} ${pathname} ${result.status} (${duration}ms)`)
        return result
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.log(
        `✗ ${method} ${pathname} ERROR (${duration}ms): ${error.message}`,
      )
      throw error
    }
  }
}

module.exports = {
  createLogger,
  simpleLogger,
}
