module.exports = (config = {}) => {
  const router = config.router || require('./lib/router/sequential')(config)

  return {
    router
  }
}
