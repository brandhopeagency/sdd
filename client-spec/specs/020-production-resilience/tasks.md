# Tasks: Production Resilience — DB Retry, Rate Limiting, Session Recovery & Health Endpoints

**Input**: Design docs from `/specs/020-production-resilience/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`  
**Jira Epic**: [MTB-554](https://mentalhelpglobal.atlassian.net/browse/MTB-554)

## Jira Story Mapping

- US1 -> `MTB-555`
- US2 -> `MTB-556`
- US3 -> `MTB-557`
- US4 -> `MTB-558`

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Create `020-production-resilience` branches from `develop` in `D:/src/MHG/chat-backend`, `D:/src/MHG/chat-frontend` ? MTB-559
- [X] T002 [P] Install `express-rate-limit` and `rate-limit-redis` in `D:/src/MHG/chat-backend/package.json` ? MTB-560
- ~~T003~~ CANCELLED — workbench-backend repo does not exist locally ? MTB-561

## Phase 2: Foundational (Blocking)

- [X] T004 Implement structured resilience logger helper in `D:/src/MHG/chat-backend/src/utils/resilience-logger.ts` — export `logResilience(event, details)` emitting JSON with `resilience.*` namespace ? MTB-562
- [X] T005 Implement DB connection retry wrapper with exponential backoff and jitter around `query()` and `transaction()` in `D:/src/MHG/chat-backend/src/db/index.ts` — catch `ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`, env-configurable params, emit `resilience.db_retry` logs, return 503 on exhaustion ? MTB-563
- [X] T006 [P] Implement rate limiter factory middleware in `D:/src/MHG/chat-backend/src/middleware/rateLimiter.ts` — `express-rate-limit` with `rate-limit-redis` store using existing ioredis connection, `rl:{endpoint}:{ip}` key format, `MemoryStore` fallback, emit `resilience.rate_limit` logs on 429, use `X-Forwarded-For`/`CF-Connecting-IP` for real IP ? MTB-564
- [X] T007 Standardize chat route 403 responses to `{ code, message }` format in `D:/src/MHG/chat-backend/src/routes/chat.ts` — replace plain string errors with codes `SESSION_NOT_FOUND`, `SESSION_OWNERSHIP`, `MESSAGE_OWNERSHIP` ? MTB-565

## Phase 3: User Story 1 — DB Connection Resilience (Priority: P0)

**Goal**: Transient Cloud SQL proxy restarts produce zero user-facing errors; requests succeed via retry or fail fast with 503.

**Independent Test**: Stop Cloud SQL proxy for ~5s, send requests during outage, verify transparent retry or structured 503 (not 500/504). Check Cloud Logging for `resilience.db_retry` events.

- [X] T008 [US1] Add unit tests for DB retry wrapper in `D:/src/MHG/chat-backend/tests/unit/dbRetry.test.ts` — mock pg Pool errors for `ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`, verify retry count, backoff timing, jitter range, 503 on exhaustion, transparent success on recovery ? MTB-566
- [X] T009 [US1] Verify pool self-healing behavior after DB recovery in `D:/src/MHG/chat-backend/tests/unit/dbRetry.test.ts` — confirm subsequent queries proceed without retry after pool reconnects ? MTB-567
- [X] T010 [P] [US1] Add env var documentation for `DB_RETRY_MAX_ATTEMPTS`, `DB_RETRY_INITIAL_DELAY_MS`, `DB_RETRY_MAX_DELAY_MS` to deploy workflow in `D:/src/MHG/chat-backend/.github/workflows/deploy.yml` ? MTB-568

## Phase 4: User Story 2 — Session Recovery After Failure (Priority: P0)

**Goal**: After a transient backend outage, active users either resume automatically or get an actionable re-auth prompt — no silent 403 loops.

**Independent Test**: Start a chat session, simulate token invalidation, verify auto-refresh + retry or re-auth prompt after 3 consecutive failures.

- [X] T011 [US2] Add circuit breaker counter to `apiFetch` 403 handling in `D:/src/MHG/chat-frontend/src/services/api.ts` — track consecutive 403 failures, reset on 2xx, trip after 3 and fire `onUnauthenticated` immediately, emit `resilience.circuit_break` console log ? MTB-569
- [X] T012 [US2] Implement slow-request loading spinner in `D:/src/MHG/chat-frontend/src/features/chat/ChatLoadingSpinner.tsx` — display after 3s in-flight on chat message requests, remove on response/error ? MTB-570
- [X] T013 [US2] Integrate spinner trigger into chat message send flow in `D:/src/MHG/chat-frontend/src/features/chat/ChatInterface.tsx` ? MTB-571
- [X] T014 [P] [US2] Add i18n keys for session recovery in `D:/src/MHG/chat-frontend/src/locales/en.json`, `D:/src/MHG/chat-frontend/src/locales/uk.json`, `D:/src/MHG/chat-frontend/src/locales/ru.json` — `chat.session.expired`, `chat.session.reconnecting` ? MTB-572

## Phase 5: User Story 3 — OTP Rate Limiting (Priority: P1)

**Goal**: OTP verify limited to 5/60s per IP, OTP send limited to 3/300s per IP, shared Redis counters across services, frontend countdown on 429.

**Independent Test**: Send 6 OTP verify requests in 60s from same IP → 6th returns 429 with `Retry-After`. Frontend shows countdown and disables button.

- [X] T015 [US3] Apply OTP verify rate limiter (5 req/60s) to `POST /api/auth/otp/verify` in `D:/src/MHG/chat-backend/src/routes/auth.ts` ? MTB-573
- [X] T016 [US3] Apply OTP send rate limiter (3 req/300s) to `POST /api/auth/otp/send` in `D:/src/MHG/chat-backend/src/routes/auth.ts` ? MTB-574
- [X] T017 [P] [US3] Add env var documentation for `OTP_RATE_LIMIT_MAX`, `OTP_RATE_LIMIT_WINDOW_SECONDS`, `OTP_REQUEST_RATE_LIMIT_MAX`, `OTP_REQUEST_RATE_LIMIT_WINDOW_SECONDS` to deploy workflow in `D:/src/MHG/chat-backend/.github/workflows/deploy.yml` ? MTB-575
- [X] T018 [US3] Add unit tests for rate limiter middleware in `D:/src/MHG/chat-backend/tests/unit/rateLimiter.test.ts` — mock Redis store, verify counter increment, 429 on threshold, `Retry-After` header, IP extraction from headers, `MemoryStore` fallback ? MTB-576
- ~~T019~~ CANCELLED — workbench-backend repo does not exist locally ? MTB-577
- [X] T020 [US3] Implement 429 handling with countdown timer in OTP verify flow in `D:/src/MHG/chat-frontend/src/components/OtpLoginForm.tsx` — parse `Retry-After`, disable submit, show countdown ? MTB-578
- [X] T021 [US3] Implement 429 handling for OTP send (resend button) in `D:/src/MHG/chat-frontend/src/components/OtpLoginForm.tsx` — disable "Send code"/"Resend" button, show cooldown message ? MTB-579
- [X] T022 [P] [US3] Add i18n keys for rate limiting in `D:/src/MHG/chat-frontend/src/locales/en.json`, `D:/src/MHG/chat-frontend/src/locales/uk.json`, `D:/src/MHG/chat-frontend/src/locales/ru.json` — `login.otp.rate_limited`, `login.otp.rate_limited_send` ? MTB-581

## Phase 6: User Story 4 — Health & Operational Endpoints (Priority: P2)

**Goal**: `/healthz`, `/`, `/robots.txt` return correct responses; `/healthz` reports DB status via `SELECT 1`; all unauthenticated.

**Independent Test**: `GET /healthz` → 200 with services. Stop DB → `GET /healthz` → 503 with `database: false`. `GET /robots.txt` → 200 text. `GET /` → 200 JSON.

- [X] T023 [US4] Add `/healthz` alias route, `GET /` root route, and `GET /robots.txt` static route in `D:/src/MHG/chat-backend/src/index.ts` — unauthenticated, before auth middleware ? MTB-580
- [X] T024 [US4] Add unit tests for health and operational endpoints in `D:/src/MHG/chat-backend/tests/unit/health.test.ts` — verify 200/503 status, JSON body, robots.txt content, cache headers ? MTB-582

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 [P] Run backend unit test suite in `D:/src/MHG/chat-backend/tests/unit/` — 19 files, 143 tests PASS
- [X] T026 [P] Run frontend unit tests in `D:/src/MHG/chat-frontend` — 15 files, 97 tests PASS
- [ ] T027 [P] Verify zero p95 latency regression under normal operation — measure before/after on dev environment
- [ ] T028 [P] Validate responsive behavior of OTP countdown timer and session expiry prompt on mobile (375x812) in `D:/src/MHG/chat-frontend`
- [ ] T029 [P] Validate `resilience.*` structured log events are queryable in Cloud Logging on dev deployment
- [ ] T030 [P] Update Confluence Release Notes — RELEASE NOTES: DEFERRED UNTIL PRODUCTION
- [ ] T031 [P] Update Confluence Technical Onboarding at `https://mentalhelpglobal.atlassian.net/wiki/spaces/UD/pages/8847361/Technical+Onboarding` — health endpoint docs, retry env vars, rate limit env vars
- [X] T032 Open PR for `D:/src/MHG/chat-backend` to `develop` — https://github.com/MentalHelpGlobal/chat-backend/pull/107
- [X] T033 Open PR for `D:/src/MHG/chat-frontend` to `develop` — https://github.com/MentalHelpGlobal/chat-frontend/pull/58
- ~~T034~~ CANCELLED — workbench-backend repo does not exist locally
- [ ] T035 Delete merged remote/local feature branches and sync local `develop` in all affected repos

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User story phases → Polish
- US1 and US2 can progress in parallel after foundational
- US3 depends on Phase 2 (rate limiter factory) but is independent of US1/US2
- US4 is fully independent of other user stories
- MVP scope: Phases 1–3 (through US1 — DB resilience)

## Parallel Opportunities

- Setup: T002/T003
- Foundational: T006 (rate limiter) can be built while T005 (DB retry) is in progress
- US3: T017/T022 (env vars, i18n) can run alongside T015/T016 (route integration)
- Polish: T025..T031

## Implementation Strategy

1. Deliver P0 DB resilience first (US1) — highest production impact.
2. Deliver P0 session recovery (US2) — prevents 403 loops.
3. Deliver P1 OTP rate limiting (US3) — security hardening.
4. Deliver P2 health endpoints (US4) — operational improvement.
5. Close with regression pass, documentation, and PRs.
