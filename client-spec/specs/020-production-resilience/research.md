# Research: Production Resilience

**Branch**: `020-production-resilience` | **Date**: 2026-03-05  
**Spec**: [spec.md](./spec.md)

---

## R1. Database Connection Retry Strategy

**Decision**: Wrap the existing `pg` Pool `query()` and `transaction()` methods with a retry layer that catches transient connection errors (`ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`) and retries with exponential backoff + jitter. No library replacement needed.

**Rationale**: The codebase uses `pg` (v8.13.1) native Pool with `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 10000`. The pool already has `pool.on('error', ...)` for idle client errors and a `checkHealth()` method using `SELECT 1`. Adding a retry wrapper around the existing `query()` export is minimally invasive and preserves all current transaction semantics.

**Alternatives considered**:
- Replace `pg` with `pg-pool` (dedicated package): rejected — `pg` includes `Pool` natively and the codebase already depends on it.
- Use `node-pg-retry` or `pg-retry`: rejected — adds an external dependency for simple retry logic; a 30-line wrapper is sufficient and more controllable.
- Add retry at the Express middleware level: rejected — retry must happen at the pool/query level to handle connection acquisition failures, not at the HTTP handler level.

**Implementation detail**: The retry wrapper checks the error `code` property against a whitelist of transient codes. Non-transient errors (e.g., SQL syntax errors, constraint violations) are thrown immediately without retry.

---

## R2. Rate Limiting Middleware

**Decision**: Use `express-rate-limit` (npm) with `rate-limit-redis` store for Redis-backed sliding window counters. Install as a new dependency in both `chat-backend` and `workbench-backend`.

**Rationale**: `express-rate-limit` is the de facto standard for Express rate limiting (35M+ weekly downloads), supports pluggable stores, and provides `Retry-After` header out of the box. The `rate-limit-redis` store uses the existing `ioredis` (v5.9.3) connection already configured for token persistence. No new Redis infrastructure needed.

**Alternatives considered**:
- Custom rate limiter with raw ioredis INCR/EXPIRE: rejected — reinvents sliding window logic that `express-rate-limit` handles correctly, including edge cases around window boundaries.
- `express-slow-down` (delay-based): rejected — delays don't prevent brute force; hard rejection with 429 is the spec requirement.
- `koa-ratelimit` or framework-agnostic: rejected — the codebase uses Express (v5.1.0).

**Shared key namespace**: Both services use key format `rl:{endpoint}:{ip}` so a single IP's budget is shared across `chat-backend` and `workbench-backend`. The `rate-limit-redis` store accepts a `prefix` option for namespace isolation within the same Redis instance.

**Redis fallback**: `express-rate-limit` defaults to an in-memory `MemoryStore` if the Redis store fails to initialize. The factory detects `redisService.isHealthy()` at startup and falls back automatically.

---

## R3. Frontend 403 Recovery Pattern

**Decision**: Enhance the existing `apiFetch` interceptor in `chat-frontend/src/services/api.ts` rather than adding a new interceptor layer. Add a circuit breaker counter to the existing 403 → refresh → retry flow.

**Rationale**: The frontend already implements 403 recovery:
1. `apiFetch` detects 401/403 or auth error codes (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, etc.)
2. Calls `handleApiError()` → `refreshSession()`
3. On success: retries the original request with `allowRefresh: false`
4. On failure (401): calls `clearTokens()` and `fireOnUnauthenticated()` → logout + redirect to `/login`

The gap is: no circuit breaker for consecutive 403 failures that survive refresh. The existing pattern retries once per request but doesn't track cross-request failure streaks. Adding a failure counter to the existing flow (reset on any 2xx, trip after 3 consecutive 403s) closes this gap with minimal code.

**Alternatives considered**:
- Axios migration with interceptor chain: rejected — the entire codebase uses native `fetch` via `apiFetch`; migrating to Axios would be a large unrelated change.
- Dedicated resilience library (e.g., `cockatiel`, `opossum`): rejected — over-engineering for a single counter; a module-scoped variable is sufficient.
- State management in Zustand: rejected — circuit breaker is a transport concern, not application state.

---

## R4. Structured Logging Format

**Decision**: Use JSON-structured log lines with a consistent `event` field namespace, emitted via `console.log(JSON.stringify({ event, ... }))`. Cloud Run automatically captures stdout/stderr and indexes JSON fields in Cloud Logging.

**Rationale**: The codebase currently uses `console.log` and `console.error` for all logging (no structured logging library). Cloud Run's logging driver parses JSON payloads from stdout and makes fields queryable. Adding a thin helper (`logResilience(event, details)`) that emits `{ event: "resilience.db_retry", timestamp, ...details }` integrates with existing patterns and requires no new dependency.

**Alternatives considered**:
- Winston or Pino structured logger: rejected — adds a dependency and requires refactoring all existing log calls; out of scope for this resilience-focused change.
- Cloud Logging client library (`@google-cloud/logging`): rejected — heavier dependency; Cloud Run's stdout capture is sufficient.

**Event namespace**:
- `resilience.db_retry` — attempt number, error code, delay, success/exhausted
- `resilience.rate_limit` — IP, endpoint, count, window remaining
- `resilience.circuit_break` — (frontend console only) endpoint, failure count, action

---

## R5. Health Endpoint Enhancement

**Decision**: Enhance the existing `GET /api/health` endpoint rather than adding a new `/healthz`. Add unauthenticated access and alias `/healthz` → `/api/health` for Cloud Run / external monitor compatibility.

**Rationale**: The codebase already has `GET /api/health` in `src/index.ts` with checks for DB (`checkDbHealth()` using `SELECT 1`), Redis, email config, and Dialogflow config. It returns `{ status: "ok" | "degraded", timestamp, services: { database, redis, email, dialogflow } }`. This already satisfies FR-017. The remaining work is:
1. Ensure the route is unauthenticated (currently it is — defined before auth middleware).
2. Add a `/healthz` alias at the root for convention.
3. Add `GET /` and `GET /robots.txt` static routes.

**Alternatives considered**:
- Separate `/healthz` with only DB check: rejected — the existing `/api/health` already includes DB; duplicating logic is unnecessary.
- Kubernetes-style liveness vs readiness split: rejected — Cloud Run manages instance lifecycle; a single health endpoint is sufficient.

---

## R6. Chat Route 403 Error Code Enrichment

**Decision**: Standardize all 403 responses in `chat.ts` to use `{ success: false, error: { code, message } }` format, replacing plain string `error` fields on ownership checks.

**Rationale**: The auth middleware and OTP routes already use `{ code, message }` format. Chat route ownership checks (message, end session, memory, feedback) use `{ success: false, error: "Access denied: ..." }` — a plain string. Standardizing to the `{ code, message }` format enables the frontend to distinguish between error types programmatically (FR-010). New codes: `SESSION_NOT_FOUND`, `SESSION_OWNERSHIP`, `MESSAGE_OWNERSHIP`.

**Alternatives considered**:
- Numeric error codes: rejected — string codes are already the convention across auth routes.
- HTTP sub-status codes: rejected — non-standard and not supported by the frontend parser.

---

## Technology Stack Summary

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Backend | Node.js + Express | Node 20 / Express 5.1.0 | Existing |
| Database | pg (native Pool) | 8.13.1 | Wrap with retry |
| Cache/Store | ioredis | 5.9.3 | Existing; add rate limit store |
| Rate limiting | express-rate-limit + rate-limit-redis | Latest | New dependency |
| Frontend | React + native fetch | React 18 | Existing `apiFetch` interceptor |
| Logging | JSON stdout (Cloud Run capture) | N/A | Thin helper, no library |
| Health | Existing `/api/health` + aliases | N/A | Enhancement only |
