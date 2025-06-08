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

  return new Request(url, requestInit)
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
