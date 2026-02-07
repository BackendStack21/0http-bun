import {run, bench, group} from 'mitata'
import httpNext, {IRouter} from './index'
import httpPrevious from '0http-bun'

const silentErrorHandler = () =>
  new Response('Internal Server Error', {status: 500})

function setupRouter(router: any) {
  router.use((req: any, next: () => any) => {
    return next()
  })

  router.get('/', () => {
    return new Response()
  })
  router.get('/:id', async (req: {params: Record<string, string>}) => {
    return new Response(req.params.id)
  })
  router.get('/:id/error', () => {
    throw new Error('Error')
  })
}

function benchRouter(name: string, router: any) {
  group(name, () => {
    bench('Parameter URL', async () => {
      await router.fetch(new Request(new URL('http://localhost/0')))
    }).gc('inner')
    bench('Not Found URL', async () => {
      await router.fetch(new Request(new URL('http://localhost/0/404')))
    }).gc('inner')
    bench('Error URL', async () => {
      await router.fetch(new Request(new URL('http://localhost/0/error')))
    }).gc('inner')
  })
}

const {router} = httpNext({errorHandler: silentErrorHandler})
setupRouter(router)

const {router: routerPrevious} = httpPrevious({
  errorHandler: silentErrorHandler,
})
setupRouter(routerPrevious)

benchRouter('Next Router', router)
benchRouter('Previous Router', routerPrevious)

run({
  colors: true,
})
