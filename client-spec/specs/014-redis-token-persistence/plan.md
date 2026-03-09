# Implementation Plan: Shared Redis Token Persistence

**Branch**: `014-redis-token-persistence` | **Date**: 2026-02-22 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/014-redis-token-persistence/spec.md`

## Summary

Migrate refresh token storage from PostgreSQL (`refresh_tokens` table) to a shared Redis instance (GCP Memorystore) so that tokens are persisted across all backend instances with sub-millisecond lookups, native TTL-based expiration, and reduced database load. The auth API surface remains unchanged; this is a backend-internal storage layer change.

## Technical Context

**Language/Version**: TypeScript / Node.js (Express.js 5.1.0)  
**Primary Dependencies**: `ioredis` (new), `jsonwebtoken` v9.0.2, `bcrypt` v5.1.1 (removed for token lookups)  
**Storage**: GCP Memorystore for Redis (Basic tier, 1 GB) — replacing PostgreSQL `refresh_tokens` table  
**Testing**: Vitest (chat-backend unit tests)  
**Target Platform**: GCP Cloud Run (`europe-west1`)  
**Project Type**: Web application (backend API)  
**Performance Goals**: Token refresh < 500ms end-to-end; Redis operations < 10ms  
**Constraints**: Memorystore requires VPC connectivity; Cloud Run needs Serverless VPC Access connector  
**Scale/Scope**: Low token volume (~hundreds of concurrent refresh tokens); Basic tier sufficient

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from
      feature/bugfix branches
- [x] Required approvals and required CI checks are identified for each target repo
- [x] Post-merge hygiene is defined: delete merged remote/local feature branches
      and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are
      defined (breakpoints, installability, and mobile-browser coverage)
      — N/A: backend-only change, no UI impact
- [x] Post-deploy smoke checks are defined for critical routes, deep links,
      and API endpoints
- [x] Jira Epic exists for this feature with spec content in description;
      Jira issue key is recorded in spec.md header
      — [MTB-352](https://mentalhelpglobal.atlassian.net/browse/MTB-352)
- [x] Documentation impact is identified: which Confluence doc types
      (User Manual, Technical Onboarding, Release Notes, Non-Technical
      Onboarding) require updates upon production deployment
      — Technical Onboarding (new Redis dependency), Release Notes (always)

## Project Structure

### Documentation (this feature)

```text
specs/014-redis-token-persistence/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Redis data model
├── quickstart.md        # Phase 1: Setup guide
└── tasks.md             # Phase 2: Task breakdown (created by /speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-backend/                          # Primary — token storage refactoring
├── src/
│   ├── services/
│   │   ├── auth.service.ts            # MODIFY: Replace PostgreSQL token ops with Redis
│   │   └── redis.service.ts           # NEW: Redis client wrapper with health/reconnect
│   ├── routes/
│   │   └── auth.ts                    # MINOR: No route changes (storage is transparent)
│   ├── types/
│   │   └── index.ts                   # MODIFY: Add Redis-related types if needed
│   └── db/
│       └── schema.sql                 # MODIFY: Remove refresh_tokens table (post-migration)
├── docker-compose.yml                 # NEW: Local Redis for development
├── env.sample                         # MODIFY: Add REDIS_HOST, REDIS_PORT
├── package.json                       # MODIFY: Add ioredis dependency
└── tests/
    └── unit/
        └── redis.service.test.ts      # NEW: Redis service unit tests

chat-infra/                            # Infrastructure — Redis provisioning
├── scripts/
│   └── setup-redis.sh                 # NEW: Memorystore + VPC connector setup
├── terraform/
│   └── modules/
│       └── memorystore/               # NEW: Terraform module (optional, per infra conventions)
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
└── config/
    └── secrets.json.example           # MODIFY: Add Redis connection details
```

**Structure Decision**: Backend-internal change spanning `chat-backend` (application code) and `chat-infra` (infrastructure provisioning). No changes to `chat-frontend`, `chat-ui`, `chat-types`, or `chat-ci`. The auth API surface is unchanged.

## Affected Repositories

| Repository | Scope | Changes |
|-----------|-------|---------|
| `chat-backend` | Primary | New Redis service, refactor auth.service.ts token operations, add ioredis dependency, docker-compose for local dev |
| `chat-infra` | Infrastructure | Memorystore provisioning script, VPC connector setup, Secret Manager entries |
| `chat-frontend` | None | No changes — auth API unchanged |
| `chat-ui` | Verification only | Run existing E2E auth tests to verify no regression |
| `chat-types` | None | No changes — token types are internal to chat-backend |
| `chat-ci` | None | No workflow changes needed |

## Integration Strategy

### Branch Policy

- Feature branch `014-redis-token-persistence` created in `chat-backend` and `chat-infra`
- PRs to `develop` in each repository with required approvals
- Squash merge for clean history
- Post-merge: delete remote/local branches, sync local `develop`

### Deployment Order

1. **chat-infra**: Provision Memorystore + VPC connector (must be ready before backend deploys)
2. **chat-backend**: Deploy with Redis token store (new tokens → Redis; old tokens expire naturally in PostgreSQL)
3. **Verification**: Run E2E auth tests in `chat-ui`
4. **Cleanup (7 days post-deploy)**: Remove `refresh_tokens` PostgreSQL table and cleanup function

### Post-Deploy Smoke Checks

- `/api/auth/otp/send` — OTP delivery works
- `/api/auth/otp/verify` — Authentication issues tokens stored in Redis
- `/api/auth/refresh` — Token refresh reads from Redis
- `/api/auth/logout` — Token revocation removes from Redis
- `/api/auth/me` — Authenticated requests succeed with Redis-backed tokens
- Health endpoint reports Redis connectivity status

## Test Strategy

| Repository | Test Type | Scope |
|-----------|-----------|-------|
| `chat-backend` | Unit (Vitest) | Redis service: connection, set/get/del, TTL, reconnection, timeout handling |
| `chat-backend` | Unit (Vitest) | Auth service: token creation → Redis, refresh → Redis lookup, revocation → Redis delete |
| `chat-ui` | E2E (Playwright) | Login flow, token refresh, logout — verify no regression |

## Documentation Impact

| Doc Type | Update Required | Reason |
|----------|----------------|--------|
| Technical Onboarding | Yes | New Redis dependency; local dev setup (Docker Compose); Memorystore architecture |
| Release Notes | Yes | Always required for production deployments |
| User Manual | No | No UI changes |
| Non-Technical Onboarding | No | No workflow changes visible to non-technical users |

## Complexity Tracking

> No constitution violations. All principles are satisfied.

| Aspect | Assessment |
|--------|-----------|
| Responsive/PWA | N/A — backend-only change |
| User-facing UI | N/A — no UI changes |
| Cross-repo coordination | Low — two repos (chat-backend, chat-infra), sequential deployment |
| Migration risk | Low — one-time re-auth for existing sessions within 7-day window |
