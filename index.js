module.exports = (config = {}) => {
  // Sequential is default and only router implementation for now
  const router = require('./lib/router/sequential')(config)

  return {
    router
  }
}
