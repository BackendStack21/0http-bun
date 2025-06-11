/**
 * Test helper utilities for creating and managing test instances
 */

/**
 * Creates a simple test request for unit testing
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {Object} options - Additional request options
 * @returns {Request} - Test request object
 */
function createTestRequest(method = 'GET', path = '/', options = {}) {
  const url = `http://localhost:3000${path}`
  const requestInit = {
    method,
    ...options,
  }

  // Add content-type for POST/PUT requests with body
  if (
    options.body &&
    !requestInit.headers?.['content-type'] &&
    !requestInit.headers?.['Content-Type']
  ) {
    requestInit.headers = requestInit.headers || {}
    requestInit.headers['Content-Type'] = 'application/json'
  }

  // Create a real Request object first
  const request = new Request(url, requestInit)

  // Create a mutable proxy that allows header mutation for testing
  const mutableRequest = {
    method: request.method,
    url: request.url,
    headers: new Headers(requestInit.headers || {}),
    body: request.body,
    json: request.json.bind(request),
    text: request.text.bind(request),
    arrayBuffer: request.arrayBuffer.bind(request),
    formData: request.formData.bind(request),
    blob: request.blob.bind(request),
    clone: request.clone.bind(request),
    bodyUsed: request.bodyUsed,
    cache: request.cache,
    credentials: request.credentials,
    destination: request.destination,
    integrity: request.integrity,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
    ctx: {},
  }

  return mutableRequest
}

/**
 * Measures execution time of an async function
 * @param {Function} fn - Function to measure
 * @returns {Object} - Object with time property in milliseconds
 */
async function measureTime(fn) {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()

  return {
    time: end - start,
    result,
  }
}

// CommonJS exports
module.exports = {
  createTestRequest,
  measureTime,
}
