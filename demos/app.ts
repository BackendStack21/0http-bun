import http from '../index'

const { router } = http()

router.get('/', () => {
  return new Response()
})
router.get('/:id', (req) => {
  return new Response(req.params.id)
})
router.post('/', () => {
  return new Response()
})

Bun.serve({
  port: 3000,
  reusePort: true,
  fetch: router.fetch
})
