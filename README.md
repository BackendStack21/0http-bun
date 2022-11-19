# Introduction
Experimental, bun-based HTTP framework inspired by 0http!

## Usage
```js
const http = require('0http-bun')

const { router } = http({})
router.use((req, next) => {
  req.ctx = {
    engine: 'bun'
  }

  return next()
})
router.get('/:id', async (req) => {
  return Response.json(req.params)
})
router.post('/', async (req) => {
  return new Response('POST')
})
router.delete('/:id', async (req) => {
  return Response.json(req.params, {
    status: 200
  })
})

module.exports = {
  port: 3000,
  fetch: (request) => router.lookup(request)
}
```

# Support / Donate 💚
You can support the maintenance of this project: 
- PayPal: https://www.paypal.me/kyberneees
