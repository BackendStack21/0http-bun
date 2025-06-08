/**
 * Test fixtures for routes, requests, and responses
 * Provides reusable test data for consistent testing across the suite
 */

/**
 * Common route patterns for testing
 */
export const ROUTES = {
  SIMPLE: {
    path: '/users',
    method: 'GET',
    handler: (req) => Response.json({users: []}),
  },

  WITH_PARAMS: {
    path: '/users/:id',
    method: 'GET',
    handler: (req) => Response.json({user: {id: req.params.id}}),
  },

  MULTIPLE_PARAMS: {
    path: '/users/:userId/posts/:postId',
    method: 'GET',
    handler: (req) =>
      Response.json({
        userId: req.params.userId,
        postId: req.params.postId,
      }),
  },

  WITH_QUERY: {
    path: '/search',
    method: 'GET',
    handler: (req) => Response.json({query: req.query}),
  },

  POST_WITH_BODY: {
    path: '/users',
    method: 'POST',
    handler: async (req) => {
      const body = await req.json()
      return Response.json({created: body}, {status: 201})
    },
  },

  ERROR_ROUTE: {
    path: '/error',
    method: 'GET',
    handler: () => {
      throw new Error('Test error')
    },
  },

  ASYNC_ROUTE: {
    path: '/async',
    method: 'GET',
    handler: async (req) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return Response.json({async: true})
    },
  },
}

/**
 * Common middleware functions for testing
 */
export const MIDDLEWARE = {
  LOGGER: (req, next) => {
    req.logged = true
    return next()
  },

  AUTH: (req, next) => {
    if (req.headers.get('authorization')) {
      req.authenticated = true
      return next()
    }
    return new Response('Unauthorized', {status: 401})
  },

  ERROR_THROWER: (req, next) => {
    throw new Error('Middleware error')
  },

  ASYNC_MIDDLEWARE: async (req, next) => {
    req.asyncProcessed = true
    return next()
  },

  CONDITIONAL: (req, next) => {
    if (req.url.includes('skip')) {
      return new Response('Skipped', {status: 200})
    }
    return next()
  },
}

/**
 * Test request objects
 */
export const REQUESTS = {
  SIMPLE_GET: new Request('http://localhost:3000/users', {
    method: 'GET',
  }),

  GET_WITH_PARAMS: new Request('http://localhost:3000/users/123', {
    method: 'GET',
  }),

  GET_WITH_QUERY: new Request('http://localhost:3000/search?q=test&limit=10', {
    method: 'GET',
  }),

  POST_WITH_JSON: new Request('http://localhost:3000/users', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: 'John Doe', email: 'john@example.com'}),
  }),

  PUT_REQUEST: new Request('http://localhost:3000/users/123', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: 'Jane Doe'}),
  }),

  DELETE_REQUEST: new Request('http://localhost:3000/users/123', {
    method: 'DELETE',
  }),

  WITH_HEADERS: new Request('http://localhost:3000/protected', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token123',
      'User-Agent': 'Test-Agent/1.0',
    },
  }),

  INVALID_URL: {
    url: 'not-a-valid-url',
    method: 'GET',
  },

  NO_PROTOCOL: {
    url: '/relative/path',
    method: 'GET',
  },
}

/**
 * Expected response patterns
 */
export const RESPONSES = {
  SUCCESS: {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  },

  CREATED: {
    status: 201,
    headers: {'Content-Type': 'application/json'},
  },

  NOT_FOUND: {
    status: 404,
  },

  SERVER_ERROR: {
    status: 500,
  },

  UNAUTHORIZED: {
    status: 401,
  },
}

/**
 * URL parsing test cases
 */
export const URL_PATTERNS = [
  {
    input: 'http://localhost:3000/users',
    expected: {path: '/users', query: {}},
  },
  {
    input: 'http://localhost:3000/users?page=1',
    expected: {path: '/users', query: {page: '1'}},
  },
  {
    input: 'http://localhost:3000/users/123?include=posts',
    expected: {path: '/users/123', query: {include: 'posts'}},
  },
  {
    input: 'http://localhost:3000/',
    expected: {path: '/', query: {}},
  },
  {
    input: 'http://localhost:3000',
    expected: {path: '/', query: {}},
  },
  {
    input: 'https://example.com:8080/api/v1/users?sort=name&order=asc',
    expected: {
      path: '/api/v1/users',
      query: {sort: 'name', order: 'asc'},
    },
  },
  {
    input: '/relative/path?test=value',
    expected: {path: '/relative/path', query: {test: 'value'}},
  },
]

/**
 * Performance test scenarios
 */
export const PERFORMANCE_SCENARIOS = {
  SIMPLE_ROUTE: {
    method: 'GET',
    path: '/simple',
    handler: () => new Response('OK'),
    expectedMaxLatency: 1000, // microseconds
  },

  PARAM_ROUTE: {
    method: 'GET',
    path: '/users/:id',
    handler: (req) => Response.json({id: req.params.id}),
    expectedMaxLatency: 2000, // microseconds
  },

  COMPLEX_ROUTE: {
    method: 'POST',
    path: '/users/:userId/posts/:postId/comments',
    handler: async (req) => {
      const body = await req.json()
      return Response.json({created: body})
    },
    expectedMaxLatency: 5000, // microseconds
  },
}

/**
 * Error scenarios for testing error handling
 */
export const ERROR_SCENARIOS = [
  {
    name: 'Synchronous Error',
    handler: () => {
      throw new Error('Sync error')
    },
    expectedStatus: 500,
  },
  {
    name: 'Async Error',
    handler: async () => {
      throw new Error('Async error')
    },
    expectedStatus: 500,
  },
  {
    name: 'Middleware Error',
    middleware: () => {
      throw new Error('Middleware error')
    },
    expectedStatus: 500,
  },
  {
    name: 'Next Error',
    middleware: (req, next) => {
      return next(new Error('Next error'))
    },
    expectedStatus: 500,
  },
]
