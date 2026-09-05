/* global describe, it, expect */

const {
  splitUrl,
  resolveDotSegments,
  normalizePathname,
  parseRequestUrl,
  getRequestPath,
  isExcludedPath,
  sanitizeQuery,
} = require('../../lib/path')

describe('Path helpers', () => {
  describe('splitUrl', () => {
    it('extracts path and query from an absolute URL', () => {
      expect(splitUrl('http://localhost:3000/api/users?q=1')).toEqual({
        rawPath: '/api/users',
        queryString: 'q=1',
      })
    })

    it('handles missing path after host', () => {
      expect(splitUrl('http://localhost')).toEqual({
        rawPath: '/',
        queryString: null,
      })
    })

    it('handles empty or invalid input', () => {
      expect(splitUrl('')).toEqual({rawPath: '/', queryString: null})
      expect(splitUrl(null)).toEqual({rawPath: '/', queryString: null})
    })
  })

  describe('resolveDotSegments', () => {
    it('resolves . and .. without escaping the root', () => {
      expect(resolveDotSegments('/api/../admin')).toBe('/admin')
      expect(resolveDotSegments('/foo/./bar')).toBe('/foo/bar')
      expect(resolveDotSegments('/../secret')).toBe('/secret')
      expect(resolveDotSegments('/foo/bar/..')).toBe('/foo')
    })
  })

  describe('normalizePathname', () => {
    it('collapses duplicate slashes', () => {
      expect(normalizePathname('/api//users')).toBe('/api/users')
    })

    it('decodes URI components but preserves encoded slashes', () => {
      expect(normalizePathname('/search/hello%20world')).toBe(
        '/search/hello world',
      )
      expect(normalizePathname('/search/path%2Fwith%2Fslashes')).toBe(
        '/search/path%2Fwith%2Fslashes',
      )
    })

    it('resolves encoded dot segments after decoding', () => {
      expect(normalizePathname('/admin/%2e%2e/health')).toBe('/health')
      expect(normalizePathname('/health/%2e%2e/admin')).toBe('/admin')
    })

    it('returns / for empty input', () => {
      expect(normalizePathname('')).toBe('/')
      expect(normalizePathname('/')).toBe('/')
    })
  })

  describe('parseRequestUrl / getRequestPath', () => {
    it('parses a full request URL into a canonical path', () => {
      expect(parseRequestUrl('https://example.com/a/../b?x=1')).toEqual({
        path: '/b',
        queryString: 'x=1',
      })
    })

    it('prefers req.path when already set by the router', () => {
      expect(getRequestPath({path: '/canonical', url: 'http://x/other'})).toBe(
        '/canonical',
      )
    })

    it('falls back to parsing req.url', () => {
      expect(getRequestPath({url: 'http://localhost/api/../users'})).toBe(
        '/users',
      )
    })
  })

  describe('isExcludedPath', () => {
    it('matches exact paths and descendants, not prefixes', () => {
      expect(isExcludedPath('/health', ['/health'])).toBe(true)
      expect(isExcludedPath('/health/live', ['/health'])).toBe(true)
      expect(isExcludedPath('/healthcheck', ['/health'])).toBe(false)
      expect(isExcludedPath('/api/users', ['/health'])).toBe(false)
    })

    it('returns false for empty exclude lists', () => {
      expect(isExcludedPath('/health', [])).toBe(false)
      expect(isExcludedPath('/health', null)).toBe(false)
    })
  })

  describe('sanitizeQuery', () => {
    it('strips prototype pollution keys', () => {
      const query = {safe: '1', __proto__: 'x', constructor: 'y', prototype: 'z'}
      sanitizeQuery(query)
      expect(query.safe).toBe('1')
      expect(Object.hasOwn(query, '__proto__')).toBe(false)
      expect(Object.hasOwn(query, 'constructor')).toBe(false)
      expect(Object.hasOwn(query, 'prototype')).toBe(false)
    })
  })
})
