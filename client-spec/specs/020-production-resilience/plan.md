# Implementation Plan: Production Resilience

**Branch**: `020-production-resilience` | **Date**: 2026-03-05 | **Spec**: `specs/020-production-resilience/spec.md`  
**Input**: Feature specification from `specs/020-production-resilience/spec.md`

## Summary

Implement production resilience improvements across `chat-backend` and `chat-frontend`: database connection retry with exponential backoff and jitter, per-IP rate limiting on OTP endpoints with shared Redis counters, frontend automatic 403 recovery with circuit breaker, structured resilience logging, and health/operational endpoints. Changes also touch `workbench-backend` for shared rate limiting middleware.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20, React 18  
**Primary Dependencies**: Express 4, pg-pool, ioredis, Vitest, Vite 5, Zustand 4, react-i18next  
**Storage**: PostgreSQL 15 via Cloud SQL Auth Proxy; Redis (Memorystore) for rate limit counters and token persistence  
**Testing**: Vitest unit/integration in repos, Playwright E2E in `chat-ui`  
**Target Platform**: Web (desktop/mobile responsive), Cloud Run backend (europe-west1)  
**Project Type**: Multi-repository web platform  
**Performance Goals**: Zero increase in p95 latency under normal operation; DB retry total ≤ 10s; inline validation ≤ 200ms  
**Constraints**: Backward compatible; PR-only merge to `develop`; i18n (en, uk, ru); shared Redis namespace across services  
**Scale/Scope**: Cross-repo change touching `chat-backend`, `chat-frontend`, `workbench-backend`; optional `chat-ui` regression

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from feature/bugfix branches
- [x] Required approvals and required CI checks are identified for each target repo
- [x] Post-merge hygiene is defined: delete merged remote/local feature branches and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are defined (breakpoints, installability, and mobile-browser coverage)
- [x] Post-deploy smoke checks are defined for critical routes, deep links, and API endpoints
- [x] Jira Epic exists for this feature with spec content in description; Jira issue key is recorded in spec.md header — [MTB-554](https://mentalhelpglobal.atlassian.net/browse/MTB-554)
- [x] Documentation impact is identified: Release Notes (always), User Manual (if error/loading UX changes are visible), Technical Onboarding (if health endpoint or retry config added to dev setup)
- [x] Release readiness verified: deploy workflows exist in target repos; prod env checks/health checks handled in release cycle per Principle XII

## Phase 0: Research Outcomes

Research consolidated in `specs/020-production-resilience/research.md` with decisions on:
- pg-pool retry strategy (wrapper approach vs library replacement)
- Rate limiting middleware selection and Redis store
- Frontend 403 interceptor pattern
- Structured logging format for resilience events
- Health endpoint implementation pattern

All NEEDS CLARIFICATION items are resolved (none identified in technical context).

## Phase 1: Design Outputs

- `specs/020-production-resilience/data-model.md`
- `specs/020-production-resilience/contracts/api-changes.md`
- `specs/020-production-resilience/quickstart.md`

## Project Structure

### Documentation (this feature)

```text
specs/020-production-resilience/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-changes.md
└── tasks.md
```

### Source Code (affected split repositories)

```text
D:/src/MHG/chat-backend/
├── src/
│   ├── db/
│   │   └── index.ts              # Connection pool retry wrapper
│   ├── middleware/
│   │   └── rateLimiter.ts        # Shared rate limiting middleware
│   ├── routes/
│   │   ├── auth.ts               # OTP rate limit integration + error codes
│   │   ├── chat.ts               # 403 error code enrichment
│   │   └── health.ts             # /healthz, /, /robots.txt
│   └── utils/
│       └── resilience-logger.ts  # Structured log helpers
└── tests/
    └── unit/
        ├── rateLimiter.test.ts
        ├── dbRetry.test.ts
        └── health.test.ts

D:/src/MHG/chat-frontend/
└── src/
    ├── services/
    │   └── api.ts                # 403 interceptor + token refresh retry
    ├── features/chat/
    │   └── components/
    │       └── ChatLoadingSpinner.tsx  # Slow-request spinner
    └── locales/
        ├── en.json               # Rate limit + session expiry messages
        ├── uk.json
        └── ru.json

D:/src/MHG/workbench-backend/
└── src/
    └── middleware/
        └── rateLimiter.ts        # Shared rate limiting (same Redis namespace)
```

**Structure Decision**: Multi-repository architecture. Rate limiting middleware is implemented independently in each backend but shares the same Redis key namespace for cross-service counter consistency. No shared library extraction needed for this scope.

## Implementation Strategy

1. **Backend resilience first**: DB retry wrapper, structured logging helpers, health endpoints.
2. **Rate limiting**: Middleware in `chat-backend`, then replicate to `workbench-backend` with shared Redis keys.
3. **Backend error codes**: Enrich 403 responses with machine-readable `code` field.
4. **Frontend recovery**: 403 interceptor with token refresh, circuit breaker, spinner, 429 countdown UI.
5. **Regression pass**: Validate gate flow, OTP flow, chat messaging under simulated failures.
6. **Delivery**: PRs to `develop` in affected repos with CI evidence and post-merge hygiene.

## Test & Verification Strategy

- **chat-backend**: Vitest for DB retry (mock pg-pool errors), rate limiter (mock Redis), health endpoint, error code enrichment.
- **chat-frontend**: Unit tests for 403 interceptor logic, circuit breaker state machine, 429 countdown timer.
- **workbench-backend**: Vitest for rate limiter middleware integration.
- **chat-ui / manual**: OTP flow with rapid attempts → verify 429 + countdown. Simulate DB outage recovery → verify session continuity or re-auth prompt. Health endpoint smoke.
- **Post-deploy smoke**: `GET /healthz`, `POST /api/auth/otp/verify` (rate limit trigger), `POST /api/chat/message` (403 recovery).

## Repository & PR Plan

- `chat-backend`: DB retry, rate limiting, health endpoints, error codes, structured logging.
- `chat-frontend`: 403 interceptor, circuit breaker, spinner, 429 countdown, i18n.
- `workbench-backend`: Rate limiting middleware (shared Redis namespace).

For each repo:
- Branch from `develop` (feature branch `020-production-resilience`)
- PR back to `develop` with required checks and approvals
- Squash merge, delete remote/local branch, sync local `develop`

## Documentation Impact

Upon production promotion:
- **Release Notes**: Resilience improvements, rate limiting, health endpoint
- **User Manual**: Updated only if error/loading UX is visibly different to users (session expiry prompt, OTP cooldown timer)
- **Technical Onboarding**: Health endpoint documentation, retry config env vars, rate limit config env vars
- **Non-Technical Onboarding**: No changes expected

## Post-Design Constitution Re-Check

All constitution gates **PASS** after design artifacts:
- Spec-first workflow preserved
- Split-repo-first: chat-backend, chat-frontend, workbench-backend explicitly listed
- PR discipline preserved
- Test alignment preserved (Vitest in backends, Vitest in frontend, Playwright in chat-ui)
- Responsive/PWA checks captured (spinner, countdown timer on mobile)
- Smoke-check requirements defined in quickstart.md
- Jira Epic created: [MTB-554](https://mentalhelpglobal.atlassian.net/browse/MTB-554) with plan summary comment

## Complexity Tracking

No constitution violations require exception.
