# Security Remediation TODO

> Penetration test conducted on 2025-02-07 against `0http-bun@1.2.2`.
> **43 vulnerabilities found** — 6 Critical, 13 High, 13 Medium, 7 Low, 4 Info.
> **Overall Security Grade: D → B+ — All identified vulnerabilities resolved.**

## Remediation Progress

> **Fixed:** 6/6 Critical, 13/13 High, 13/13 Medium, 7/7 Low, 4/4 Info = **43/43 vulnerabilities resolved** ✅

---

## CRITICAL (Must fix immediately)

### ✅ CRIT-1: Unbounded Route Cache — Memory Exhaustion DoS

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** Added LRU-style cache eviction with configurable `config.cacheSize` (default 1000). When cache exceeds max size, oldest entries are evicted.

---

### ✅ CRIT-2: JSON Nesting Depth Check Bypass via String Content

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Nesting depth scanner now tracks `inString`/`escape` state to correctly ignore braces inside JSON string literals.

---

### ✅ CRIT-3: Rate Limit Bypass via Spoofable IP Headers

- **Status:** FIXED — ⚠️ BREAKING CHANGE
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** `defaultKeyGenerator` now uses `req.ip || req.remoteAddress || 'unknown'` — no proxy headers trusted by default. Users behind reverse proxies must supply a custom `keyGenerator`.

---

### ✅ CRIT-4: Rate Limit Store Injection via `req.rateLimitStore`

- **Status:** FIXED
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** Removed `req.rateLimitStore` backdoor. Always uses constructor-configured store.

---

### ✅ CRIT-5: API Key Timing Side-Channel Attack

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Added `crypto.timingSafeEqual()` for all API key comparisons with constant-time length mismatch handling.

---

### ✅ CRIT-6: JWT Default Algorithms Enable Algorithm Confusion

- **Status:** FIXED — ⚠️ BREAKING CHANGE
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Default algorithms changed from `['HS256', 'RS256']` to `['HS256']`. Throws error if mixed symmetric+asymmetric algorithms are configured.

---

## HIGH (Must fix before next release)

### ✅ H-1: Default Error Handler Leaks `err.message` to Clients

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** Default error handler now returns generic `"Internal Server Error"` and logs full error via `console.error`.

---

### ✅ H-2: `this` Binding Bug in `router.use()` Breaks Middleware Chaining

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** Changed `return this` → `return router` in arrow function `router.use()`.

---

### ✅ H-3: Content-Length Bypass — Full Body Read Before Size Enforcement

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Added `readBodyWithLimit()` streaming helper that reads body chunks incrementally and aborts immediately when cumulative size exceeds the limit. Replaces `await req.text()` + post-hoc size check in JSON, text, URL-encoded, and custom JSON parser paths.

---

### ✅ H-4: Custom `jsonParser` Bypasses All Security Controls

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Custom `jsonParser` now enforces size limits before calling the custom parser function.

---

### ✅ H-5: Multipart Parser Reads Entire Body Before Validation + Double Memory

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Merged the validation and extraction loops into a single pass. Field count, size limits, filename sanitization, and prototype pollution checks all run in one iteration of `formData.entries()` instead of two.

---

### ✅ H-6: Multipart Parser Has No Prototype Pollution Protection

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Uses `Object.create(null)` for body/files objects and added prototype pollution blocklist for field names.

---

### ✅ H-7: JWT Path Exclusion Bypass via Prefix Collision

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Path exclusion now uses exact match or `path + '/'` boundary checking.

---

### ✅ H-8: JWT Token in Query Parameters Leaks via Logs/Referrer

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Emits a `console.warn` deprecation warning at middleware construction time when `tokenQuery` is configured, advising migration to Authorization header or custom `getToken`.

---

### ✅ H-9: Optional JWT Mode Silently Swallows Invalid/Forged Tokens

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Now sets `req.ctx.authError` and `req.ctx.authAttempted = true` on invalid tokens in optional mode.

---

### ✅ H-10: Sliding Window Rate Limiter — Unbounded Map Growth

- **Status:** FIXED
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** Added `maxKeys` (default 10000), periodic cleanup with `setInterval` + `unref()`, and eviction of stale entries.

---

### ✅ H-11: CORS `null` Origin Bypass via Sandboxed Iframe

- **Status:** FIXED
- **File:** `lib/middleware/cors.js`
- **Fix applied:** `null`/missing origins are now rejected before calling validator function or checking array.

---

### ✅ H-12: Rate Limiter TOCTOU Race Condition

- **Status:** FIXED
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** `MemoryStore.increment` changed from `async` to synchronous.

---

### ✅ H-13: Async Errors Bypass Custom Error Handler

- **Status:** FIXED
- **File:** `lib/next.js`
- **Fix applied:** Async middleware errors now caught via `.catch()` on returned promises and forwarded to `errorHandler`.

---

## MEDIUM (Should fix soon)

### ✅ M-1: Shared Mutable `emptyParams` — Cross-Request Data Leakage

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** `emptyParams` now uses `Object.freeze({})`.

---

### ✅ M-2: No URL Path Normalization — Route Filter Bypass

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** Added URL path normalization (double-slash collapse, `decodeURIComponent`, preserves `%2F`).

---

### ✅ M-3: Multipart Filename Not Sanitized for Path Traversal

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Filenames sanitized (strips `..`, path separators, null bytes; preserves `originalName`).

---

### ✅ M-4: Content-Type Broad Matching Routes Non-JSON to JSON Parser

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Internal JSON parser type changed from `'application/'` to `'application/json'`.

---

### ✅ M-5: `parseLimit` Silently Defaults for Unexpected Types

- **Status:** FIXED — ⚠️ BREAKING CHANGE
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Now throws `TypeError` on unexpected types instead of silently defaulting.

---

### ✅ M-6: Raw JWT Token Stored on Request Context

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Raw JWT token removed from `req.ctx.jwt` and `req.jwt`.

---

### ✅ M-7: API Key Stored in Plain Text on Request Context

- **Status:** FIXED — ⚠️ BREAKING CHANGE
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** `req.ctx.apiKey` and `req.apiKey` now store a masked version (`xxxx****xxxx`). Raw key is available only via `req[API_KEY_SYMBOL]` (exported `Symbol.for('0http.apiKey')`) to prevent accidental serialization/logging.

---

### ✅ M-8: JWKS URI Not Validated (Allows HTTP)

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** JWKS URI is validated at construction time. Throws an error if non-HTTPS URI is used when `NODE_ENV=production`. Emits a `console.warn` in non-production environments.

---

### ✅ M-9: JWT Error Messages Reveal Validation Oracle

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Unified JWT error messages to `'Invalid or expired token'`.

---

### ✅ M-10: `jwtOptions` Spread Overrides Security-Critical Defaults

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** `...jwtOptions` spread now applied first, security-critical options override after.

---

### ✅ M-11: Rate Limit `excludePaths` Uses Prefix Matching

- **Status:** FIXED
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** `excludePaths` uses exact or boundary matching.

---

### ✅ M-12: CORS Headers Leak Method/Header Lists When Origin Rejected

- **Status:** FIXED
- **File:** `lib/middleware/cors.js`
- **Fix applied:** CORS headers (methods, allowed headers, credentials, exposed headers) only set when origin is allowed.

---

### ✅ M-13: `apiKeyValidator.length` Arity Check Is Unreliable

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Removed unreliable `Function.length` arity check; always calls validators with `(apiKey, req)`.

---

## LOW (Consider fixing)

### ✅ L-1: `fast-querystring` `__proto__` in Query Can Pollute Downstream

- **Status:** FIXED
- **File:** `lib/router/sequential.js`
- **Fix applied:** After parsing query string, dangerous keys (`__proto__`, `constructor`, `prototype`) are deleted from `req.query`, mirroring the existing protection on `req.params`.

### ✅ L-2: Empty JSON Body Silently Becomes `{}`

- **Status:** FIXED — ⚠️ BREAKING CHANGE
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Empty or whitespace-only JSON bodies now set `req.body` to `undefined` instead of `{}`, letting the application decide the semantics.

### ✅ L-3: `_rawBodyText` Publicly Accessible

- **Status:** FIXED
- **File:** `lib/middleware/body-parser.js`
- **Fix applied:** Raw body text now stored via `Symbol.for('0http.rawBody')` (`RAW_BODY_SYMBOL`) instead of `req._rawBodyText`, preventing accidental serialization/logging. Symbol is exported for programmatic access.

### ✅ L-4: Missing JWT Token Type (`typ`) Header Validation

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Added `requiredTokenType` option to `createJWTAuth`. After successful JWT verification, validates the `typ` header claim (case-insensitive). Rejects tokens with missing or incorrect type when configured.

### ✅ L-5: Internal Functions Exported, Expanding Attack Surface

- **Status:** FIXED
- **File:** `lib/middleware/jwt-auth.js`
- **Fix applied:** Internal functions removed from module exports.

### ✅ L-6: Rate Limit Headers Disclose Exact Config/Counters

- **Status:** FIXED
- **File:** `lib/middleware/rate-limit.js`
- **Fix applied:** `standardHeaders` now accepts `true` (full headers — default, backward compatible), `false` (no headers), or `'minimal'` (only `Retry-After` on 429 responses). Minimal mode prevents disclosing exact rate limit configuration and usage counters.

### ✅ L-7: Missing `Vary: Origin` for Static String CORS Origins

- **Status:** FIXED
- **File:** `lib/middleware/cors.js`
- **Fix applied:** `Vary: Origin` now set for all non-wildcard origins (not just function/array).

---

## INFO (Awareness)

- ✅ **I-1:** `'unknown'` fallback in rate limiter now generates unique per-request keys to prevent shared bucket DoS; logs a security warning on first occurrence (`rate-limit.js`) — FIXED
- ✅ **I-2:** `allowedHeaders` function now resolved once per preflight request instead of 3 times, preventing inconsistency and wasted resources (`cors.js`) — FIXED
- ✅ **I-3:** Pointless `try/catch` blocks that only re-throw in body parser — FIXED (removed)
- ✅ **I-4:** Empty `catch` blocks in JWT `handleAuthError` now log errors via `console.error` to aid debugging (`jwt-auth.js`) — FIXED

---

## Positive Observations

- Prototype pollution protection on route params is well-implemented with `hasOwnProperty.call()` guard
- `fast-querystring` uses null-prototype objects for query results
- Security test suite exists for prototype pollution scenarios
- Body parser has comprehensive limits (parameter counts, field counts, key lengths)
- JWT error messages are partially sanitized (enumerated messages, not raw errors)
- CORS correctly blocks `credentials: true` + `origin: '*'` combination
- Lazy loading of heavy dependencies reduces startup attack surface
- `parseLimit` regex is anchored and bounded (not vulnerable to ReDoS)

---

## Breaking Changes Summary

| Vulnerability | Breaking Change                                                         | Impact                                                              |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| CRIT-3        | Default rate limit key generator no longer trusts proxy headers         | Users behind reverse proxies must supply custom `keyGenerator`      |
| CRIT-6        | Default JWT algorithms changed from `['HS256', 'RS256']` to `['HS256']` | Users relying on RS256 must explicitly configure algorithms         |
| M-5           | `parseLimit` throws `TypeError` on invalid types                        | Code passing `false`, `null`, or objects to `parseLimit` will throw |
| M-7           | `req.ctx.apiKey` / `req.apiKey` now stores masked value                 | Code reading raw API key must use `req[API_KEY_SYMBOL]` instead     |
| L-2           | Empty JSON body now sets `req.body` to `undefined` instead of `{}`      | Code checking `req.body` for empty JSON must handle `undefined`     |

---

## Suggested Next Steps

1. ~~**Fix remaining HIGH issues:** H-3 (streaming body read), H-5 (single-pass multipart), H-8 (query token deprecation)~~ ✅ All HIGH issues fixed
2. ~~**Fix remaining MEDIUM issues:** M-7 (mask API key in context), M-8 (JWKS HTTPS validation)~~ ✅ All MEDIUM issues fixed
3. ~~**Address LOW/INFO issues** as part of ongoing maintenance~~ ✅ All LOW and INFO issues fixed
4. **Write security regression tests** for each fix ✅ Completed — 483 tests passing
5. **Bump version to 1.3.0** with security changelog
