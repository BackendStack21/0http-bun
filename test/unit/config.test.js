/* global describe, it, expect, beforeAll */

const http = require('../../index')

describe('Router Configuration', () => {
  describe('Custom Error Handler', () => {
    let router

    beforeAll(async () => {
      const {router: testRouter} = http({
        port: 3000,
        defaultRoute: (req) => {
          const res = new Response('Not Found!', {
            status: 404,
          })
          return res
        },
        errorHandler: (err) => {
          const res = new Response('Error: ' + err.message, {
            status: 500,
          })
          return res
        },
      })

      router = testRouter
      router.get('/error', () => {
        throw new Error('Unexpected error')
      })
    })

    it('should return a 500 response for a route that throws an error', async () => {
      const response = await router.fetch(
        new Request('http://localhost:3000/error', {
          method: 'GET',
        }),
      )
      expect(response.status).toBe(500)
      expect(await response.text()).toEqual('Error: Unexpected error')
    })
  })

  describe('Custom Default Route', () => {
    let router

    beforeAll(async () => {
      const {router: testRouter} = http({
        port: 3000,
        defaultRoute: (req) => {
          const res = new Response('Not Found!', {
            status: 404,
          })
          return res
        },
        errorHandler: (err) => {
          const res = new Response('Error: ' + err.message, {
            status: 500,
          })
          return res
        },
      })

      router = testRouter
    })

    it('should return a 404 response for a route that does not exist', async () => {
      const response = await router.fetch(
        new Request('http://localhost:3000/does-not-exist', {
          method: 'GET',
        }),
      )
      expect(response.status).toBe(404)
      expect(await response.text()).toEqual('Not Found!')
    })
  })

  describe('Default Configuration', () => {
    let router

    beforeAll(async () => {
      const {router: testRouter} = http({port: 3000})
      router = testRouter
    })

    it('should use default 404 handler when no custom defaultRoute is provided', async () => {
      const response = await router.fetch(
        new Request('http://localhost:3000/nonexistent', {
          method: 'GET',
        }),
      )
      expect(response.status).toBe(404)
    })

    it('should use default error handler when no custom errorHandler is provided', async () => {
      router.get('/test-error', () => {
        throw new Error('Test error')
      })

      const response = await router.fetch(
        new Request('http://localhost:3000/test-error', {
          method: 'GET',
        }),
      )
      expect(response.status).toBe(500)
    })
  })
})
