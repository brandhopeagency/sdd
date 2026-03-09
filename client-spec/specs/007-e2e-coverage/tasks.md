# Tasks: E2E Test Coverage Expansion

**Input**: Design documents from `/specs/007-e2e-coverage/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: This feature IS the test suite. All tasks produce E2E test files.

**Organization**: Tasks grouped by user story. Infrastructure first (chat-ui split repo), then dual-target sync at the end.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Primary implementation**: `chat-ui/tests/e2e/` (split repo at `D:\src\MHG\chat-ui`)
- **Dual-target sync**: `chat-client/tests/e2e/` (monorepo at `D:\src\MHG\chat-client`)
- **Seed data**: `chat-backend/src/db/seeds/` and `chat-client/server/src/db/seeds/`
- **CI workflow**: `chat-client/.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the multi-role auth infrastructure and seed data that all user story tests depend on.

- [x] T001 [P] Create role configuration in chat-ui/tests/e2e/fixtures/roles.ts — export `TEST_ROLES` object mapping 6 role keys (user, qa, researcher, moderator, group_admin, owner) to their `@test.local` emails and role strings; export `TestRole` type as `keyof typeof TEST_ROLES`; see research.md R2 for exact design
- [x] T002 [P] Create seed script in chat-backend/src/db/seeds/seed-e2e-accounts.sql — insert 6 test users (`e2e-user@test.local` through `e2e-owner@test.local`) with correct roles and `status='active'`; create `E2E Test Group`; add group_memberships for owner (admin), group_admin (admin), moderator (member); set `active_group_id` for owner and group_admin; all inserts use `ON CONFLICT DO NOTHING`; see data-model.md for exact SQL
- [x] T003 Enhance auth helper in chat-ui/tests/e2e/helpers/auth.ts — modify `ensureOtpStorageState()` to accept an optional `role` parameter (defaults to 'owner'); generate per-role storage state files at `tests/e2e/.auth/{role}-playwright.json` using the email from `TEST_ROLES[role]`; preserve existing file-locking pattern; import `TEST_ROLES` from `../fixtures/roles`
- [x] T004 Enhance auth fixture in chat-ui/tests/e2e/fixtures/authTest.ts — add a `role` fixture option (type `TestRole`, default `'owner'`); pass the role to `ensureOtpStorageState(role)` for storage state path; import `TestRole` from `./roles`; existing tests continue to work with default owner role

**Checkpoint**: Multi-role auth infrastructure ready; all subsequent test files can use `test.use({ role: 'moderator' })` to switch roles.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Execute seed data and verify multi-role authentication works end-to-end.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Copy seed-e2e-accounts.sql from chat-backend/src/db/seeds/ to chat-client/server/src/db/seeds/seed-e2e-accounts.sql — files must be identical
- [x] T006 Execute seed-e2e-accounts.sql ⚠️ MANUAL — requires `gcloud sql connect` against the dev database — connect to `chat-db-dev` Cloud SQL instance as `chat_user` on `chat_app` database via `gcloud sql connect chat-db-dev --user=chat_user --database=chat_app --project=mental-help-global-25`; run `\i seed-e2e-accounts.sql`; verify with `SELECT email, role, status FROM users WHERE email LIKE 'e2e-%@test.local'` (expect 6 rows)
- [x] T007 Verify multi-role authentication works ⚠️ MANUAL — requires running Playwright against dev env — from chat-ui, run `PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/mhg-chat-client-dev/index.html" PLAYWRIGHT_EMAIL="e2e-owner@test.local" npx playwright test tests/e2e/auth/login-otp.spec.ts` and confirm it passes; repeat with `e2e-user@test.local`; this validates the seed accounts can authenticate via console OTP

**Checkpoint**: Foundation ready — seed accounts exist in dev DB, multi-role auth fixture works. User story implementation can begin.

---

## Phase 3: User Story 1 — Authentication Flow E2E Tests (Priority: P1) 🎯 MVP

**Goal**: Cover the complete auth lifecycle — logout and guest-to-registered upgrade (OTP login, route guards, and OTP validation are already covered by existing tests).

**Independent Test**: Run `npx playwright test tests/e2e/auth/ tests/e2e/chat/guest-chat.spec.ts` and confirm all auth scenarios pass.

### Implementation for User Story 1

- [x] T008 [US1] Create logout test in chat-ui/tests/e2e/auth/logout.spec.ts — import from `../fixtures/authTest`; use `test.use({ role: 'user' })`; test 1: "authenticated user can log out and is redirected to welcome" — navigate to `/#/chat`, find and click logout button, verify URL changes to welcome/login page, verify chat page heading is not visible; test 2: "after logout, protected route /chat redirects to login" — after logout, navigate to `/#/chat`, verify redirect to login; follow existing test patterns (getByRole, regex locators, initLanguage)
- [x] T009 [US1] Enhance guest-to-registered test in chat-ui/tests/e2e/chat/guest-chat.spec.ts — add a third test: "guest: complete registration upgrade preserves session" — start as guest (use e2eTest fixture, not authTest), click "Start Conversation", send a message as guest, verify AI response appears, click register button, complete OTP flow using `loginWithOtp` or inline OTP extraction, verify the chat page loads with the previous conversation visible (at least one message bubble from before registration); use `test.skip()` if guest mode is disabled

**Checkpoint**: Auth lifecycle fully covered — existing login/validation/guards + new logout + guest upgrade = 7 test cases in 5 files.

---

## Phase 4: User Story 2 — Chat Interface E2E Tests (Priority: P1)

**Goal**: Cover AI response validation, feedback submission, and technical details toggle (keyboard shortcuts and session lifecycle already covered by existing tests).

**Independent Test**: Run `npx playwright test tests/e2e/chat/` and confirm all chat scenarios pass.

### Implementation for User Story 2

- [x] T010 [US2] Enhance chat session tests in chat-ui/tests/e2e/chat/chat-session.spec.ts — add test: "chat: sends message and receives AI response" — type a message ("Hello, how are you?"), press Enter, assert that a new message bubble (not the user's) appears within 30 seconds (use `expect(aiResponseLocator).toBeVisible({ timeout: 30_000 })`); do NOT assert specific text content, only that the bubble is non-empty; this test uses default user role auth
- [x] T011 [P] [US2] Create feedback test in chat-ui/tests/e2e/chat/chat-feedback.spec.ts — import from `../fixtures/authTest`; use `test.use({ role: 'user' })`; test 1: "chat: thumbs-up feedback changes visual state" — send a message, wait for AI response, locate the feedback buttons (thumbs up/down) on the AI response, click thumbs-up, verify it changes visual state (e.g., becomes filled/highlighted or gets an active class); test 2: "chat: thumbs-down feedback changes visual state" — same flow but click thumbs-down; no console errors expected (validated by e2eTest fixture automatically)
- [x] T012 [US2] Add technical details test in chat-ui/tests/e2e/chat/chat-session.spec.ts — add test in a separate `test.describe` block with `test.use({ role: 'qa' })`: "chat: QA specialist sees technical details" — login as QA specialist, send a message, wait for AI response, locate and click the gear/debug icon, verify technical details panel shows intent name, confidence score, and response time; use `test.skip()` if gear icon is not visible (permission dependent)

**Checkpoint**: Chat interface fully covered — existing keyboard/session + new AI response/feedback/tech details = 8 test cases in 3 files.

---

## Phase 5: User Story 3 — Workbench E2E Tests (Priority: P2)

**Goal**: Cover role-based section visibility, user list interactions (search, filter, pagination, block/unblock). Shell rendering and settings are already covered.

**Independent Test**: Run `npx playwright test tests/e2e/workbench/workbench-shell.spec.ts tests/e2e/workbench/users.spec.ts` and confirm all workbench navigation and user management scenarios pass.

### Implementation for User Story 3

- [x] T013 [P] [US3] Enhance workbench shell with role-based visibility tests in chat-ui/tests/e2e/workbench/workbench-shell.spec.ts — add test: "workbench: moderator sees Dashboard, Users, Research, Approvals sections" — use `test.use({ role: 'moderator' })`, navigate to `/#/workbench`, verify sidebar contains Dashboard, Users, Research, and Approvals navigation items (moderator has `workbench_user_management` which gates Approvals); add test: "workbench: researcher sees only Research section" — use `test.use({ role: 'researcher' })`, navigate to `/#/workbench`, verify sidebar contains Research but NOT Users or Approvals; add test: "workbench: user without workbench permission is redirected" — use `test.use({ role: 'user' })`, navigate to `/#/workbench`, verify redirect to `/#/chat`
- [x] T014 [US3] Enhance user management tests in chat-ui/tests/e2e/workbench/users.spec.ts — use `test.use({ role: 'moderator' })`; add test: "workbench: user list search filters results" — navigate to `/#/workbench/users`, type "e2e" in search input, wait for debounce (~500ms), verify the table filters to show matching users; add test: "workbench: user list pagination navigates pages" — verify Previous/Next buttons, click Next, verify page changes; add test: "workbench: block/unblock user action changes status" — find a user row, click the block/unblock action button, verify visual status change; use `test.skip()` if insufficient data exists

**Checkpoint**: Workbench covered — existing shell/settings + new role visibility/user interactions = 6 test cases in 3 files.

---

## Phase 6: User Story 4 — Group Management E2E Tests (Priority: P2)

**Goal**: Cover group creation, invite code generation, and group-scoped workbench views (group admin dashboard rendering already partially covered).

**Independent Test**: Run `npx playwright test tests/e2e/groups/ tests/e2e/workbench/group-admin.spec.ts` and confirm all group management scenarios pass.

### Implementation for User Story 4

- [x] T015 [US4] Create group lifecycle tests in chat-ui/tests/e2e/groups/group-lifecycle.spec.ts — import from `../fixtures/authTest`; use `test.use({ role: 'owner' })`; test 1: "groups: owner creates a new group" — navigate to group management, click create group, fill in name (use unique name with timestamp like `E2E-{Date.now()}` to avoid conflicts), submit, verify the group appears in the list; test 2: "groups: generate invite code for group" — select the E2E Test Group, navigate to group settings or invite section, generate an invite code, verify the code is displayed and is a non-empty string; test 3: "groups: membership approval workflow" — this is a multi-step test: (a) as owner, generate an invite code for E2E Test Group, copy the code; (b) open a new browser context (no auth), navigate to login, enter the invite code during OTP flow for `e2e-user@test.local` to create a pending membership request; (c) switch back to owner context, navigate to Approvals (`/#/workbench/approvals`), verify the pending request appears, approve it, verify the user moves to the approved/members list; use `test.skip()` if invite code generation UI is not accessible
- [x] T016 [US4] Enhance group admin tests in chat-ui/tests/e2e/workbench/group-admin.spec.ts — use `test.use({ role: 'group_admin' })`; add test: "workbench: group admin sees group-scoped dashboard with stats" — navigate to group dashboard, verify group name heading, verify key statistics or CTAs are visible; add test: "workbench: group admin can view anonymized sessions list" — navigate to group chats view, verify session list renders, verify session entries show anonymized identifiers (not real names); add test: "workbench: group admin can access group users list" — navigate to group users view, verify table renders with member entries

**Checkpoint**: Group management covered — new lifecycle + enhanced admin = 6 test cases in 2 files.

---

## Phase 7: User Story 5 — Research & Moderation E2E Tests (Priority: P2)

**Goal**: Cover annotation editing, tagging, golden reference editing, and pagination navigation (basic research list rendering and moderation view opening already covered).

**Independent Test**: Run `npx playwright test tests/e2e/workbench/research-and-moderation.spec.ts tests/e2e/workbench/research-annotation.spec.ts` and confirm all moderation scenarios pass.

### Implementation for User Story 5

- [x] T017 [US5] Enhance moderation tests in chat-ui/tests/e2e/workbench/research-and-moderation.spec.ts — use `test.use({ role: 'moderator' })`; add test: "workbench: research list pagination navigates between pages" — navigate to `/#/workbench/research`, verify session count, click Next page button, verify page changes and different sessions are shown; add test: "workbench: moderation annotation can be added and persists" — open a session in moderation view (skip if no sessions), locate annotation panel (third column), add a quality rating and notes text, click Save, reload the page, verify the annotation persists; use `test.skip()` if no sessions available
- [x] T018 [P] [US5] Create annotation and tagging tests in chat-ui/tests/e2e/workbench/research-annotation.spec.ts — import from `../../fixtures/authTest`; use `test.use({ role: 'moderator' })`; test 1: "workbench: session tagging with autocomplete" — open moderation view for a session, locate tag input, type a tag name, verify autocomplete suggestions appear, select a tag, verify it appears on the session; test 2: "workbench: golden reference editing" — in moderation view, locate golden reference column (middle), edit text content, save, verify the edit persists; test 3: "workbench: moderation status transition" — verify current status, change status (e.g., pending → in_review), verify the status updates in the UI; use `test.skip()` for steps depending on specific data

**Checkpoint**: Research & moderation covered — existing list/view + new pagination/annotation/tagging = 6 test cases in 2 files.

---

## Phase 8: User Story 6 — Privacy & GDPR E2E Tests (Priority: P3)

**Goal**: Cover PII masking toggle, data export initiation, and erasure confirmation flow (basic privacy dashboard rendering already covered).

**Independent Test**: Run `npx playwright test tests/e2e/workbench/privacy.spec.ts tests/e2e/workbench/gdpr-operations.spec.ts` and confirm all privacy scenarios pass.

### Implementation for User Story 6

- [x] T019 [US6] Enhance privacy tests in chat-ui/tests/e2e/workbench/privacy.spec.ts — use `test.use({ role: 'owner' })`; add test: "workbench: PII masking toggle obscures names and emails" — navigate to privacy dashboard, find masking toggle (this IS implemented), enable it, navigate to a page showing user data (e.g., user list), verify names/emails are displayed in masked format (e.g., `J*** D***` or `***@***`); add test: "workbench: data export section shows coming soon" — navigate to privacy/export section, verify the "Coming soon" message is displayed (data export is NOT yet implemented); NOTE: PII masking test provides real coverage; combined with existing dashboard-renders test = 2 passing tests for privacy area, satisfying SC-001
- [x] T020 [P] [US6] Create GDPR operations tests in chat-ui/tests/e2e/workbench/gdpr-operations.spec.ts — import from `../../fixtures/authTest`; use `test.use({ role: 'owner' })`; test 1: "workbench: erasure section shows coming soon" — navigate to GDPR/erasure section, verify the "Coming soon" placeholder is displayed (erasure is NOT yet implemented); test 2: "workbench: audit log section shows coming soon" — navigate to audit log section, verify the "Coming soon" placeholder is displayed (audit log is NOT yet implemented); NOTE: These tests validate the placeholder state and will be updated to test real functionality when the features land; both tests WILL pass (they assert the current "Coming soon" state, not skip)

**Checkpoint**: Privacy & GDPR covered — existing dashboard + new masking/export/erasure/audit = 5 test cases in 2 files.

---

## Phase 9: User Story 7 — Review System E2E Tests (Priority: P3)

**Goal**: Cover the entirely untested review system — queue navigation, session review workflow, rating, and dashboard statistics.

**Independent Test**: Run `npx playwright test tests/e2e/review/` and confirm all review scenarios pass.

### Implementation for User Story 7

- [x] T021 [P] [US7] Create review queue tests in chat-ui/tests/e2e/review/review-queue.spec.ts — import from `../../fixtures/authTest`; use `test.use({ role: 'owner' })`; test 1: "review: queue page renders with session list" — navigate to `/#/workbench/review` (or equivalent review queue route), verify queue heading visible, verify sessions are listed (or empty state message); test 2: "review: queue filter and sort controls exist" — verify filter controls (status, date range) and sort options are present; test 3: "review: clicking a session opens review view" — click on a session in the queue, verify the review session view opens with message list; use `test.skip()` if no reviewable sessions exist in the queue
- [x] T022 [US7] Create review session tests in chat-ui/tests/e2e/review/review-session.spec.ts — import from `../../fixtures/authTest`; use `test.use({ role: 'owner' })`; test 1: "review: rate a message with score 1-10" — navigate to a review session, find the score selector for a message, select a score (e.g., 7), verify the score is visually confirmed; test 2: "review: submit completed review" — rate at least one message, click submit review button, verify success confirmation appears; test 3: "review: dashboard shows personal statistics" — navigate to review dashboard, verify personal stats are displayed (e.g., reviews completed, average score); use `test.skip()` if no reviewable sessions exist

**Checkpoint**: Review system covered — new queue + session tests = 6 test cases in 2 files.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: CI integration, dual-target sync, and validation.

- [x] T023 Enhance CI workflow in chat-client/.github/workflows/ui-e2e-dev.yml — add `--workers=1` flag to the playwright test command for explicit serial execution; add `pull_request` trigger targeting `develop` branch (FR-020); add required status check name for merge blocking (FR-022); verify `--retries=1` and `--timeout=90000` remain; verify artifact upload for `test-results/` and `playwright-report/` with 14-day retention
- [x] T024 Sync all new and enhanced test files from chat-ui to chat-client — copy the following from `chat-ui/tests/e2e/` to `chat-client/tests/e2e/`: fixtures/roles.ts (new), fixtures/authTest.ts (enhanced), helpers/auth.ts (enhanced), auth/logout.spec.ts (new), chat/guest-chat.spec.ts (enhanced), chat/chat-session.spec.ts (enhanced), chat/chat-feedback.spec.ts (new), groups/group-lifecycle.spec.ts (new), workbench/group-admin.spec.ts (enhanced), workbench/privacy.spec.ts (enhanced), workbench/gdpr-operations.spec.ts (new), workbench/research-and-moderation.spec.ts (enhanced), workbench/research-annotation.spec.ts (new), workbench/users.spec.ts (enhanced), workbench/workbench-shell.spec.ts (enhanced), review/review-queue.spec.ts (new), review/review-session.spec.ts (new); ensure files are identical
- [x] T025 Run full E2E test suite ⚠️ MANUAL — requires running Playwright against dev env against dev environment — from chat-ui, run `PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/mhg-chat-client-dev/index.html" PLAYWRIGHT_EMAIL="e2e-owner@test.local" npx playwright test --workers=1 --timeout=90000 --retries=1` and verify: all tests pass (or skip with reason); total runtime under 5 minutes; no flaky failures across 2 consecutive runs; capture results as evidence
- [x] T026 Validate quickstart.md ⚠️ MANUAL — requires running documented commands by executing documented commands — run through each section of specs/007-e2e-coverage/quickstart.md: verify prerequisites check, run against deployed dev, run specific test file, run headed mode; confirm all documented commands work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
  - T001 and T002 are parallel (different repos, different files)
  - T003 depends on T001 (imports roles.ts)
  - T004 depends on T001 and T003 (imports TestRole, uses enhanced auth)
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
  - T005 depends on T002 (copies seed script)
  - T006 depends on T005 (executes seed script)
  - T007 depends on T004 and T006 (needs auth fixture + seed data)
- **User Stories (Phases 3–9)**: All depend on Foundational phase completion
  - US1 and US2 are both P1; implement sequentially (US1 first for MVP)
  - US3, US4, US5 are P2; independent of each other, can proceed in parallel
  - US6 and US7 are P3; independent of each other, can proceed in parallel
  - All user stories are independent of each other (no cross-story dependencies)
- **Polish (Phase 10)**: Depends on all user stories being complete
  - T023 (CI) can start as soon as Phase 3 is done (doesn't need all stories)
  - T024 (sync) depends on all story phases complete
  - T025 (full run) depends on T024
  - T026 (quickstart) depends on T025

### User Story Dependencies

- **US1 (Auth, P1)**: Can start after Foundational — No dependencies on other stories
- **US2 (Chat, P1)**: Can start after Foundational — No dependencies on other stories
- **US3 (Workbench, P2)**: Can start after Foundational — No dependencies on other stories
- **US4 (Groups, P2)**: Can start after Foundational — No dependencies on other stories
- **US5 (Research, P2)**: Can start after Foundational — No dependencies on other stories
- **US6 (Privacy, P3)**: Can start after Foundational — No dependencies on other stories
- **US7 (Review, P3)**: Can start after Foundational — No dependencies on other stories

### Within Each User Story

- Enhanced files before new files (if they share patterns)
- Each test file independently runnable after its task completes
- Story complete when all tests in that story's files pass

### Parallel Opportunities

- **Phase 1**: T001 ‖ T002 (different repos, different file types)
- **Phase 3+**: All user stories can theoretically start in parallel after Phase 2
- **Within stories**: Tasks marked [P] can run in parallel (they touch different files)
  - Phase 4: T010 then T012 (same file), but T011 ‖ T010 (different files)
  - Phase 5: T013 ‖ T014 (different files)
  - Phase 7: T017 and T018 touch different files, T018 is [P]
  - Phase 8: T019 and T020 touch different files, T020 is [P]
  - Phase 9: T021 ‖ T022 but T022 depends on review queue navigation pattern from T021

---

## Parallel Example: User Story 2

```bash
# These can run in parallel (different files):
Task: "Enhance chat-session.spec.ts — AI response + tech details" (T010, T012)
Task: "Create chat-feedback.spec.ts — thumbs up/down" (T011)
```

## Parallel Example: User Story 5

```bash
# These can run in parallel (different files):
Task: "Enhance research-and-moderation.spec.ts — pagination + annotation" (T017)
Task: "Create research-annotation.spec.ts — tagging + golden ref" (T018)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (roles.ts, seed script, auth enhancements)
2. Complete Phase 2: Foundational (execute seed, verify auth)
3. Complete Phase 3: User Story 1 (logout + guest upgrade)
4. **STOP and VALIDATE**: Run `npx playwright test tests/e2e/auth/` — all 7 auth tests pass
5. This alone brings auth coverage from partial to complete

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 (Auth) → Test independently → 7 auth test cases passing
3. Add US2 (Chat) → Test independently → 8 chat test cases passing
4. Add US3–US5 (Workbench + Groups + Research) → Test independently → 18 more cases
5. Add US6–US7 (Privacy + Review) → Test independently → 11 more cases
6. Polish: CI + dual-target sync → Full suite green, CI blocks PR on failure

### Single Developer Strategy

1. Complete Setup + Foundational
2. Work through stories in priority order: US1 → US2 → US3 → US4 → US5 → US6 → US7
3. Each story is independently testable after completion
4. Polish phase at the end

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 26 |
| **Setup tasks** | 4 (T001–T004) |
| **Foundational tasks** | 3 (T005–T007) |
| **US1 (Auth) tasks** | 2 (T008–T009) |
| **US2 (Chat) tasks** | 3 (T010–T012) |
| **US3 (Workbench) tasks** | 2 (T013–T014) |
| **US4 (Groups) tasks** | 2 (T015–T016) |
| **US5 (Research) tasks** | 2 (T017–T018) |
| **US6 (Privacy) tasks** | 2 (T019–T020) |
| **US7 (Review) tasks** | 2 (T021–T022) |
| **Polish tasks** | 4 (T023–T026) |
| **Parallel opportunities** | 8 tasks marked [P] |
| **New test files** | 7 |
| **Enhanced test files** | 8 |
| **New infrastructure files** | 3 (roles.ts, seed SQL ×2) |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All tests follow existing patterns: `getByRole()`, `getByPlaceholder()`, regex locators, `test.skip()` for missing preconditions
- All tests import from `../fixtures/authTest` (authenticated) or `../fixtures/e2eTest` (unauthenticated)
- AI response tests assert non-empty bubble only — no text content matching
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
