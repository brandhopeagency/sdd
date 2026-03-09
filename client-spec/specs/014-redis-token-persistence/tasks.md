# Tasks: Shared Redis Token Persistence

**Input**: Design documents from `/specs/014-redis-token-persistence/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md  
**Jira Epic**: [MTB-352](https://mentalhelpglobal.atlassian.net/browse/MTB-352)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, provision Redis infrastructure, and configure local development environment

- [x] T001 Install ioredis dependency in chat-backend/package.json — MTB-356
- [x] T002 [P] Create docker-compose.yml with Redis 7 service for local development in chat-backend/docker-compose.yml — MTB-357
- [x] T003 [P] Add REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS, REDIS_CONNECT_TIMEOUT, and REDIS_COMMAND_TIMEOUT environment variables to chat-backend/env.sample — MTB-358
- [x] T004 [P] Create GCP Memorystore for Redis (Basic tier, 1 GB, europe-west1) and Serverless VPC Access connector provisioning script in chat-infra/scripts/setup-redis.sh — MTB-359
- [x] T005 [P] Add Redis connection entries (redis-host, redis-port) to secrets configuration example in chat-infra/config/secrets.json.example — MTB-360

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Redis client service that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create RedisService with ioredis connection management, typed command wrappers (get, set with EX, del, multi/exec, sadd, srem, smembers), and environment-based configuration parsing in chat-backend/src/services/redis.service.ts — MTB-361
- [x] T007 Initialize RedisService on application startup and register graceful shutdown (disconnect) hook in chat-backend/src/index.ts — MTB-362

**Checkpoint**: Redis client connected and ready — user story implementation can begin

---

## Phase 3: User Story 1 — Seamless Session Continuity Across Backend Instances (Priority: P1) MVP — [MTB-353](https://mentalhelpglobal.atlassian.net/browse/MTB-353)

**Goal**: Migrate all refresh token persistence from PostgreSQL to Redis so any backend instance can validate any token

**Independent Test**: Authenticate a user, verify the refresh token is stored in Redis (not PostgreSQL), then confirm token refresh and revocation work correctly against the Redis store

### Implementation for User Story 1

- [x] T008 [US1] Refactor token issuance in chat-backend/src/services/auth.service.ts — replace PostgreSQL INSERT into refresh_tokens with Redis SET using SHA-256 key derivation (refresh:<sha256(tokenId)> → JSON payload with userId/issuedAt/expiresAt) and TTL matching JWT_REFRESH_EXPIRES_IN, add SADD to user:<userId>:tokens index — MTB-363
- [x] T009 [US1] Refactor token validation and rotation in chat-backend/src/services/auth.service.ts — replace PostgreSQL SELECT + bcrypt compare with Redis GET by SHA-256 hash, implement atomic token rotation via Redis MULTI/EXEC pipeline (DEL old + SREM old + SET new + SADD new) — MTB-364
- [x] T010 [US1] Refactor token revocation in chat-backend/src/services/auth.service.ts — replace PostgreSQL DELETE with Redis DEL + SREM for single-token logout, replace DELETE WHERE user_id query with SMEMBERS + pipeline DEL + DEL set for revoke-all-user-tokens — MTB-365
- [x] T011 [US1] Remove PostgreSQL refresh_tokens query imports, bcrypt usage for token operations, and cleanup_expired_refresh_tokens references from chat-backend/src/services/auth.service.ts — MTB-366

**Checkpoint**: Token issuance, validation, rotation, and revocation all operate via Redis. Any backend instance can validate any token. Auth routes unchanged.

---

## Phase 4: User Story 2 — Session Survival Across Backend Deployments (Priority: P2) — [MTB-354](https://mentalhelpglobal.atlassian.net/browse/MTB-354)

**Goal**: Ensure Cloud Run deployments (rolling updates, full restarts) do not disrupt user sessions because tokens persist in external Redis

**Independent Test**: Authenticate a user, trigger a Cloud Run redeployment, then verify the user can still refresh their access token without re-authenticating

### Implementation for User Story 2

- [x] T012 [US2] Update Cloud Run service deployment configuration to attach Serverless VPC Access connector and inject REDIS_HOST/REDIS_PORT environment variables from Secret Manager — update deploy script or workflow references in chat-infra/scripts/setup-redis.sh — MTB-367
- [x] T013 [US2] Add environment-aware Redis configuration (dev: localhost fallback, prod: Memorystore via VPC) with startup connection verification log in chat-backend/src/services/redis.service.ts — MTB-368

**Checkpoint**: Cloud Run instances connect to Memorystore via VPC connector. Deployments preserve all active user sessions.

---

## Phase 5: User Story 3 — Graceful Degradation on Storage Unavailability (Priority: P3) — [MTB-355](https://mentalhelpglobal.atlassian.net/browse/MTB-355)

**Goal**: When Redis is temporarily unavailable, auth operations fail safely with clear errors and recover automatically when connectivity is restored

**Independent Test**: Simulate Redis unavailability (stop container or block network), verify auth endpoints return structured error responses (not 500 crashes), then restore Redis and verify automatic recovery without restart

### Implementation for User Story 3

- [x] T014 [US3] Add connection error handling, auto-reconnect event listeners (connect, error, close, reconnecting events), and configurable timeouts (connectTimeout: 2000ms, commandTimeout: 1000ms, maxRetriesPerRequest: 3) to RedisService in chat-backend/src/services/redis.service.ts — MTB-369
- [x] T015 [US3] Implement fail-closed error responses in auth token operations — catch Redis errors in issue/validate/revoke and return HTTP 503 with structured error body instead of unhandled exceptions in chat-backend/src/services/auth.service.ts — MTB-370
- [x] T016 [P] [US3] Add Redis connectivity status (connected/disconnected/reconnecting) to health check endpoint in chat-backend/src/routes/ (existing health route or new /api/health endpoint) — MTB-371

**Checkpoint**: Redis outages produce clear 503 errors. Recovery is automatic. Health endpoint reports Redis status.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification, cleanup, and delivery

- [x] T017 [P] Update Confluence Technical Onboarding with Redis dependency documentation — Memorystore architecture, Docker Compose local setup, environment variables, and VPC connector overview — MTB-372
- [x] T018 [P] Update Confluence Release Notes with production release entry for shared token persistence (version, date, change summary, migration note about one-time re-authentication) — MTB-373
- [x] T019 Plan PostgreSQL refresh_tokens table removal — document follow-up task for 7 days post-deployment to execute DROP TABLE refresh_tokens, DROP FUNCTION cleanup_expired_refresh_tokens, and drop associated indexes in chat-backend/src/db/schema.sql — MTB-374
- [x] T020 Add completion summary comment to Jira Epic MTB-352 with evidence references and outcome — MTB-375
- [x] T021 Open PR(s) from 014-redis-token-persistence branch(es) to develop in chat-backend and chat-infra, obtain required reviews, and merge only after all required checks pass — MTB-375
- [x] T022 Verify unit and E2E test gates passed for merged PR(s) — run existing auth E2E tests in chat-ui to confirm no regression — MTB-375
- [x] T023 Capture post-deploy smoke evidence for auth routes: /api/auth/otp/send, /api/auth/otp/verify, /api/auth/refresh, /api/auth/logout, /api/auth/me, and health endpoint Redis status — MTB-375
- [x] T024 Delete merged remote and local 014-redis-token-persistence branches in chat-backend and chat-infra — MTB-375
- [x] T025 Sync local develop to origin/develop in chat-backend and chat-infra — MTB-375

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (ioredis installed) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion (T006, T007) — MVP delivery
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — deployment configuration builds on working Redis token store
- **US3 (Phase 5)**: Depends on Phase 2 (T006) — can run in parallel with US1/US2 for T014/T016, but T015 depends on US1 (T008-T011)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P2)**: Depends on US1 for verification — infra tasks (T012) can start after Setup
- **US3 (P3)**: RedisService enhancements (T014, T016) can start after Phase 2; auth error handling (T015) depends on US1 completion

### Within Each User Story

- T008 → T009 → T010 → T011 (sequential: same file, auth.service.ts)
- T012 and T013 are independent (different repos/files)
- T014 and T016 can run in parallel; T015 depends on US1

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 can all run in parallel (after T001)
- Phase 2: T006 then T007 (sequential)
- US3: T014 and T016 can run in parallel
- Polish: T017, T018 can run in parallel

---

## Parallel Example: Phase 1 Setup

```text
# After T001 (npm install), launch in parallel:
Task T002: "Create docker-compose.yml" in chat-backend/
Task T003: "Update env.sample" in chat-backend/
Task T004: "Create setup-redis.sh" in chat-infra/
Task T005: "Update secrets.json.example" in chat-infra/
```

## Parallel Example: User Story 3

```text
# After Phase 2 foundational is complete, launch in parallel:
Task T014: "Add error handling and timeouts to RedisService" in redis.service.ts
Task T016: "Add Redis status to health endpoint" in routes/

# Then after US1 complete:
Task T015: "Implement fail-closed auth error responses" in auth.service.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (infra + dependencies)
2. Complete Phase 2: Foundational (RedisService)
3. Complete Phase 3: User Story 1 (token migration)
4. **STOP and VALIDATE**: Authenticate, refresh, logout — verify tokens in Redis
5. Deploy to dev and verify

### Incremental Delivery

1. Setup + Foundational → Redis client ready
2. Add US1 → Test token persistence → Deploy/Demo (MVP!)
3. Add US2 → Verify deployment survival → Configure production
4. Add US3 → Test graceful degradation → Production-ready
5. Polish → Documentation, PRs, cleanup

### Migration Timeline

1. **Day 0**: Deploy Redis infra (Memorystore + VPC connector)
2. **Day 0**: Deploy backend with Redis token store (new tokens → Redis)
3. **Day 1-7**: Existing PostgreSQL tokens naturally expire (users re-authenticate once)
4. **Day 7+**: Remove PostgreSQL refresh_tokens table and cleanup function

---

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done immediately when the corresponding task is marked `[X]` — do NOT batch transitions at the end. Stories are transitioned when all their tasks are complete.
- **No API contract changes**: Auth routes (/api/auth/*) remain unchanged — this is a storage-layer migration only
- **No frontend changes**: chat-frontend and chat-types are unaffected
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Sequential auth.service.ts tasks (T008→T009→T010→T011) cannot be parallelized
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never merge directly into develop; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local develop
