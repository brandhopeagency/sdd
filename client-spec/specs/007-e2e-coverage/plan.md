# Implementation Plan: E2E Test Coverage Expansion

**Branch**: `007-e2e-coverage` | **Date**: 2026-02-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-e2e-coverage/spec.md`

## Summary

Expand Playwright E2E test coverage from the current 13 test files (~20 test cases covering basic rendering and auth) to 20+ test files (~45 test cases) across all 7 feature areas. New tests cover workflow interactions, role-based access, and the entirely untested review system. Tests run serially (1 Playwright worker) in CI within a 5-minute budget, using pre-seeded test accounts with console OTP authentication. Implementation targets both `chat-ui` (split repo) and `chat-client/tests/e2e/` (monorepo) per Dual-Target Discipline.

## Technical Context

**Language/Version**: TypeScript 5.x (Playwright test files)
**Primary Dependencies**: `@playwright/test ^1.57.0`
**Storage**: N/A — tests consume existing PostgreSQL via the deployed dev environment
**Testing**: Playwright (Chromium-only, headless in CI, headed for local debug)
**Target Platform**: CI (GitHub Actions, headless) + local developer machines (headed)
**Project Type**: Web application — dual-target (`chat-ui` + `chat-client`)
**Performance Goals**: Full suite under 5 minutes in CI (serial execution, 1 worker)
**Constraints**: Serial execution (no parallel workers), pre-seeded fixed test accounts, console OTP provider, deployed dev environment dependency
**Scale/Scope**: 20 test files, 7 feature areas, ~45 test cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First Development | ✅ PASS | `specs/007-e2e-coverage/spec.md` created and clarified |
| II. Multi-Repository Orchestration | ✅ PASS | Plan targets `chat-ui`, `chat-client`, plus seeding in `chat-backend`/`chat-client/server` |
| III. Test-Aligned Development | ✅ PASS | Uses existing Playwright infrastructure in `chat-ui` and `chat-client` |
| IV. Branch and Integration Discipline | ✅ PASS | Feature branch `007-e2e-coverage` in all affected repos; squash merge to `develop` |
| V. Privacy and Security First | ✅ PASS | OTP codes sanitized in logs (existing fixture); test accounts use `@test.local` domain; no real user data |
| VI. Accessibility and i18n | N/A | Tests don't add UI — they verify existing UI. Accessibility tests are a separate spec (006) |
| VII. Dual-Target Implementation | ✅ PASS | All test files created in both `chat-ui/tests/e2e/` and `chat-client/tests/e2e/` |
| VIII. GCP CLI Infrastructure | N/A | No infrastructure changes — tests run against existing dev environment |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-e2e-coverage/
├── plan.md              # This file
├── research.md          # Phase 0: seed strategy, multi-role auth, CI, review patterns
├── data-model.md        # Phase 1: test accounts schema, seed data, test group
├── quickstart.md        # Phase 1: how to run, write, and debug E2E tests
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Split repo: chat-ui (D:\src\MHG\chat-ui)
tests/e2e/
├── auth/
│   ├── login-otp.spec.ts                   # EXISTING — no changes needed
│   ├── otp-validation.spec.ts              # EXISTING — no changes needed
│   ├── route-guards.spec.ts                # EXISTING — no changes needed
│   ├── route-guards-authenticated.spec.ts  # EXISTING — no changes needed
│   └── logout.spec.ts                      # NEW — logout flow + session cleanup
├── chat/
│   ├── chat-session.spec.ts                # ENHANCE — add AI response + tech details tests
│   ├── guest-chat.spec.ts                  # ENHANCE — add guest-to-registered upgrade test
│   └── chat-feedback.spec.ts               # NEW — thumbs up/down feedback submission
├── fixtures/
│   ├── authTest.ts                         # ENHANCE — multi-role auth fixture
│   ├── e2eTest.ts                          # EXISTING — no changes needed
│   └── roles.ts                            # NEW — role-based test account configs
├── helpers/
│   ├── auth.ts                             # ENHANCE — support role-specific login
│   ├── authState.ts                        # EXISTING — no changes needed
│   ├── i18n.ts                             # EXISTING — no changes needed
│   └── routes.ts                           # EXISTING — no changes needed
├── groups/
│   └── group-lifecycle.spec.ts             # NEW — create group, invite code, join, approve
├── review/
│   ├── review-queue.spec.ts                # NEW — queue navigation, session assignment
│   └── review-session.spec.ts              # NEW — rating, criteria feedback, submit review
├── workbench/
│   ├── group-admin.spec.ts                 # ENHANCE — deeper group dashboard workflow tests
│   ├── privacy.spec.ts                     # ENHANCE — PII masking toggle, export request
│   ├── gdpr-operations.spec.ts             # NEW — erasure confirmation, audit verification
│   ├── research-and-moderation.spec.ts     # ENHANCE — annotation editing, save + reload
│   ├── research-annotation.spec.ts         # NEW — tagging, golden ref editing, status transitions
│   ├── settings.spec.ts                    # EXISTING — no changes needed
│   ├── users.spec.ts                       # ENHANCE — search, filter, pagination, block/unblock
│   └── workbench-shell.spec.ts             # ENHANCE — role-based section visibility
└── smoke.spec.ts                           # EXISTING — no changes needed

# Monorepo: chat-client (D:\src\MHG\chat-client)
# Identical test structure at chat-client/tests/e2e/

# Seed data (one-time setup scripts)
chat-backend/src/db/seeds/                  # Split repo
  └── seed-e2e-accounts.sql                 # NEW — test user accounts + test group
chat-client/server/src/db/seeds/            # Monorepo
  └── seed-e2e-accounts.sql                 # NEW — identical seed script

# CI workflow
chat-client/.github/workflows/ui-e2e-dev.yml  # ENHANCE — set workers=1, add artifact upload
```

**Structure Decision**: Tests live in `tests/e2e/` following the established directory pattern. New test directories (`groups/`, `review/`) are added at the same level as existing `auth/`, `chat/`, `workbench/`. Both `chat-ui` and `chat-client` receive identical test files. Seed data scripts are placed in a new `seeds/` directory alongside existing `migrations/`.

### Coverage Map (7 feature areas → files)

| Feature Area | Files | Test Cases | Priority |
|-------------|-------|------------|----------|
| 1. Authentication | `auth/login-otp`, `auth/otp-validation`, `auth/route-guards`, `auth/route-guards-authenticated`, `auth/logout` | 7 | P1 |
| 2. Chat Interface | `chat/chat-session`, `chat/guest-chat`, `chat/chat-feedback` | 8 | P1 |
| 3. Workbench | `workbench/workbench-shell`, `workbench/users`, `workbench/settings` | 6 | P2 |
| 4. Group Management | `groups/group-lifecycle`, `workbench/group-admin` | 6 | P2 |
| 5. Research & Moderation | `workbench/research-and-moderation`, `workbench/research-annotation` | 6 | P2 |
| 6. Privacy & GDPR | `workbench/privacy`, `workbench/gdpr-operations` | 5 | P3 |
| 7. Review System | `review/review-queue`, `review/review-session` | 6 | P3 |
| **Total** | **20 files** | **~44 cases** | |

## Gap Analysis

### Currently Covered (13 files, ~20 test cases)

- OTP login flow (email → console code → chat landing)
- OTP validation (invalid email, invalid code)
- Route guards (unauthenticated redirect)
- Permission-based redirect (no Workbench permission)
- Chat message send via Enter/Shift+Enter
- Chat session lifecycle (new session, end chat)
- Guest entry (start conversation, register popup)
- Workbench shell rendering + back-to-chat
- User list rendering + create user modal
- Settings page rendering
- Group admin dashboard/users/chats rendering
- Privacy dashboard rendering
- Research list rendering + moderation view opening
- Smoke test (welcome page)

### Missing Coverage (to be added)

**P1 — Critical Path:**
- Logout flow + session cleanup + protected route verification
- AI response validation (non-empty bubble appears within timeout)
- Chat feedback submission (thumbs up/down with visual state change)
- Technical details toggle (QA+ role: intent/confidence/response time)
- Guest-to-registered upgrade with session preservation

**P2 — Workflow Interactions:**
- Workbench role-based section visibility (different sidebar items per role)
- User list search, filtering, pagination
- User block/unblock actions
- Group creation, invite code generation, invite code usage
- Membership request + approval workflow
- Moderation annotation editing (quality rating, notes) + save + reload persistence
- Session tagging with autocomplete
- Golden reference editing
- Moderation status transitions (pending → in_review → moderated)

**P3 — New Areas:**
- PII masking toggle (enable/disable + visual verification)
- Data export request initiation
- Erasure confirmation dialog flow
- Review queue navigation + session listing
- Session review workflow (rating 1-10, criteria feedback)
- Review submission + queue state change
- Review dashboard statistics display

## Implementation Phases

### Phase 0: Research & Infrastructure (research.md)

1. Test data seeding strategy — SQL script design, execution approach
2. Multi-role authentication — extending authTest fixture for role-specific logins
3. CI workflow — serial execution config, artifact handling
4. Review system test approach — queue interaction patterns, rating UI
5. Flaky test mitigation — retry strategy, timeout tuning

### Phase 1: Design & Test Infrastructure (data-model.md, quickstart.md)

1. Test account schema — roles, permissions, group membership
2. Seed SQL script — idempotent, runnable against dev database
3. Role fixture — `roles.ts` config for all test accounts
4. Enhanced auth helpers — `loginAs(role)` pattern
5. Quickstart guide — running, writing, debugging tests

### Phase 2: Test Implementation (tasks.md — generated by /speckit.tasks)

Execution order follows priority:
1. **Infrastructure** — seed script, role fixtures, auth helper enhancements
2. **P1 tests** — auth (logout), chat (feedback, AI response, tech details, guest upgrade)
3. **P2 tests** — workbench (role visibility, user actions), groups (lifecycle), research (annotations, tagging)
4. **P3 tests** — privacy (masking, GDPR ops), review (queue, session, submit)
5. **CI integration** — workflow update, PR merge blocking
6. **Dual-target sync** — copy all new/enhanced files to monorepo

## Cross-Repository Dependencies

| Repository | Changes | Depends On |
|-----------|---------|------------|
| `chat-backend` | `seeds/seed-e2e-accounts.sql` | None — standalone seed script |
| `chat-ui` | New + enhanced test files, fixtures, helpers | Seed script executed against dev DB |
| `chat-client` | Identical test files + seed script in `server/src/db/seeds/` | Seed script executed against dev DB |
| `chat-client/.github/workflows/` | `ui-e2e-dev.yml` enhancements | Test files committed |

**Execution order**: Seed → Tests → CI workflow

## Complexity Tracking

No constitution violations to justify.
