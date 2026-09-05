/* global describe, it, expect */

const routerFactory = require('../../lib/router/sequential')
const {createJWTAuth} = require('../../lib/middleware/jwt-auth')
const {createRateLimit} = require('../../lib/middleware/rate-limit')
const {createLogger} = require('../../lib/middleware/logger')
const {createTestRequest} = require('../helpers')

describe('Path canonicalization security', () => {
  describe('Router', () => {
    it('routes /admin/../health to the /health handler', async () => {
      const router = routerFactory()
      router.get('/health', () => new Response('ok'))
      router.get('/admin', () => new Response('admin'))

      const response = await router.fetch(
        createTestRequest('GET', '/admin/../health'),
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    })

    it('does not treat %2e%2e as a leftover traversal segment', async () => {
      const router = routerFactory()
      router.get('/health', () => new Response('ok'))

      const response = await router.fetch(
        createTestRequest('GET', '/admin/%2e%2e/health'),
      )
      expect(await response.text()).toBe('ok')
      expect(response.status).toBe(200)
    })

    it('sets req.path to the canonical pathname', async () => {
      const router = routerFactory()
      let seen
      router.get('/users', (req) => {
        seen = req.path
        return new Response('ok')
      })

      await router.fetch(createTestRequest('GET', '/api/../users'))
      expect(seen).toBe('/users')
    })

    it('preserves encoded slashes in params', async () => {
      const router = routerFactory()
      router.get('/search/:term', (req) =>
        Response.json({term: req.params.term, path: req.path}),
      )

      const response = await router.fetch(
        createTestRequest('GET', '/search/path%2Fwith%2Fslashes'),
      )
      const data = await response.json()
      expect(data.term).toBe('path%2Fwith%2Fslashes')
    })
  })

  describe('JWT excludePaths vs routing', () => {
    it('does not skip auth for /healthcheck when /health is excluded', async () => {
      const middleware = createJWTAuth({
        secret: 'test-secret-key-that-is-long-enough',
        excludePaths: ['/health'],
      })
      const next = () => new Response('ok')

      const skipped = await middleware(
        createTestRequest('GET', '/health'),
        next,
      )
      expect(skipped.status).toBe(200)

      const protectedReq = createTestRequest('GET', '/healthcheck')
      const blocked = await middleware(protectedReq, next)
      expect(blocked.status).toBe(401)
    })

    it('uses the same canonical path as the router for excludePaths', async () => {
      const middleware = createJWTAuth({
        secret: 'test-secret-key-that-is-long-enough',
        excludePaths: ['/health'],
      })
      const next = () => new Response('ok')

      // Traversal that canonicalizes to /health must skip auth
      const traversal = createTestRequest('GET', '/admin/../health')
      const skipped = await middleware(traversal, next)
      expect(skipped.status).toBe(200)

      // Traversal that canonicalizes to /admin must require auth
      const toAdmin = createTestRequest('GET', '/health/../admin')
      const blocked = await middleware(toAdmin, next)
      expect(blocked.status).toBe(401)
    })
  })

  describe('Rate limit excludePaths', () => {
    it('does not exclude prefix collisions like /healthcheck', async () => {
      const middleware = createRateLimit({
        windowMs: 60_000,
        max: 1,
        excludePaths: ['/health'],
        keyGenerator: () => 'same-client',
      })
      const next = () => new Response('ok')

      const health1 = await middleware(createTestRequest('GET', '/health'), next)
      const health2 = await middleware(createTestRequest('GET', '/health'), next)
      expect(health1.status).toBe(200)
      expect(health2.status).toBe(200)

      const first = await middleware(
        createTestRequest('GET', '/healthcheck'),
        next,
      )
      const second = await middleware(
        createTestRequest('GET', '/healthcheck'),
        next,
      )
      expect(first.status).toBe(200)
      expect(second.status).toBe(429)
    })
  })

  describe('Logger excludePaths', () => {
    it('does not skip logging for /healthcheck when /health is excluded', async () => {
      const mockLog = {
        child: () => mockLog,
        info: () => {},
        error: () => {},
      }
      let infoCalls = 0
      mockLog.info = () => {
        infoCalls++
      }

      const middleware = createLogger({
        logger: mockLog,
        excludePaths: ['/health'],
      })
      const next = () => new Response('ok')

      await middleware(createTestRequest('GET', '/health'), next)
      expect(infoCalls).toBe(0)

      await middleware(createTestRequest('GET', '/healthcheck'), next)
      expect(infoCalls).toBeGreaterThan(0)
    })
  })
})
