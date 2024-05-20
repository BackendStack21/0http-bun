import { StepFunction, ZeroRequest } from "../index"
import http from '../index'

const { router } = http({})
router.use((req: ZeroRequest, next: StepFunction) => {
  req.ctx = {
    engine: 'bun'
  }

  return next()
})
router.get('/:id', async (req: ZeroRequest) => {
  return Response.json(req.params)
})
router.post('/', async (req: ZeroRequest) => {
  return new Response('POST')
})
router.delete('/:id', async (req: ZeroRequest) => {
  return Response.json(req.params, {
    status: 200
  })
})

export default router
