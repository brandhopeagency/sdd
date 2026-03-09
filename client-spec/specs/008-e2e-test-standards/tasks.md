# Tasks: E2E Test Standards & Conventions

**Input**: Design documents from `specs/008-e2e-test-standards/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. No test tasks included.

**Organization**: Tasks grouped by user story in priority order. US3 (Locator Specificity), US4 (PII Masking), and US8 (Direct Navigation) are convention-only rules already implemented during the recent fix cycle — they are codified in the quickstart guide (US2 phase) rather than requiring new code.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo (primary)**: `chat-client/` at `D:\src\MHG\chat-client`
- **Split frontend**: `chat-frontend/` at `D:\src\MHG\chat-frontend`
- **Split E2E**: `chat-ui/` at `D:\src\MHG\chat-ui`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and create directory structure needed by multiple user stories

- [x] T001 Add `pg` and `@types/pg` as devDependencies in chat-client/package.json and run npm install
- [x] T002 [P] Create directory chat-client/eslint-rules/ for custom ESLint rules
- [x] T003 [P] Create directory chat-client/src/vite-plugins/ for build-time plugins
- [x] T004 [P] Create directory chat-client/scripts/ for CI utility scripts (if not exists)

**Checkpoint**: Directory structure and dependencies ready for user story implementation

---

## Phase 2: User Story 1 — i18n Namespace Discipline (Priority: P1) MVP

**Goal**: Enforce that components in feature directories use the correct i18n namespace, and that all locale files have matching key structures.

**Independent Test**: Run `npm run lint` — the ESLint rule reports violations for any `useTranslation()` call missing the required namespace. Run `npm run lint:locales` — the script reports missing keys or namespace files across en/uk/ru.

### Implementation for User Story 1

- [x] T005 [US1] Create custom ESLint rule in chat-client/eslint-rules/enforce-i18n-namespace.js that checks `useTranslation()` calls within feature directories (see contracts/eslint-rule-schema.json for options schema). Rule reads file path to determine expected namespace from the `namespaceMap` option, reports error if first argument to `useTranslation()` does not match. Files outside mapped directories are ignored.
- [x] T006 [US1] Register the enforce-i18n-namespace rule in chat-client/eslint.config.js — import from `./eslint-rules/enforce-i18n-namespace.js`, add as `'local/enforce-i18n-namespace': 'error'` with namespaceMap option `{ "src/features/workbench/review": "review" }` scoped to `**/*.{ts,tsx}` files.
- [x] T007 [P] [US1] Create locale key completeness script in chat-client/scripts/check-locale-keys.ts — loads en.json, uk.json, ru.json; recursively extracts all keys; diffs key sets between locales; checks namespace files under locales/en/ have matching files under locales/uk/ and locales/ru/ (warn only); exits non-zero with specific missing key paths on failure.
- [x] T008 [US1] Add `"lint:locales": "npx tsx scripts/check-locale-keys.ts"` script to chat-client/package.json scripts section.
- [x] T009 [US1] Verify enforcement by running `npm run lint` in chat-client/ — confirm no false positives on existing code (all 17 review components already use `useTranslation('review')`). Run `npm run lint:locales` — confirm all locale files pass.

**Checkpoint**: i18n namespace enforcement is active in chat-client. `npm run lint` catches namespace mismatches; `npm run lint:locales` catches missing locale keys.

---

## Phase 3: User Story 5 — Build-Time Env Var Enforcement (Priority: P1)

**Goal**: Prevent frontend builds for deployed environments from silently falling back to localhost API URL.

**Independent Test**: Run `npm run build` without setting `VITE_API_URL` — build must fail with a descriptive error. Run `VITE_API_URL=https://example.com npm run build` — build must succeed. Run `npm run dev` without `VITE_API_URL` — dev server must start normally (localhost fallback OK).

### Implementation for User Story 5

- [x] T010 [US5] Create Vite env check plugin in chat-client/src/vite-plugins/env-check.ts — export `envCheck()` function returning a Vite Plugin object. In `configResolved` hook: if `config.command === 'build'` and `config.mode !== 'development'`, check `process.env.VITE_API_URL` is set and does not contain `localhost` or `127.0.0.1`; throw descriptive error if validation fails (see contracts/vite-env-check-contract.md for error format).
- [x] T011 [US5] Register envCheck plugin in chat-client/vite.config.ts — import `envCheck` from `./src/vite-plugins/env-check` and add to plugins array after `react()`.
- [x] T012 [US5] Verify enforcement by running `npm run build` in chat-client/ without `VITE_API_URL` set — confirm build fails. Then set `VITE_API_URL=https://example.com` and confirm build succeeds. Confirm `npm run dev` still works without the variable.

**Checkpoint**: Non-development builds fail fast when VITE_API_URL is missing or localhost. Local dev is unaffected.

---

## Phase 4: User Story 2 + US3 + US4 + US8 — RBAC Reference & Convention Documentation (Priority: P1/P2/P3)

**Goal**: Provide test authors with an in-code permission reference and codify locator, PII masking, and navigation conventions in discoverable documentation.

**Independent Test**: Import `ROLE_WORKBENCH_PERMISSIONS` from `tests/e2e/helpers/permissions.ts` — TypeScript compiles and IDE shows JSDoc with the full permission matrix.

### Implementation for User Story 2 (and consolidated US3, US4, US8)

- [x] T013 [US2] Create permission reference helper in chat-client/tests/e2e/helpers/permissions.ts — export `ROLE_WORKBENCH_PERMISSIONS` as `Record<TestRole, string[]>` mapping each role from `fixtures/roles.ts` to its workbench permissions. Include comprehensive JSDoc comment block with the full permission matrix table (user → no workbench; qa_specialist → no workbench; researcher → WORKBENCH_ACCESS + WORKBENCH_RESEARCH + WORKBENCH_MODERATION; moderator → all except PRIVACY; group_admin → WORKBENCH_ACCESS + group-scoped; owner → all). Reference canonical source: `@mentalhelpglobal/chat-types` `src/rbac.ts`.
- [x] T014 [P] [US2] Create `MINIMUM_ROLE_FOR_ROUTE` reference map in chat-client/tests/e2e/helpers/permissions.ts — export a record mapping route patterns to minimum required roles (e.g., `'/workbench': 'researcher'`, `'/workbench/users': 'moderator'`, `'/workbench/privacy': 'owner'`). Include JSDoc explaining usage in `test.use({ role })` selection.

**Checkpoint**: Test authors can consult `permissions.ts` via IDE autocomplete to select the correct role. Convention rules for locators (US3), PII (US4), and navigation (US8) are documented in `quickstart.md` (already written during Phase 1 design).

---

## Phase 5: User Story 7 + US6 — Test User Seeding & CDN Pre-flight (Priority: P2)

**Goal**: Make the E2E test suite self-bootstrapping — `npx playwright test` automatically seeds test users and validates deployment preconditions.

**Independent Test**: Set `DATABASE_URL` and `PLAYWRIGHT_BASE_URL` env vars, run `npx playwright test` — globalSetup logs show seed status and CDN check results before tests begin. All 6 test users exist with correct roles and active status.

### Implementation for User Story 7 and User Story 6

- [x] T015 [US7] Create Playwright globalSetup in chat-client/tests/e2e/global-setup.ts — export default async function. Phase 1 (Seed): import `TEST_ROLES` from `./fixtures/roles`, connect to PostgreSQL via `DATABASE_URL` env var using `pg.Client`, for each role run `INSERT INTO users (email, role, status, approved_at, created_at, updated_at) VALUES ($1, $2, 'active', NOW(), NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'active', approved_at = COALESCE(users.approved_at, NOW()), updated_at = NOW()`. Log summary `[globalSetup] Seed: N/N test users verified`. On connection error: log warning, continue. On invalid role (not in UserRole enum): log error and throw (see contracts/global-setup-contract.md).
- [x] T016 [US6] Add CDN pre-flight check to chat-client/tests/e2e/global-setup.ts — after seed phase, if `PLAYWRIGHT_BASE_URL` is set and not localhost: send HEAD request to the URL, check `Cache-Control` header contains `no-cache` or `no-store` or `must-revalidate`. Log `[globalSetup] CDN: Cache-Control: no-cache confirmed` or warning with actual header value. On request failure: log warning, continue.
- [x] T017 [P] [US7] Add backend health check to chat-client/tests/e2e/global-setup.ts — after CDN check, derive API URL from config or env var, send GET to `/health` endpoint. Log result. On failure: log warning, continue.
- [x] T018 [US7] Register globalSetup in chat-client/playwright.config.ts — add `globalSetup: require.resolve('./tests/e2e/global-setup')` to the defineConfig object.
- [x] T019 [US7] Verify globalSetup by running `npx playwright test --reporter=list` in chat-client/ with `DATABASE_URL` and `PLAYWRIGHT_BASE_URL` set — confirm seed and pre-flight log messages appear before test execution. Verify all 6 test users are active in the database.

**Checkpoint**: E2E suite is fully self-bootstrapping. Running `npx playwright test` seeds users and checks CDN headers automatically.

---

## Phase 6: Dual-Target Mirroring (Constitution Principle VII)

**Purpose**: Mirror all changes to split repositories per dual-target discipline

### Frontend split repo (chat-frontend)

- [x] T020 [P] Copy chat-client/eslint-rules/enforce-i18n-namespace.js to chat-frontend/eslint-rules/enforce-i18n-namespace.js — verify identical content
- [x] T021 [P] Register enforce-i18n-namespace rule in chat-frontend/eslint.config.js — same configuration as chat-client (namespaceMap option matching chat-frontend's feature directory structure)
- [x] T022 [P] Copy chat-client/scripts/check-locale-keys.ts to chat-frontend/scripts/check-locale-keys.ts — adjust locale file paths if directory structure differs
- [x] T023 [P] Add `lint:locales` script to chat-frontend/package.json
- [x] T024 [P] Copy chat-client/src/vite-plugins/env-check.ts to chat-frontend/src/vite-plugins/env-check.ts
- [x] T025 Register envCheck plugin in chat-frontend/vite.config.ts — import and add to plugins array

### E2E split repo (chat-ui)

- [x] T026 [P] Add `pg` and `@types/pg` as devDependencies in chat-ui/package.json and run npm install
- [x] T027 [P] Copy chat-client/tests/e2e/global-setup.ts to chat-ui/tests/e2e/global-setup.ts — adjust import paths for `TEST_ROLES` to match chat-ui's fixture location
- [x] T028 [P] Copy chat-client/tests/e2e/helpers/permissions.ts to chat-ui/tests/e2e/helpers/permissions.ts — adjust import paths for `TestRole` type
- [x] T029 Register globalSetup in chat-ui/playwright.config.ts — add globalSetup reference

### Verification

- [x] T030 Run `npm run lint` in chat-frontend/ — confirm ESLint rule passes with no false positives
- [x] T031 [P] Run `npm run lint:locales` in chat-frontend/ — confirm locale check passes
- [x] T032 Run `npx playwright test --reporter=list` in chat-ui/ with `DATABASE_URL` and `PLAYWRIGHT_BASE_URL` set — confirm globalSetup seed and pre-flight checks execute correctly

**Checkpoint**: All changes are mirrored to split repos. Lint and tests pass in both monorepo and split repos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T033 Run full E2E suite in chat-client/ with `DATABASE_URL` and `PLAYWRIGHT_BASE_URL` against dev environment — confirm all 56 tests pass (24 passed, 32 skipped) with no manual intervention
- [x] T034 [P] Verify `npm run build` fails without `VITE_API_URL` in chat-client/ and chat-frontend/ — confirm descriptive error message
- [x] T035 [P] Verify `npm run lint` catches a deliberately introduced namespace violation (temporarily change one `useTranslation('review')` to `useTranslation()` in a review component, confirm lint fails, revert)
- [x] T036 Review and finalize quickstart.md in specs/008-e2e-test-standards/quickstart.md — ensure all commands and paths are accurate based on implemented code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 i18n (Phase 2)**: Depends on T002, T004 (directory creation)
- **US5 Env Var (Phase 3)**: Depends on T003 (directory creation)
- **US2 RBAC Ref (Phase 4)**: No dependencies on other phases — can start after Phase 1
- **US7+US6 Seeding (Phase 5)**: Depends on T001 (pg dependency)
- **Dual-Target (Phase 6)**: Depends on Phases 2–5 complete in chat-client
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **US1 (i18n)**: Independent — can start after Setup
- **US5 (Env Var)**: Independent — can start after Setup
- **US2 (RBAC Ref)**: Independent — can start after Setup
- **US7+US6 (Seeding)**: Independent — can start after Setup (needs pg dependency)
- **US3, US4, US8**: No new code tasks — conventions already implemented and documented

### Within Each User Story

- Create artifact → Register/integrate → Verify
- No cross-story dependencies

### Parallel Opportunities

- T002, T003, T004 can all run in parallel (directory creation)
- Phase 2 (US1), Phase 3 (US5), Phase 4 (US2), Phase 5 (US7+US6) can all start in parallel after Phase 1
- Within Phase 6: all copy tasks (T020–T029) can run in parallel
- T030, T031, T032 can partially parallelize (different repos)

---

## Parallel Example: After Phase 1 Setup

```text
# All four user story phases can start simultaneously:

Stream A (US1 - i18n):
  T005 → T006 → T008 → T009
  T007 (parallel with T005)

Stream B (US5 - Env Var):
  T010 → T011 → T012

Stream C (US2 - RBAC Ref):
  T013
  T014 (parallel with T013)

Stream D (US7+US6 - Seeding):
  T015 → T016 → T018 → T019
  T017 (parallel with T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: US1 i18n Namespace (T005–T009)
3. **STOP and VALIDATE**: Run `npm run lint` and `npm run lint:locales` — confirm they catch violations and pass on correct code
4. This alone prevents the single largest category of E2E failures

### Incremental Delivery

1. Setup → US1 (i18n enforcement) → Validate (catches 40% of recent failures)
2. Add US5 (env var check) → Validate (prevents the 100%-failure deployment scenario)
3. Add US7+US6 (self-bootstrapping seeding) → Validate (eliminates manual DB intervention)
4. Add US2 (RBAC reference) → Validate (prevents wrong-role assignments)
5. Dual-target mirror → Validate both repos
6. Each story adds protection without breaking previous layers

### Parallel Team Strategy

With 2+ developers:

1. Team completes Setup (Phase 1) together
2. Once Setup is done:
   - Developer A: US1 (i18n) + US5 (env var) — both CI-time static checks
   - Developer B: US7+US6 (seeding/CDN) + US2 (RBAC ref) — both runtime/E2E tooling
3. Both developers converge on Phase 6 (dual-target mirroring)
4. Joint Phase 7 verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 (Locator Specificity), US4 (PII Masking), US8 (Direct Navigation) have no code tasks — they are convention rules already applied during the recent fix cycle and documented in quickstart.md
- US6 (CDN) and US7 (Seeding) share a single file (global-setup.ts) and are grouped in one phase
- All verification tasks (T009, T012, T019, T030–T036) should be run against the dev environment with correct env vars
- Commit after each phase completes and verifies
