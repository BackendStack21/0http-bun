/* global Response */
const http = require('../index')

const { router } = http({})

router.get('/hi', async (req) => {
  return new Response('Hello World!')
})

module.exports = router
