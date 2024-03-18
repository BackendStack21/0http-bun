import http from '../index'

const { router } = http()

router.get('/', (req, res) => {
  return new Response()
})
router.get('/:id', async (req) => {
  return new Response(req.params.id)
})
router.post('/', async (req) => {
  return new Response()
})

Bun.serve({
  port: 3000,
  reusePort: true,
  fetch: router.fetch
})
