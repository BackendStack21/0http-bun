/* global Response */
const http = require('../index')

const { router } = http({})

router.get('/hi', async (req) => {
  return new Response('Hello World!')
})

module.exports = {
  port: 3000,
  fetch: (request) => router.lookup(request)
}
