# Quickstart: Production Resilience

**Branch**: `020-production-resilience` | **Date**: 2026-03-05

---

## Prerequisites

- Node.js 20+, npm 9+
- Access to `chat-backend`, `chat-frontend`, `workbench-backend` repositories
- Redis (Memorystore) available and configured via `REDIS_HOST`, `REDIS_PORT`
- PostgreSQL via Cloud SQL Auth Proxy

---

## Setup Steps

### 1. Create feature branches

```bash
cd D:/src/MHG/chat-backend      && git checkout develop && git pull && git checkout -b 020-production-resilience
cd D:/src/MHG/chat-frontend     && git checkout develop && git pull && git checkout -b 020-production-resilience
cd D:/src/MHG/workbench-backend && git checkout develop && git pull && git checkout -b 020-production-resilience
```

### 2. Install new dependencies (`chat-backend`)

```bash
cd D:/src/MHG/chat-backend
npm install express-rate-limit rate-limit-redis
```

### 3. Install new dependencies (`workbench-backend`)

```bash
cd D:/src/MHG/workbench-backend
npm install express-rate-limit rate-limit-redis
```

### 4. Backend — DB retry wrapper (`chat-backend`)

In `src/db/index.ts`:
1. Add retry wrapper around `query()` and `transaction()` exports
2. Catch transient error codes: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`
3. Retry with exponential backoff + jitter (env-configurable)
4. After exhausting retries, throw structured error (503-mappable)
5. Add structured log emission for each retry attempt

Environment variables (add to `.env` and deploy workflows):
```
DB_RETRY_MAX_ATTEMPTS=3
DB_RETRY_INITIAL_DELAY_MS=500
DB_RETRY_MAX_DELAY_MS=5000
```

### 5. Backend — Rate limiting middleware (`chat-backend`)

In `src/middleware/rateLimiter.ts`:
1. Create rate limiter factory using `express-rate-limit` + `rate-limit-redis`
2. Use existing `redisService` ioredis connection for the store
3. Key format: `rl:{endpoint_hash}:{ip}`
4. Fall back to `MemoryStore` if Redis unavailable
5. Emit structured log on each 429

In `src/routes/auth.ts`:
1. Apply OTP verify limiter: 5 req / 60s per IP
2. Apply OTP send limiter: 3 req / 300s per IP
3. Use `X-Forwarded-For` or `CF-Connecting-IP` for real client IP

Environment variables:
```
OTP_RATE_LIMIT_MAX=5
OTP_RATE_LIMIT_WINDOW_SECONDS=60
OTP_REQUEST_RATE_LIMIT_MAX=3
OTP_REQUEST_RATE_LIMIT_WINDOW_SECONDS=300
```

### 6. Backend — Error code standardization (`chat-backend`)

In `src/routes/chat.ts`:
1. Replace plain string 403 errors with `{ code, message }` format
2. New codes: `SESSION_NOT_FOUND`, `SESSION_OWNERSHIP`, `MESSAGE_OWNERSHIP`

### 7. Backend — Health and operational routes (`chat-backend`)

In `src/index.ts` or `src/routes/health.ts`:
1. Add `GET /healthz` alias to existing `/api/health`
2. Add `GET /` returning `{ service: "chat-backend", status: "ok" }`
3. Add `GET /robots.txt` returning static text with cache headers
4. Ensure all three are unauthenticated (before auth middleware)

### 8. Backend — Structured logging helper (`chat-backend`)

In `src/utils/resilience-logger.ts`:
1. Export `logResilience(event, details)` → `console.log(JSON.stringify({ event, timestamp, ...details }))`
2. Use namespace: `resilience.db_retry`, `resilience.rate_limit`

### 9. Backend — Rate limiting (`workbench-backend`)

In `src/middleware/rateLimiter.ts`:
1. Same rate limiter factory as chat-backend
2. Same Redis key namespace (`rl:*`)
3. Apply to OTP verify and send endpoints

### 10. Frontend — 403 recovery enhancement (`chat-frontend`)

In `src/services/api.ts`:
1. Add module-scoped `consecutiveFailures` counter
2. Increment on 403 after failed refresh; reset on any 2xx
3. After 3 consecutive failures → skip retry, fire `onUnauthenticated` immediately
4. Add spinner trigger for requests exceeding 3s in-flight

### 11. Frontend — 429 handling (`chat-frontend`)

In `src/components/OtpLoginForm.tsx`:
1. Detect 429 response from OTP verify and send
2. Parse `Retry-After` header
3. Display countdown timer, disable submit button
4. Re-enable after cooldown

### 12. Frontend — i18n (`chat-frontend`)

In `src/locales/{en,uk,ru}.json`:
1. Add `login.otp.rate_limited` — "Too many attempts. Please wait {seconds} seconds."
2. Add `login.otp.rate_limited_send` — "Please wait before requesting another code."
3. Add `chat.session.expired` — "Your session has expired. Please sign in again."
4. Add `chat.session.reconnecting` — "Reconnecting..."

---

## Verification

### Smoke test: DB retry
1. Stop Cloud SQL proxy briefly (~5s), send a chat message during the outage
2. Verify: request succeeds after proxy restart (transparent retry) or returns 503 (not 500/504)
3. Check Cloud Logging for `resilience.db_retry` events

### Smoke test: Rate limiting
1. Send 6 `POST /api/auth/otp/verify` requests within 60s from same IP
2. Verify: 6th request returns 429 with `Retry-After` header
3. Verify: frontend shows countdown timer and disables submit
4. Wait for cooldown → verify next request succeeds
5. Check Cloud Logging for `resilience.rate_limit` events

### Smoke test: 403 recovery
1. Start a chat session, simulate token invalidation
2. Send a message → verify frontend auto-refreshes and retries
3. Force 3 consecutive 403 failures → verify re-auth prompt appears
4. Verify: no silent 403 loop

### Smoke test: Health endpoints
1. `GET /healthz` → 200 with services status
2. `GET /` → 200 with service name
3. `GET /robots.txt` → 200 with crawler directives
4. Stop DB → `GET /healthz` → 503 with `database: false`

### Smoke test: OTP send rate limit
1. Send 4 OTP requests within 5 minutes from same IP
2. Verify: 4th request returns 429
3. Verify: frontend disables resend button with cooldown message

### Backward compatibility
1. Existing chat sessions continue working
2. Existing OTP flow works normally (within rate limits)
3. Existing health endpoint `/api/health` still works
