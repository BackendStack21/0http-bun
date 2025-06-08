import {run, bench, group} from 'mitata'
import httpNext from './index'
import httpPrevious from '0http-bun'

function setupRouter(router) {
  router.use((req, next) => {
    return next()
  })

  router.get('/', () => {
    return new Response()
  })
  router.get('/:id', async (req) => {
    return new Response(req.params.id)
  })
  router.get('/:id/error', () => {
    throw new Error('Error')
  })
}

const {router} = httpNext()
setupRouter(router)

const {router: routerPrevious} = httpPrevious()
setupRouter(routerPrevious)

group('Next Router', () => {
  bench('Parameter URL', () => {
    router.fetch(new Request(new URL('http://localhost/0')))
  }).gc('inner')
  bench('Not Found URL', () => {
    router.fetch(new Request(new URL('http://localhost/0/404')))
  }).gc('inner')
  bench('Error URL', () => {
    router.fetch(new Request(new URL('http://localhost/0/error')))
  }).gc('inner')
})

group('Previous Router', () => {
  bench('Parameter URL', () => {
    routerPrevious.fetch(new Request(new URL('http://localhost/0')))
  }).gc('inner')
  bench('Not Found URL', () => {
    routerPrevious.fetch(new Request(new URL('http://localhost/0/404')))
  }).gc('inner')
  bench('Error URL', () => {
    routerPrevious.fetch(new Request(new URL('http://localhost/0/error')))
  }).gc('inner')
})

run({
  colors: true,
})
