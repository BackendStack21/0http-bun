/* global describe, it, expect, beforeAll */

const http = require('../index')
const { router } = http({ port: 3000 })

describe('Router', () => {
  beforeAll(async () => {
    router.use((req, next) => {
      req.ctx = {
        engine: 'bun'
      }

      return next()
    })

    router.get('/get-params/:id', (req) => {
      return Response.json(req.params)
    })

    router.get('/qs', (req) => {
      return Response.json(req.query)
    })

    router.delete('/get-params/:id', () => {
      return Response.json('OK')
    })

    router.get('/error', () => {
      throw new Error('Unexpected error')
    })

    router.post('/create', async (req) => {
      const body = await req.text()

      return Response.json(JSON.parse(body))
    })

    router.get('/', (req) => {
      return Response.json(req.ctx)
    })
  })

  it('should return a JSON response with the request parameters for GET requests', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/get-params/123', {
      method: 'GET'
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: '123' })
  })

  it('should return a JSON response with the request parameters for DELETE requests', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/get-params/123', {
      method: 'DELETE'
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual('OK')
  })

  it('should return a JSON response with the request body for POST requests', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/create', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' })
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ foo: 'bar' })
  })

  it('should return a 404 response for a non-existent route', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/non-existent', {
      method: 'GET'
    }))
    expect(response.status).toBe(404)
  })

  it('should return a 500 response for a route that throws an error', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/error', {
      method: 'GET'
    }))
    expect(response.status).toBe(500)
    expect(await response.text()).toEqual('Unexpected error')
  })

  it('should return a 200 response for a route that returns a Response object', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/', {
      method: 'GET'
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ engine: 'bun' })
  })

  it('should return a JSON response with the query string parameters', async () => {
    const response = await router.fetch(new Request('http://localhost:3000/qs?foo=bar', {
      method: 'GET'
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ foo: 'bar' })
  })
})
