# Feature Specification: E2E Test Coverage Expansion

**Feature Branch**: `007-e2e-coverage`
**Created**: 2026-02-08
**Status**: Complete
**Jira Epic**: MTB-225
**Input**: Expand Playwright E2E test coverage to all major features and critical user flows, closing gaps between documented functionality and automated test coverage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authentication Flow E2E Tests (Priority: P1)

Automated tests validate the core authentication lifecycle: OTP login (using dev console codes), guest entry, guest-to-registered upgrade with session binding, and logout. These tests run against the deployed dev environment and catch regressions in the auth flow before they reach production. (Token refresh is implicit in session management and not directly testable via UI E2E.)

**Why this priority**: Authentication is the entry point for all other features. A broken auth flow blocks every user.

**Independent Test**: Can be verified by running the auth test suite against the dev environment and confirming all scenarios pass — login, guest entry, registration, and logout.

**Acceptance Scenarios**:

1. **Given** the dev environment, **When** the OTP login E2E test runs, **Then** it completes the full flow: enter email → extract dev OTP from console → enter OTP → land on chat page.
2. **Given** a guest user, **When** the guest chat E2E test runs, **Then** it verifies: click "Start Conversation" → chat as guest → open register popup → complete OTP → verify session preserved.
3. **Given** an authenticated user, **When** the logout E2E test runs, **Then** it verifies the user is redirected to the welcome screen and protected routes are no longer accessible.
4. **Given** an unauthenticated visitor, **When** accessing a protected route, **Then** they are redirected to the login page.

---

### User Story 2 - Chat Interface E2E Tests (Priority: P1)

Automated tests validate the core chat experience: sending messages, receiving AI responses, feedback submission, technical details toggle, and session lifecycle (new session, end chat). (Markdown rendering is verified implicitly — AI responses render as HTML, not raw markdown — but no dedicated assertion targets specific markdown constructs.)

**Why this priority**: The chat is the core product. E2E tests catch integration failures between frontend, backend, and Dialogflow CX.

**Independent Test**: Can be verified by running the chat test suite and confirming message send/receive, feedback, and session management all function correctly end-to-end.

**Acceptance Scenarios**:

1. **Given** an active chat session, **When** the message send test runs, **Then** it types a message, sends it, and verifies an AI response appears.
2. **Given** an AI response, **When** the feedback test runs, **Then** it clicks thumbs up, verifies visual state change, and confirms no console errors.
3. **Given** a QA+ role user, **When** the technical details test runs, **Then** it clicks the gear icon and verifies intent/confidence/response time are displayed.
4. **Given** an active session, **When** the end-chat test runs, **Then** it clicks "End Chat", confirms the session terminates, and verifies "New Session" starts a fresh conversation.
5. **Given** keyboard-only interaction, **When** the chat keyboard test runs, **Then** Enter sends the message and Shift+Enter inserts a newline.

---

### User Story 3 - Workbench E2E Tests (Priority: P2)

Automated tests validate workbench access, navigation, and core functionality: dashboard rendering, user list search/filter/pagination, user profile actions, and navigation between sections. Tests verify role-based visibility — sections appear or are hidden based on the authenticated user's permissions.

**Why this priority**: Workbench is the administrative backbone. E2E tests ensure role-based access control works correctly in the real application.

**Independent Test**: Can be verified by running the workbench test suite with different role users and confirming correct section visibility and functionality.

**Acceptance Scenarios**:

1. **Given** a moderator account, **When** the workbench navigation test runs, **Then** it verifies the sidebar shows Dashboard, Users, Research, Approvals, and Settings.
2. **Given** the user list, **When** the search test runs, **Then** it types a search term and verifies the list filters within debounce time.
3. **Given** a user profile, **When** the block/unblock test runs, **Then** it clicks the action button and verifies the status changes.
4. **Given** a user role, **When** the permission test runs, **Then** it verifies that unauthorized workbench sections return 403 or redirect.

---

### User Story 4 - Group Management E2E Tests (Priority: P2)

Automated tests validate group creation, invite code generation, membership request flow, and group-scoped workbench views. Tests cover the Group Admin perspective — accessing the group dashboard, viewing anonymized sessions, and managing membership requests.

**Why this priority**: Groups are a complex multi-step flow with multiple actors (owner creates, user joins, admin approves). E2E tests catch integration issues in the approval chain.

**Independent Test**: Can be verified by running the group management test suite that creates a group, generates an invite, simulates a join request, and verifies the approval workflow.

**Acceptance Scenarios**:

1. **Given** an Owner account, **When** the group creation test runs, **Then** it creates a group and verifies it appears in the groups list.
2. **Given** a group, **When** the invite code test runs, **Then** it generates an invite code and verifies it's usable.
3. **Given** a Group Admin, **When** the group dashboard test runs, **Then** it verifies the group-scoped views (dashboard, users, sessions) render correctly.
4. **Given** a pending membership request, **When** the approval test runs, **Then** it approves the request and verifies the user appears in the member list.

---

### User Story 5 - Research & Moderation E2E Tests (Priority: P2)

Automated tests validate the research workflow: chat history list pagination and filtering, opening the three-column moderation view, adding annotations, editing golden references, and tagging sessions. Tests confirm the moderation status transitions (pending → in_review → moderated).

**Why this priority**: The moderation view is the most complex UI in the application. E2E tests ensure the three-column layout, synchronized scrolling, and save functionality work together.

**Independent Test**: Can be verified by running the moderation test suite that navigates from session list to moderation view, adds annotations, and marks a session as moderated.

**Acceptance Scenarios**:

1. **Given** the chat history list, **When** the pagination test runs, **Then** it navigates between pages and verifies session counts.
2. **Given** a session, **When** the moderation view test runs, **Then** it opens the three-column view and verifies all three columns render with content.
3. **Given** the annotation panel, **When** the annotation test runs, **Then** it adds a quality rating and notes, saves, and verifies persistence by reloading.
4. **Given** the tagging system, **When** the tag test runs, **Then** it adds a tag with autocomplete and verifies it appears on the session.

---

### User Story 6 - Privacy & GDPR E2E Tests (Priority: P3)

Automated tests validate PII masking toggle, data export initiation, and the erasure confirmation flow. Tests verify that masking correctly obscures names and emails, and that GDPR operations require appropriate confirmation steps.

**Why this priority**: Privacy operations are critical for compliance but are infrequent administrative actions. E2E tests ensure they work when needed.

**Independent Test**: Can be verified by running the privacy test suite that toggles PII masking and verifies visual changes, and initiates a data export request.

**Acceptance Scenarios**:

1. **Given** an Owner account, **When** the PII toggle test runs, **Then** it enables masking and verifies names/emails are displayed in masked format.
2. **Given** the privacy dashboard, **When** the export test runs, **Then** it initiates a data export and verifies the request is acknowledged.
3. **Given** the erasure flow, **When** the confirmation test runs, **Then** it verifies the confirmation dialog requires explicit acknowledgment before proceeding.

---

### User Story 7 - Review System E2E Tests (Priority: P3)

Automated tests validate the review queue, session review workflow (rating messages, submitting reviews), and dashboard statistics. Tests ensure the review system integrates correctly end-to-end. (Risk flag creation is a secondary workflow that may be added in a follow-up if the review queue tests reveal sufficient UI stability.)

**Why this priority**: The review system is newly implemented and hasn't been E2E tested yet. These tests catch integration issues specific to the review feature.

**Independent Test**: Can be verified by running the review test suite that navigates the review queue, opens a session for review, rates messages, and submits a completed review.

**Acceptance Scenarios**:

1. **Given** a reviewer account, **When** the queue test runs, **Then** it navigates to the review queue and verifies sessions are listed.
2. **Given** a review session, **When** the rating test runs, **Then** it rates a message (1-10), adds criteria feedback, and verifies the score is saved.
3. **Given** a completed review, **When** the submit test runs, **Then** it submits the review and verifies the session moves out of the pending queue.
4. **Given** the review dashboard, **When** the dashboard test runs, **Then** it verifies personal statistics are displayed.

---

### Edge Cases

- What happens when the dev environment is unreachable? Tests MUST fail gracefully with clear error messages indicating the environment is down.
- What happens when test user accounts don't exist? Test setup MUST handle account creation or seeding as a prerequisite step.
- What happens when concurrent test runs modify shared data? Tests MUST use unique identifiers or isolated data to prevent interference.
- What happens when Dialogflow CX returns unexpected responses? Chat tests assert only that a non-empty AI response bubble appears within a timeout — no assertions on specific AI-generated text content.

## Requirements *(mandatory)*

### Functional Requirements

**Test Infrastructure**
- **FR-001**: E2E tests MUST run against the deployed dev environment using Playwright.
- **FR-002**: Tests MUST use the console OTP provider's dev code for authentication, not real email.
- **FR-003**: Tests MUST capture browser console logs, network requests, and screenshots for every test run.
- **FR-004**: Failed tests MUST generate a reproduction markdown file (`repro.md`) and failure screenshot.
- **FR-005**: Tests MUST be runnable in CI (headless) and locally (headed mode for debugging).

**Coverage Requirements**
- **FR-006**: Tests MUST cover the complete OTP login flow (email → OTP → chat landing).
- **FR-007**: Tests MUST cover guest access and guest-to-registered session binding.
- **FR-008**: Tests MUST cover chat message send/receive, feedback, and session lifecycle.
- **FR-009**: Tests MUST cover workbench navigation with role-based section visibility.
- **FR-010**: Tests MUST cover user list search, filtering, and pagination.
- **FR-011**: Tests MUST cover group creation, invite codes, and membership approval.
- **FR-012**: Tests MUST cover the three-column moderation view and annotation workflow.
- **FR-013**: Tests MUST cover PII masking toggle and GDPR operation initiation.
- **FR-014**: Tests MUST cover the review queue, session rating, and review submission.
- **FR-015**: Tests MUST cover route guards (unauthenticated redirect, permission denial).

**Quality Standards**
- **FR-016**: Tests MUST fail on any `console.error` or uncaught page error.
- **FR-017**: Tests MUST fail on any failed network request (excluding expected 4xx responses).
- **FR-018**: Tests MUST be independent — no test depends on another test's execution or outcome.
- **FR-019**: Tests MUST complete within 5 minutes total (full suite) in CI using serial execution (1 Playwright worker).

**CI Integration**
- **FR-020**: E2E test suite MUST run automatically on every pull request targeting `develop`.
- **FR-021**: E2E test results (pass/fail, screenshots, logs) MUST be available as CI artifacts.
- **FR-022**: E2E test failures MUST block PR merge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: E2E test suite covers all 7 feature areas with at least 2 test cases per area — minimum 14 test files.
- **SC-002**: All tests pass reliably against the deployed dev environment — flaky test rate below 5% over 10 consecutive runs.
- **SC-003**: Full test suite completes in under 5 minutes in CI.
- **SC-004**: Every PR targeting `develop` triggers E2E tests automatically and blocks merge on failure.
- **SC-005**: Test artifacts (logs, screenshots, repro files) are available for every test run for debugging.
- **SC-006**: Zero critical user flows lack E2E coverage — auth, chat, and workbench navigation are fully covered.

## Clarifications

### Session 2026-02-08

- Q: How are test accounts with various roles created and maintained? → A: Pre-seeded fixed accounts per role in the dev database (fast, stable, shared across runs).
- Q: Should tests run in parallel workers or serially? → A: Serial execution (1 Playwright worker) — simpler, no contention with shared accounts, sufficient for 14 files within 5 minutes.
- Q: How should chat tests validate variable AI responses from Dialogflow CX? → A: Assert response exists (non-empty message bubble appears within timeout) — no text matching on AI content.

## Assumptions

- The dev environment (`chat-backend-dev` + GCS frontend) is available and stable enough for E2E testing.
- Test user accounts with various roles (user, moderator, owner, group_admin, researcher) are pre-seeded in the dev database as fixed accounts with well-known email addresses (e.g., `e2e-owner@test.local`, `e2e-moderator@test.local`). A one-time seeding script creates them; tests reference them by convention.
- The console OTP provider returns the OTP code in the API response, enabling automated authentication without email.
- Playwright is the chosen E2E framework, consistent with existing tests in `chat-ui` and `chat-client`.
- Tests in both `chat-ui` (split repo) and `chat-client/tests/e2e/` (monorepo) need coverage per Dual-Target Implementation.

## Scope Boundaries

**In scope**:
- New E2E test files for all uncovered feature areas (groups, moderation, privacy, review, approvals)
- Enhancement of existing test files (auth, chat, workbench) with additional scenarios
- CI integration for automated test execution on PRs
- Test data seeding strategy for reliable test execution
- Both monorepo and split repo test directories

**Out of scope**:
- Performance/load testing
- Visual regression testing (screenshot comparison)
- API-only integration tests (covered by unit tests)
- Mobile browser E2E testing
- Cross-browser E2E testing (Playwright default: Chromium only for speed)
