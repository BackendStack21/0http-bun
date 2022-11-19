# Introduction
Experimental, bun-based HTTP framework inspired by [0http](https://0http.21no.de/#/)

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
# Benchmarks
## 0http-bun (bun v0.2.2)
```
% wrk -t4 -c50 -d10s --latency http://127.0.0.1:3000/hi
Running 10s test @ http://127.0.0.1:3000/hi
  4 threads and 50 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   463.26us   99.23us   4.28ms   96.62%
    Req/Sec    25.98k     1.10k   27.48k    76.73%
  Latency Distribution
     50%  442.00us
     75%  466.00us
     90%  485.00us
     99%    0.91ms
  1044377 requests in 10.10s, 127.49MB read
Requests/sec: 103397.66
Transfer/sec:     12.62MB
```
## 0http (node v18.2.0)
```
% wrk -t4 -c50 -d10s --latency http://127.0.0.1:3000/hi
Running 10s test @ http://127.0.0.1:3000/hi
  4 threads and 50 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     0.98ms  251.77us  13.04ms   95.09%
    Req/Sec    12.31k   771.37    16.96k    95.29%
  Latency Distribution
     50%    0.95ms
     75%    0.96ms
     90%    0.98ms
     99%    1.88ms
  493899 requests in 10.10s, 63.59MB read
Requests/sec:  48893.32
Transfer/sec:      6.29MB
```
## express (node v18.2.0)
```
% wrk -t4 -c50 -d10s --latency http://127.0.0.1:3000/hi
Running 10s test @ http://127.0.0.1:3000/hi
  4 threads and 50 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     4.99ms    0.90ms  20.31ms   89.52%
    Req/Sec     2.42k   154.52     2.66k    82.25%
  Latency Distribution
     50%    4.67ms
     75%    4.83ms
     90%    6.03ms
     99%    8.43ms
  96296 requests in 10.01s, 21.95MB read
Requests/sec:   9622.74
Transfer/sec:      2.19MB
```
# Support / Donate 💚
You can support the maintenance of this project: 
- PayPal: https://www.paypal.me/kyberneees
