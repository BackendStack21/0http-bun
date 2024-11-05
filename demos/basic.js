/* global Response */
const http = require('../index');

const { router } = http({});
router.use((req, next) => {
  req.ctx = {
    engine: 'bun',
  };

  return next();
});
router.get('/:id', async (req) => {
  return Response.json(req.params);
});
router.post('/', async (req) => {
  return new Response('POST');
});
router.delete('/:id', async (req) => {
  return Response.json(req.params, {
    status: 200,
  });
});

export default router;
