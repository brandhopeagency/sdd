# Feature Specification: E2E Test Standards & Conventions

**Feature Branch**: `008-e2e-test-standards`  
**Created**: 2026-02-10  
**Status**: Complete
**Jira Epic**: MTB-226
**Input**: User description: "any new rules and requirements as result of recent fixes"

## Clarifications

### Session 2026-02-10

- Q: How should convention violations be detected and enforced? → A: Layered — CI checks for static rules (i18n namespace matching, env var presence, locale key completeness) + Playwright pre-flight checks in `globalSetup` for runtime rules (seed data existence, CDN cache headers).
- Q: When and where does the test user seed script execute? → A: Playwright `globalSetup` — the seed script runs automatically as part of Playwright's `globalSetup` before any test, making the suite fully self-bootstrapping.
- Q: Do these conventions apply only to E2E tests, or also to application source code? → A: Mixed scope — CI lint rules for i18n (FR-001, FR-002) and build validation (FR-007) enforce conventions in `src/` application code; test-specific rules (FR-003–FR-006, FR-010) are scoped to `tests/e2e/`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - i18n Namespace Discipline (Priority: P1)

When a developer adds a new feature area with its own i18n namespace (e.g., `review`, `workbench`, `chat`), every component in that feature area must explicitly load the correct namespace via `useTranslation('<namespace>')`. If the namespace is omitted, the component silently falls back to the default namespace and renders raw translation keys instead of translated text, causing test failures and broken UI.

Additionally, every navigation label in the sidebar must have a corresponding translation key in the root locale files (`en.json`, `uk.json`, `ru.json`) under `workbench.nav.*`, because navigation rendering happens outside feature-specific namespaces.

**Why this priority**: i18n namespace mismatches cause silent rendering failures that are invisible during development (keys render as plausible English text) but break E2E tests and non-English users. This was the single largest category of test failures in the recent fix cycle.

**Independent Test**: Can be verified by a linting rule or automated check that scans all components within a feature directory and confirms `useTranslation('<namespace>')` matches the feature's designated namespace.

**Acceptance Scenarios**:

1. **Given** a component in `src/features/workbench/review/`, **When** it calls `useTranslation()`, **Then** it MUST pass the `'review'` namespace argument — i.e., `useTranslation('review')`.
2. **Given** a new feature area is added under `src/features/`, **When** that area has its own i18n JSON file (e.g., `en/featureName.json`), **Then** every component in that directory MUST use `useTranslation('featureName')`.
3. **Given** a new sidebar navigation entry is added, **When** the entry label is defined, **Then** a corresponding key MUST exist in `workbench.nav.*` in all supported locale files (`en.json`, `uk.json`, `ru.json`).

---

### User Story 2 - RBAC-Aware E2E Test Role Assignment (Priority: P1)

E2E tests that exercise protected features must use a test role that actually possesses the required permissions. For example, the `qa_specialist` role does not have `WORKBENCH_ACCESS`, so any test navigating to `/workbench/*` must use a role that does (e.g., `researcher`, `moderator`, `owner`).

Test authors must consult the permission matrix before assigning a `test.use({ role: ... })` block and must not assume role names imply permission sets.

**Why this priority**: Using the wrong role causes all authenticated tests in a file to fail with a redirect to `/chat`, producing confusing "element not found" errors that obscure the actual issue.

**Independent Test**: Can be verified by reviewing each test file's `test.use({ role })` against the application's permission model and confirming the role grants the permissions exercised in the test.

**Acceptance Scenarios**:

1. **Given** a test that navigates to `/workbench/*` routes, **When** a role is assigned via `test.use({ role })`, **Then** that role MUST have the `WORKBENCH_ACCESS` permission.
2. **Given** a test that exercises review functionality, **When** a role is assigned, **Then** that role MUST have both `WORKBENCH_ACCESS` and `WORKBENCH_RESEARCH` (or equivalent review permission).
3. **Given** a new test file is created for a permission-gated feature, **When** the author selects a role, **Then** the test SHOULD include a guard (`if (/#\/chat/.test(page.url())) test.skip(...)`) to produce a clear skip message rather than a cryptic failure.

---

### User Story 3 - Playwright Locator Specificity (Priority: P2)

Playwright locators must be specific enough to match exactly one element. Broad locators (e.g., `getByRole('button', { name: /approvals/i })` without scoping) cause Playwright's strict mode to throw when multiple matching elements exist. Locators should be scoped to a container (e.g., `page.locator('nav').getByRole(...)`) or use more precise matching patterns (e.g., exact name, specific element type).

**Why this priority**: Strict mode violations produce immediate test failures that are straightforward to fix individually, but if uncaught they cascade across the suite and are the second most common failure category.

**Independent Test**: Can be verified by running each test in strict mode (Playwright's default) and confirming no "strict mode violation" errors occur.

**Acceptance Scenarios**:

1. **Given** a locator targets a UI element that may appear in multiple places (e.g., sidebar nav and page header), **When** the locator is constructed, **Then** it MUST be scoped to a specific container (e.g., `page.locator('nav').getByRole(...)`) or use an exact-match pattern.
2. **Given** a locator for an error state message, **When** the error text appears in multiple elements (heading, paragraph, button), **Then** the locator MUST specify the element type (e.g., `page.locator('p').getByText(/request failed/i)`).
3. **Given** a new E2E test is written, **When** locators are chosen, **Then** they SHOULD prefer `getByRole` with exact name matches, `getByTestId`, or container-scoped queries over broad text matchers.

---

### User Story 4 - PII Masking Awareness in Test Assertions (Priority: P2)

When PII masking is active (as in the workbench user management view), test assertions must not depend on reading user-identifiable text (emails, names) from rendered table cells. Instead, assertions should verify structural outcomes: row counts, filter behavior (result count changes), or the presence of UI controls.

**Why this priority**: PII masking replaces visible user data with redacted placeholders. Tests that assert on masked content produce false negatives.

**Independent Test**: Can be verified by running user-management tests in the masked environment and confirming assertions pass regardless of masking state.

**Acceptance Scenarios**:

1. **Given** a test searches for users by keyword (e.g., `"e2e"`), **When** the results are returned with PII masking active, **Then** the assertion MUST verify the result count (e.g., `expect(rowCount).toBeGreaterThan(0)`) rather than the visible text of individual cells.
2. **Given** a test verifies user profile details, **When** PII masking is active, **Then** assertions MUST rely on structural indicators (data attributes, element counts, button states) rather than rendered text content.

---

### User Story 5 - Frontend Build-Time Environment Variable Enforcement (Priority: P1)

The frontend build process (Vite) must embed the correct `VITE_API_URL` at build time. If this variable is missing or incorrect, the built frontend silently falls back to `http://localhost:3001/api`, which causes all API calls to fail when deployed to any non-local environment. This is not detectable until runtime.

**Why this priority**: An incorrect API URL causes 100% of authenticated tests to fail with `NETWORK_ERROR`, and the root cause is extremely non-obvious because the fallback URL is hardcoded in source.

**Independent Test**: Can be verified by inspecting the built JavaScript bundle for the expected API URL string.

**Acceptance Scenarios**:

1. **Given** a frontend build is triggered for a non-local environment (dev, staging, production), **When** `VITE_API_URL` is not set, **Then** the build process MUST fail with a clear error rather than silently falling back to `localhost`.
2. **Given** a frontend build completes, **When** the output bundle is inspected, **Then** the embedded API URL MUST match the target environment's backend endpoint.
3. **Given** a CI/CD deployment pipeline, **When** the frontend is built, **Then** the pipeline MUST set `VITE_API_URL` from the environment-specific configuration (e.g., `${{ vars.BACKEND_URL }}`).

---

### User Story 6 - CDN Cache Management for Frontend Deployments (Priority: P2)

After deploying updated frontend assets to GCS, the `index.html` entry point must be served with `Cache-Control: no-cache` headers to ensure browsers and CDN edges always revalidate. Hashed asset files (JS, CSS) may use long-lived immutable caching. Without this, stale `index.html` references old JS bundles, causing the deployed fix to be invisible.

**Why this priority**: CDN caching of stale `index.html` caused an entire re-test cycle to fail despite correct assets being uploaded, wasting significant debugging time.

**Independent Test**: Can be verified by checking the `Cache-Control` header of `index.html` on the CDN after deployment.

**Acceptance Scenarios**:

1. **Given** a frontend deployment to GCS, **When** `index.html` is uploaded, **Then** it MUST have `Cache-Control: no-cache` (or `no-store, must-revalidate`) metadata.
2. **Given** a frontend deployment to GCS, **When** hashed asset files (e.g., `assets/index-abc123.js`) are uploaded, **Then** they SHOULD have `Cache-Control: public, max-age=31536000, immutable` metadata.
3. **Given** a test suite runs against a freshly deployed frontend, **When** a cache-busted URL is not used, **Then** the test suite MUST still see the latest deployed code within a reasonable propagation window.

---

### User Story 7 - Test User Database Seeding and Activation (Priority: P2)

E2E test user accounts (`e2e-*@test.local`) must be pre-seeded in the dev database with `status = 'active'`, `approved_at` set, and the correct role assigned. If test accounts are inactive or lack the expected role, every authenticated test fails with "account awaiting approval" errors.

**Why this priority**: Missing or misconfigured test users cause cascade failures across the entire authenticated test suite. This was the initial blocker in the recent fix cycle.

**Independent Test**: Can be verified by querying the dev database for `e2e-*@test.local` users and confirming their `status`, `role`, and `approved_at` fields.

**Acceptance Scenarios**:

1. **Given** a developer or CI pipeline runs `npx playwright test`, **When** Playwright's `globalSetup` executes, **Then** the seed script MUST automatically ensure all accounts in the `TEST_ROLES` fixture (`e2e-user@test.local`, `e2e-qa@test.local`, `e2e-researcher@test.local`, `e2e-moderator@test.local`, `e2e-group-admin@test.local`, `e2e-owner@test.local`) exist with `status = 'active'` and a valid `approved_at` timestamp.
2. **Given** a test user account exists, **When** its role is checked, **Then** it MUST match the corresponding role defined in `tests/e2e/fixtures/roles.ts`.
3. **Given** a new test role is added to `TEST_ROLES`, **When** the test suite is run, **Then** the `globalSetup` seed script MUST automatically create and activate the corresponding `e2e-<role>@test.local` account.

---

### User Story 8 - Direct Navigation Over UI Interaction for Test Setup (Priority: P3)

E2E tests should prefer `gotoRoute(page, '/path')` for navigating to the page under test, rather than clicking through sidebar navigation or multi-step UI flows. This reduces test brittleness caused by sidebar layout changes, animation timing, or intermediate loading states.

**Why this priority**: Several test failures were caused by sidebar navigation elements being renamed, reordered, or temporarily unavailable during page transitions. Direct navigation eliminated these as failure sources.

**Independent Test**: Can be verified by reviewing test files and confirming setup navigation uses `gotoRoute` rather than UI-click sequences.

**Acceptance Scenarios**:

1. **Given** a test needs to reach a specific workbench page (e.g., `/workbench/review`), **When** the test sets up its starting state, **Then** it SHOULD use `gotoRoute(page, '/workbench/review')` rather than navigating via the sidebar.
2. **Given** a test explicitly validates sidebar navigation behavior, **When** the test clicks a sidebar element, **Then** this is acceptable because the sidebar interaction IS the thing being tested.
3. **Given** a new test is written, **When** the test needs to reach a starting page, **Then** the test SHOULD separate "navigation to the page" (setup) from "interaction with the page" (test body).

---

### Edge Cases

- What happens when a new locale file is added but not all locale variants (en, uk, ru) include the new namespace? Tests should catch missing keys via i18n's `missingKeyHandler` or a pre-test linting step.
- How does the system handle a test user whose role has been removed from the `UserRole` enum? The seed script should fail loudly rather than creating an account with an invalid role.
- What happens when `VITE_API_URL` is set to an unreachable endpoint? The OTP login flow should time out with a descriptive error rather than hanging indefinitely.
- How should tests behave when the backend is down? Tests should skip with a clear message rather than failing with cryptic network errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every React component within a feature directory that has a dedicated i18n namespace MUST call `useTranslation('<namespace>')` with the explicit namespace argument matching its feature area.
- **FR-002**: All sidebar navigation labels MUST have corresponding translation keys in `workbench.nav.*` across all supported locale files (en, uk, ru).
- **FR-003**: E2E tests MUST assign roles via `test.use({ role })` that have the permissions required by the test's navigation and assertions, as defined in the application's RBAC permission matrix.
- **FR-004**: E2E tests for permission-gated features MUST include a guard that skips the test with a descriptive message when the current role lacks access, rather than failing with element-not-found errors.
- **FR-005**: Playwright locators MUST be specific enough to match exactly one element; locators for elements appearing in multiple containers MUST be scoped to a specific parent (e.g., `page.locator('nav').getByRole(...)`).
- **FR-006**: Test assertions against user-facing data MUST NOT depend on PII-visible text when PII masking may be active; assertions MUST use structural indicators (counts, attributes, control states) instead.
- **FR-007**: The frontend build process for non-local environments MUST require `VITE_API_URL` to be set and MUST fail the build if it is absent or set to a localhost value.
- **FR-008**: The `index.html` file deployed to GCS MUST have `Cache-Control: no-cache` metadata; hashed assets SHOULD use immutable caching.
- **FR-009**: A database seed script MUST ensure all accounts defined in `tests/e2e/fixtures/roles.ts` exist in the target database with `status = 'active'`, correct `role`, and a valid `approved_at`. This script MUST run automatically as part of Playwright's `globalSetup`, making the test suite self-bootstrapping with no separate manual or CI seed step required.
- **FR-010**: E2E test setup navigation SHOULD use `gotoRoute(page, '/route')` rather than clicking through UI elements, unless the UI navigation itself is the subject of the test.
- **FR-011**: Static convention rules targeting application code (FR-001, FR-002, FR-007) MUST be enforced by CI pipeline checks (lint rules or scripts) scoped to `src/` that fail the build on violation. Static convention rules targeting test code (FR-003, FR-005, FR-006, FR-010) SHOULD be enforced by CI checks scoped to `tests/e2e/`.
- **FR-012**: Runtime convention rules (FR-009 seed data, FR-008 CDN headers) MUST be verified by Playwright `globalSetup` pre-flight checks that skip or abort the suite with a descriptive message when preconditions are not met.

### Key Entities

- **Test Role**: A mapping of a human-readable role name (e.g., `researcher`) to an email address (`e2e-researcher@test.local`) and application role (`researcher`). Defined in `tests/e2e/fixtures/roles.ts` and must be mirrored in the database.
- **i18n Namespace**: A scoped translation file (e.g., `en/review.json`) loaded by components via `useTranslation('review')`. Each feature area under `src/features/` that has its own namespace JSON file must enforce this convention.
- **Permission**: A granular capability (e.g., `WORKBENCH_ACCESS`, `WORKBENCH_RESEARCH`) assigned to roles. Tests must map roles to permissions accurately.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of E2E tests pass on a freshly deployed dev environment without manual database intervention or cache-busting workarounds.
- **SC-002**: No i18n raw key rendering visible on any page when navigating the application in English, Ukrainian, or Russian locales.
- **SC-003**: Zero Playwright strict mode violations across the entire E2E test suite.
- **SC-004**: All test user accounts are automatically provisioned and activated by a seed script that runs as part of the test setup or CI pipeline, requiring zero manual SQL.
- **SC-005**: Frontend deployments to any non-local environment result in the correct API URL being embedded, verifiable by inspecting the deployed bundle.
- **SC-006**: After a frontend deployment, the updated `index.html` is served to all users within 60 seconds without requiring manual cache purging.

## Scope

- **Application code (`src/`)**: FR-001 (i18n namespace), FR-002 (nav locale keys), FR-007 (build-time env var) — enforced by CI lint rules.
- **E2E test code (`tests/e2e/`)**: FR-003 (RBAC role assignment), FR-004 (permission guards), FR-005 (locator specificity), FR-006 (PII masking awareness), FR-010 (direct navigation) — enforced by CI checks or code review.
- **Deployment pipeline (CI/CD)**: FR-007 (env var enforcement), FR-008 (CDN cache headers) — enforced by pipeline configuration.
- **Playwright runtime (`globalSetup`)**: FR-009 (seed data), FR-012 (pre-flight checks) — enforced at test execution time.
- **Out of scope**: Unit tests, integration tests, backend code conventions, and manual QA processes are not covered by this spec.

## Assumptions

- The application uses `react-i18next` with namespace-based translation loading.
- The dev environment uses Google Cloud Storage for static frontend hosting with default CDN behavior.
- The backend runs on Cloud Run with OTP-based authentication that logs dev codes to the browser console.
- PII masking is a feature of the workbench user management view and may be toggled per-role or per-environment.
- The `TEST_ROLES` fixture in `roles.ts` is the single source of truth for E2E test personas.

## Dependencies

- `specs/007-e2e-coverage` — This spec extends the E2E coverage framework with conventions and guard rails discovered during implementation.
- `specs/002-chat-moderation-review` — The review feature's i18n and RBAC issues were the primary source of the fixes captured here.
- `specs/003-cloud-github-infra` — CDN caching and deployment pipeline requirements relate to the infrastructure spec.
