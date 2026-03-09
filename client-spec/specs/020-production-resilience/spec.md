# Feature Specification: Production Resilience — Database Failover, Rate Limiting & Session Recovery

**Feature Branch**: `020-production-resilience`  
**Created**: 2026-03-05  
**Status**: Draft  
**Jira Epic**: [MTB-554](https://mentalhelpglobal.atlassian.net/browse/MTB-554)  
**Depends on**: Existing `chat-backend` infrastructure on Cloud Run + Cloud SQL  
**Input**: Production log analysis from 2026-03-05 revealing transient Cloud SQL failures cascading into user-facing errors, absence of OTP rate limiting, and lack of session recovery after backend reconnection

---

## Problem Statement

Production log analysis of the `chat-backend` service revealed four categories of operational weakness:

1. **Database connection fragility**: A brief Cloud SQL proxy interruption at 11:16 UTC caused a single `ECONNREFUSED` error to cascade into 3 gateway timeouts (504, 60s each) and 1 internal server error (500). The connection pool (`pg-pool`) made no retry attempt — a single refused connection immediately surfaced as a user-facing failure.

2. **Session state corruption after transient outages**: Following the ~12-minute DB disruption window, 49 subsequent requests from 3 active users returned 403 Forbidden on the chat message endpoint. These users were mid-conversation when the outage occurred, and the system provided no recovery path — they were silently locked out of their sessions with no guidance to re-authenticate or restart.

3. **No rate limiting on authentication endpoints**: A single IP address submitted 40 failed OTP verification attempts within ~10 minutes, including bursts of 4 requests per second. The system processed all attempts without throttling, creating both a brute-force attack surface and unnecessary load on the auth pipeline.

4. **Missing operational baselines**: The service returns 404 for `GET /` and `GET /robots.txt`, providing no health check surface for external monitors and no crawler guidance.

These are not feature gaps — they are operational resilience gaps that affect real users in production today.

---

## Clarifications

### Session 2026-03-05

- Q: Should the spec include observability requirements (logging/metrics/alerts) for resilience mechanisms? → A: Structured log lines only — retry attempts, rate limit rejections, and circuit breaker trips emitted as structured logs queryable via Cloud Logging. No custom metrics or automated alerts in this scope.
- Q: Should the `POST /api/auth/otp/request` (send OTP) endpoint also be rate-limited to prevent SMS/email flooding? → A: Yes — rate-limit to 3 per 5 minutes per IP, stricter than verify since each request triggers an SMS/email dispatch.
- Q: Should the health check endpoint perform a lightweight DB query or just check pool connectivity? → A: Lightweight `SELECT 1` query — validates the full path from app through Cloud SQL proxy to PostgreSQL, not just pool state.
- Q: Should rate limit counters be shared between `chat-backend` and `workbench-backend` or isolated per service? → A: Shared — same Redis key namespace, keyed by IP + endpoint path. Prevents attackers from splitting attempts across services to circumvent limits.
- Q: What should the user see during the backend DB retry window (up to ~10s)? → A: Display a spinner. The frontend should show a loading spinner for in-flight requests; no special "retrying" message — the spinner covers the wait transparently.

---

## User Scenarios & Testing

### User Story 1 — Service Survives Transient Database Disconnection (Priority: P0)

The chat backend temporarily loses its database connection (Cloud SQL proxy restart, network blip, connection pool exhaustion). Instead of immediately failing user requests with 500/504, the system retries the connection with backoff. If the database recovers within a reasonable window (≤ 30 seconds), in-flight requests succeed transparently. If the database does not recover, requests fail with a clear, actionable error rather than a raw timeout.

**Why this priority**: A single transient DB hiccup today cascades into minutes of user-facing failures across multiple active sessions. This is the highest-impact gap found in production.

**Independent Test**: Simulate a Cloud SQL proxy restart (kill and restart the proxy sidecar in a test environment). Verify that requests issued during the ~5s restart window either succeed after retry or fail fast with a structured error — not a 60s gateway timeout.

**Acceptance Scenarios**:

1. **Given** the database connection is temporarily refused, **When** a request arrives, **Then** the connection pool retries with exponential backoff (initial delay ≤ 500ms, max 3 retries, max total wait ≤ 10s) before returning an error.
2. **Given** the database recovers within the retry window, **When** retries are in progress, **Then** the request succeeds transparently — the user receives a normal response with no indication of the transient failure.
3. **Given** the database does not recover within the retry window, **When** all retries are exhausted, **Then** the request fails with a 503 Service Unavailable (not 500 or 504) and a structured JSON error body indicating temporary unavailability.
4. **Given** the connection pool is configured with retry logic, **When** the pool recovers a working connection, **Then** subsequent requests proceed without further retries — the pool self-heals.
5. **Given** the database is down for an extended period (> 30s), **When** multiple requests arrive, **Then** the system does not queue unbounded retries — it fails fast after the retry budget is exhausted, preventing resource exhaustion on the Cloud Run instance.

---

### User Story 2 — Active Users Recover After Transient Backend Failure (Priority: P0)

A user is mid-conversation when a transient backend failure occurs. After the backend recovers, the user can continue their conversation without manually re-authenticating or losing context. If the session cannot be recovered, the user receives a clear prompt to start a new session rather than seeing repeated silent 403 errors.

**Why this priority**: Today, 3 users were stuck in a 403 loop for 25 minutes after the DB recovered. The system gave them no path forward — they saw no error message, no prompt, and no way to recover without clearing cookies or waiting for token expiry.

**Independent Test**: Start a chat session, simulate a transient auth/session failure (e.g., invalidate the session in the database briefly then restore it), and verify the client either transparently recovers or shows an actionable error.

**Acceptance Scenarios**:

1. **Given** a user receives a 403 on `POST /api/chat/message`, **When** the response indicates the session is no longer valid, **Then** the client attempts to refresh the auth token automatically (one attempt).
2. **Given** the token refresh succeeds, **When** the client retries the original message request, **Then** the message is delivered and the conversation continues without user intervention.
3. **Given** the token refresh fails (401), **When** the client detects an unrecoverable auth state, **Then** the user is shown a clear, localized message (e.g., "Your session has expired. Please sign in again.") and redirected to the login flow.
4. **Given** a user receives a 403 on session-related endpoints (`/sessions`, `/sessions/{id}/end`), **When** the error occurs, **Then** the same recovery flow applies — attempt refresh, then prompt re-auth if refresh fails.
5. **Given** the client encounters 3 consecutive 403 errors on the chat message endpoint without a successful refresh, **When** the circuit trips, **Then** the client stops retrying and shows the re-authentication prompt immediately.

---

### User Story 3 — OTP Verification Is Rate-Limited Per IP (Priority: P1)

The OTP verification endpoint enforces per-IP rate limits to prevent brute-force attempts and reduce unnecessary backend load. Legitimate users who mistype once or twice are unaffected. Automated or rapid-fire abuse is blocked with a clear cooldown message.

**Why this priority**: 40 failed OTP attempts from a single IP in 10 minutes — including sub-second bursts — represents an exploitable surface. Rate limiting is a standard security control that is currently absent.

**Independent Test**: Send 6 OTP verification requests from the same IP within 60 seconds. Verify that the 6th request is rejected with a 429 status and a `Retry-After` header.

**Acceptance Scenarios**:

1. **Given** the OTP verify endpoint, **When** a client sends more than 5 requests within a 60-second window from the same IP, **Then** subsequent requests receive 429 Too Many Requests with a `Retry-After` header indicating cooldown duration.
2. **Given** a rate-limited IP, **When** the cooldown expires, **Then** the IP can attempt verification again normally.
3. **Given** a rate-limited request, **When** the 429 response is returned, **Then** the response body includes a localized, user-friendly message (e.g., "Too many attempts. Please wait before trying again.").
4. **Given** the rate limit window, **When** a different IP sends requests, **Then** it is tracked independently — rate limits are per-IP, not global.
5. **Given** the rate limit configuration, **When** the system is deployed, **Then** the limits (max attempts, window duration, cooldown) are configurable via environment variables without code changes.
6. **Given** the chat frontend receives a 429 from OTP verify, **When** displaying the error, **Then** it shows a countdown timer based on the `Retry-After` header and disables the submit button until the cooldown expires.

---

### User Story 4 — Service Provides Health & Operational Endpoints (Priority: P2)

The chat backend exposes basic operational endpoints that external monitoring, load balancers, and crawlers expect. These endpoints do not require authentication and return lightweight responses.

**Why this priority**: Currently `GET /` and `GET /robots.txt` return 404, providing no health surface for uptime monitors and generating noise in logs.

**Independent Test**: Hit `GET /healthz` and `GET /robots.txt` on the production URL. Verify correct responses and appropriate caching headers.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request to `GET /healthz`, **When** the service is running and can reach the database, **Then** it returns 200 with `{ "status": "ok" }`.
2. **Given** an unauthenticated request to `GET /healthz`, **When** the database is unreachable, **Then** it returns 503 with `{ "status": "degraded", "db": "unreachable" }`.
3. **Given** an unauthenticated request to `GET /robots.txt`, **When** the request arrives, **Then** the service returns 200 with `User-agent: *\nDisallow: /api/` and a `Cache-Control: public, max-age=86400` header.
4. **Given** an unauthenticated request to `GET /`, **When** the request arrives, **Then** the service returns 200 with a minimal JSON response (e.g., `{ "service": "chat-backend", "status": "ok" }`).

---

### Edge Cases

- **Connection pool fully drained**: If all pool connections are in-use and the DB is down, new requests should fail fast (within retry budget) rather than queuing behind stuck connections.
- **Retry storm**: If multiple Cloud Run instances all retry simultaneously after a DB outage, the reconnection surge could overload the Cloud SQL instance. Retry backoff must include jitter to spread reconnection attempts.
- **Rate limiting behind a CDN/proxy**: If requests arrive through Cloudflare or a load balancer, the rate limiter must use the `X-Forwarded-For` or `CF-Connecting-IP` header for the true client IP, not the proxy IP.
- **Rate limit state across instances**: Cloud Run may scale to multiple instances. Rate limit counters should be stored in Redis (existing infrastructure) for consistency across instances. If Redis is unavailable, fall back to in-memory per-instance limits (less accurate but still protective).
- **Health check frequency**: External monitors polling `/healthz` should not trigger Cloud Run scale-up for idle instances. The health check should be lightweight and avoid cold-start-inducing load.
- **Session recovery with stale Dialogflow context**: If a chat session's Dialogflow context has expired during the outage, token refresh alone won't recover the conversation. The system should detect this and prompt the user to start a new session rather than silently failing.
- **OTP rate limit and legitimate users on shared IP (NAT)**: Corporate or mobile carrier NAT may cause many users to share an IP. The rate limit window (5 per 60s) is generous enough for legitimate multi-user scenarios but may need monitoring.

---

## Requirements

### Functional Requirements

#### Database Connection Resilience

- **FR-001**: The database connection pool MUST implement retry logic with exponential backoff and jitter for transient connection errors (`ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`).
- **FR-002**: Retry parameters MUST be configurable via environment variables: `DB_RETRY_MAX_ATTEMPTS` (default: 3), `DB_RETRY_INITIAL_DELAY_MS` (default: 500), `DB_RETRY_MAX_DELAY_MS` (default: 5000).
- **FR-003**: When all retries are exhausted, the system MUST return HTTP 503 Service Unavailable with a structured JSON error body, not 500 or 504.
- **FR-004**: The connection pool MUST self-heal after the database becomes available — no manual restart or redeployment required.
- **FR-005**: Retry logic MUST include randomized jitter (±25% of delay) to prevent thundering herd reconnection surges across multiple Cloud Run instances.

#### Session Recovery

- **FR-006**: When the chat frontend receives a 403 on any `/api/chat/*` endpoint, it MUST automatically attempt a single token refresh via `POST /api/auth/refresh` before showing an error.
- **FR-007**: If the token refresh succeeds, the frontend MUST transparently retry the original failed request with the new token.
- **FR-008**: If the token refresh fails (401), the frontend MUST display a localized session-expiry message and redirect to the login flow.
- **FR-009**: The frontend MUST implement a circuit breaker: after 3 consecutive 403 errors without a successful recovery, it MUST stop retrying and show the re-authentication prompt immediately.
- **FR-009a**: When a chat message request is in-flight for longer than 3 seconds, the frontend MUST display a loading spinner to indicate the request is still being processed. The spinner MUST remain visible until the response arrives or the request fails with a user-facing error.
- **FR-010**: The backend 403 response body MUST include a machine-readable `code` field (e.g., `SESSION_EXPIRED`, `SESSION_NOT_FOUND`, `AUTH_REQUIRED`) to allow the client to distinguish between recoverable and non-recoverable states.

#### OTP Rate Limiting

- **FR-011**: The `POST /api/auth/otp/verify` endpoint MUST enforce per-IP rate limiting: maximum 5 requests per 60-second sliding window.
- **FR-012**: Rate-limited requests MUST receive HTTP 429 Too Many Requests with a `Retry-After` header (seconds until next allowed attempt) and a localized error message.
- **FR-013**: Rate limit counters MUST be stored in Redis for consistency across Cloud Run instances, using a shared key namespace (e.g., `rl:{ip}:{endpoint}`) so that `chat-backend` and `workbench-backend` share the same per-IP budget for equivalent endpoints. If Redis is unavailable, the system MUST fall back to in-memory per-instance counters.
- **FR-014**: Rate limit parameters MUST be configurable via environment variables: `OTP_RATE_LIMIT_MAX` (default: 5), `OTP_RATE_LIMIT_WINDOW_SECONDS` (default: 60).
- **FR-014a**: The `POST /api/auth/otp/request` (send OTP) endpoint MUST enforce per-IP rate limiting: maximum 3 requests per 300-second sliding window. Configurable via `OTP_REQUEST_RATE_LIMIT_MAX` (default: 3) and `OTP_REQUEST_RATE_LIMIT_WINDOW_SECONDS` (default: 300).
- **FR-014b**: Rate-limited OTP request attempts MUST receive HTTP 429 with a `Retry-After` header and a localized message indicating the cooldown before another OTP can be sent.
- **FR-015**: The rate limiter MUST use the true client IP from `X-Forwarded-For` or `CF-Connecting-IP` headers when behind a proxy/CDN.
- **FR-016**: The chat frontend MUST handle 429 responses on OTP verify by displaying a countdown timer and disabling the submit button until `Retry-After` expires.
- **FR-016a**: The chat frontend MUST handle 429 responses on OTP request (send code) by disabling the "Send code" / "Resend" button and showing a cooldown message until `Retry-After` expires.

#### Observability

- **FR-021**: The database retry logic MUST emit a structured log entry for each retry attempt, including: error type, attempt number, delay applied, and whether the retry succeeded or exhausted.
- **FR-022**: The rate limiter MUST emit a structured log entry for each rejected request (429), including: client IP, endpoint, current count, and window remaining.
- **FR-023**: The frontend circuit breaker MUST log (to browser console in structured format) each trip event, including: endpoint, consecutive failure count, and action taken (retry vs. prompt re-auth).
- **FR-024**: All backend structured log entries for resilience events MUST use a consistent `event` field namespace (e.g., `resilience.db_retry`, `resilience.rate_limit`, `resilience.circuit_break`) to enable Cloud Logging filtering.

#### Health & Operational Endpoints

- **FR-017**: The service MUST expose `GET /healthz` returning 200 when healthy or 503 when degraded, with a JSON body indicating component status. The DB check MUST execute a `SELECT 1` query to validate the full connection path (app → Cloud SQL proxy → PostgreSQL), not merely check pool state.
- **FR-018**: The service MUST expose `GET /robots.txt` returning a static text response disallowing `/api/` for all crawlers, with long-lived cache headers.
- **FR-019**: The service MUST expose `GET /` returning 200 with a minimal JSON status response.
- **FR-020**: Health and operational endpoints MUST NOT require authentication.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Transient Cloud SQL proxy restarts (≤ 10s) produce zero user-facing errors — requests succeed transparently via retry.
- **SC-002**: After a transient backend outage, 100% of active users either resume their session automatically or receive an actionable re-authentication prompt within one request — no silent 403 loops.
- **SC-003**: No single IP can submit more than 5 OTP verification attempts per 60 seconds. Excess attempts receive 429 with a valid `Retry-After` header.
- **SC-004**: `GET /healthz` correctly reports service health status and can serve as an external uptime monitor target.
- **SC-005**: Zero increase in p95 request latency under normal operation — resilience mechanisms add no measurable overhead when the database is healthy.
- **SC-006**: After a DB outage and recovery, the connection pool re-establishes working connections within 15 seconds without manual intervention.
- **SC-007**: All resilience events (DB retries, rate limit rejections, circuit breaker trips) are queryable in Cloud Logging using a single filter prefix (`resilience.*`).

---

## Goals & Non-Goals

### In Scope

- Connection pool retry with backoff and jitter for transient DB errors
- Structured 503 responses when DB is persistently unavailable
- Frontend automatic token refresh on 403 with transparent request retry
- Frontend circuit breaker for unrecoverable 403 loops
- Backend machine-readable error codes in 403 responses
- Per-IP rate limiting on OTP verify with Redis-backed counters
- Frontend 429 handling with cooldown timer
- Health check, robots.txt, and root endpoints

### Out of Scope

- Global rate limiting across all API endpoints (separate initiative)
- Database failover / read-replica routing
- Alerting and PagerDuty integration (operational, not code)
- DDoS protection beyond per-endpoint rate limiting (handled at CDN/LB layer)
- Circuit breaker on backend-to-Dialogflow communication (separate concern)
- WebSocket / real-time connection resilience (not applicable to current HTTP architecture)

---

## Assumptions

- Redis is already available in the production infrastructure (used for token persistence per spec 014).
- Cloud Run instances can read `X-Forwarded-For` or `CF-Connecting-IP` headers reliably for client IP identification.
- The existing `pg-pool` library supports custom connection error handling hooks or can be wrapped with retry logic.
- Frontend auth token refresh flow (`POST /api/auth/refresh`) is already implemented — this spec adds automatic invocation on 403, not a new refresh mechanism.
- The Cloud SQL Auth Proxy sidecar restarts are the primary cause of transient `ECONNREFUSED` errors (confirmed by production logs).

---

## Open Questions

| # | Question | Owner |
|---|---|---|
| ~~1~~ | ~~Should the `POST /api/auth/otp/request` (send OTP) endpoint also be rate-limited to prevent SMS/email flooding?~~ **Resolved:** Yes — 3 per 5 minutes per IP (FR-014a, FR-014b). | Product |
| ~~2~~ | ~~Should the health check endpoint perform a lightweight DB query (e.g., `SELECT 1`) or just check pool connectivity?~~ **Resolved:** `SELECT 1` query — validates full path through Cloud SQL proxy (FR-017). | Engineering |
| ~~3~~ | ~~Should rate limit counters be shared between `chat-backend` and `workbench-backend` or isolated per service?~~ **Resolved:** Shared Redis namespace keyed by IP + endpoint path (FR-013). | Engineering |
