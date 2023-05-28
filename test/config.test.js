/* global describe, it, expect, beforeAll */

const http = require('../index')
const { router } = http({
  port: 3000,
  defaultRoute: (req) => {
    const res = new Response('Not Found!', {
      status: 404
    })

    return res
  },
  errorHandler: (err) => {
    const res = new Response('Error: ' + err.message, {
      status: 500
    })

    return res
  }
})

describe('Router Configuration', () => {
  beforeAll(async () => {
    router.get('/error', () => {
      throw new Error('Unexpected error')
    })
  })

  it('should return a 500 response for a route that throws an error', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/error', {
      method: 'GET'
    }))
    expect(response.status).toBe(500)
    expect(await response.text()).toEqual('Error: Unexpected error')
  })

  it('should return a 404 response for a route that does not exist', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/does-not-exist', {
      method: 'GET'
    }))
    expect(response.status).toBe(404)
    expect(await response.text()).toEqual('Not Found!')
  })
})
