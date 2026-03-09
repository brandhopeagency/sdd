# Tasks: Automated Documentation Screenshots & Content Enhancement

**Input**: Design documents from `/specs/013-automate-doc-screenshots/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Not applicable — this is a documentation-only feature with manual content validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All tasks use the Playwright MCP (`plugin-playwright-playwright`) for screenshot capture and the Atlassian MCP (`plugin-atlassian-atlassian`) for Confluence page updates. Page paths use the convention `Confluence:UD/<Section>/<Page>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different pages, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Confluence page IDs in descriptions

## MCP Parameters (shared across all tasks)

| Parameter | Value |
|-----------|-------|
| `cloudId` | `3aca5c6d-161e-42c2-8945-9c47aeb2966d` |
| `spaceId` | `8454147` |
| `contentFormat` | `markdown` |

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done
  immediately when the corresponding task is marked `[X]` — do NOT
  batch transitions at the end. Stories are transitioned when all
  their tasks are complete.
- [P] tasks = different Confluence pages, no dependencies
- [Story] label maps task to specific user story for traceability

## Implementation Notes: Screenshot Embedding Pipeline

The following requirements were discovered during implementation and
apply to all screenshot capture and embedding tasks:

### Screenshot capture

- Use `browser_run_code` with `page.screenshot({ path: '<absolute>' })`
  instead of `browser_take_screenshot`. The latter saves to the MCP
  process's working directory which may be inaccessible.
- Create a local `screenshots/` directory before capture to store
  all screenshot files in a known location.

### Screenshot upload (requires Atlassian API token)

- Upload via Confluence REST API v1:
  `POST /wiki/rest/api/content/{pageId}/child/attachment`
- Use `curl.exe` for multipart uploads — PowerShell
  `Invoke-RestMethod` returns HTTP 500 for this endpoint.
- Auth: Basic Auth with `email:apiToken`.
- Header: `X-Atlassian-Token: nocheck` (required for attachment uploads).

### Screenshot embedding in page content

- Do NOT use markdown `![alt](file.png)` for page attachments. The
  MCP's markdown converter produces `<ri:url>` references (external
  URLs) instead of `<ri:attachment>` references (page attachments).
- After content update via MCP, retrieve page in storage format via
  REST API, replace `<ri:url>` elements with `<ri:attachment>`, and
  PUT the corrected storage format back.
- Correct storage format:
  `<ac:image><ri:attachment ri:filename="name.png" /></ac:image>`
- Incorrect (MCP-generated):
  `<ac:image ac:src="name.png"><ri:url ri:value="name.png" /></ac:image>`
- The MCP's markdown parser may also corrupt the `ac:src` attribute
  by extracting words from alt text (e.g., `ac:src="English,"` instead
  of the filename). Always verify and fix storage format after MCP
  content updates that include images.

---

## Phase 1: Setup

**Purpose**: Verify prerequisites — dev environment accessibility and Confluence page inventory.

- [X] T001 Verify dev environment accessibility via Playwright MCP `browser_navigate` to the current dev frontend URL from the latest CI/CD deploy; confirm the login page loads successfully — MTB-282

---

## Phase 2: User Story 1 — Automated Screenshot Capture via Playwright (Priority: P1) 🎯 MVP

**Goal**: Capture all 11 required screenshots from the dev environment using the Playwright MCP and save locally with descriptive filenames.

**Independent Test**: Navigate to each screenshot file saved locally and confirm it matches the expected UI state described in research.md Decision 5 (screenshot inventory).

### Implementation for User Story 1

- [X] T002 [US1] Login to dev environment via Playwright MCP — navigate to dev login URL, fill email, submit, read OTP from `browser_console_messages`, fill OTP field, submit, wait for landing page to load — MTB-283
- [X] T003 [US1] Capture Getting Started screenshots via Playwright MCP — (a) login screen with email field → `getting-started-login.png`, (b) OTP entry screen → `getting-started-otp.png`, (c) landing page after login → `getting-started-landing.png` — use `browser_snapshot` to identify elements, `browser_take_screenshot` to capture — MTB-284
- [X] T004 [US1] Capture Chat Interface Guide screenshots via Playwright MCP — navigate to chat section, (a) new chat session start → `chat-new-session.png`, (b) active messaging conversation → `chat-messaging.png`, (c) conversation history list → `chat-history.png` — MTB-285
- [X] T005 [US1] Capture Workbench Guide screenshots via Playwright MCP — navigate to workbench, (a) admin overview/dashboard → `workbench-overview.png`, (b) user management screen → `workbench-users.png`, (c) group management screen → `workbench-groups.png`, (d) session review screen → `workbench-sessions.png`, (e) settings page → `workbench-settings.png` — MTB-286

**Checkpoint**: All 11 screenshots captured and saved locally. Each file shows the correct UI state from the dev environment.

---

## Phase 3: User Story 2 — Enrich User Manual with Detailed Content (Priority: P2)

**Goal**: Rewrite each User Manual page to meet the Constitution XI detail standard — purpose, navigation path, every interactive element, numbered step-by-step workflows, tips/warnings — and embed the Playwright-captured screenshots from US1.

**Independent Test**: Have a new end user attempt to complete first login, start a chat, and review a session using only the User Manual. They should succeed without external help.

### Implementation for User Story 2

- [X] T006 [P] [US2] Enrich `Getting Started` page (ID `8945665`) in Confluence:UD/User Manual/Getting Started — read current content via `getConfluencePage`, rewrite with: purpose of login screen, step-by-step OTP login workflow with numbered instructions, explanation of every element on the landing page, tips for common login issues (wrong email, expired OTP), embed screenshots `getting-started-login.png`, `getting-started-otp.png`, `getting-started-landing.png`; update via `updateConfluencePage` (FR-001, FR-003, FR-004) — MTB-287
- [X] T007 [P] [US2] Enrich `Chat Interface Guide` page (ID `8847380`) in Confluence:UD/User Manual/Chat Interface Guide — read current content, rewrite with: purpose of the chat interface, how to reach it from landing, every interactive element (message input, send button, session selector, history), numbered workflows for starting a chat and viewing history, tips for message formatting and session management, embed screenshots `chat-new-session.png`, `chat-messaging.png`, `chat-history.png`; update via `updateConfluencePage` (FR-001, FR-003, FR-004) — MTB-288
- [X] T008 [P] [US2] Enrich `Workbench Guide` page (ID `8978433`) in Confluence:UD/User Manual/Workbench Guide — read current content, rewrite with sections for: admin overview (purpose, navigation), user management (list users, create, edit, permissions), group management (list groups, create, assign users), session review (view sessions, rate, supervise), settings (configuration options); each section with numbered workflows, element descriptions, tips; embed screenshots `workbench-overview.png`, `workbench-users.png`, `workbench-groups.png`, `workbench-sessions.png`, `workbench-settings.png`; update via `updateConfluencePage` (FR-001, FR-003, FR-004) — MTB-289
- [X] T009 [P] [US2] Enrich `FAQ` page (ID `8814612`) in Confluence:UD/User Manual/FAQ — read current content, rewrite with comprehensive Q&A organized by category: Login & Authentication (OTP not received, email not recognized), Chat (how to start, message formatting, session ended), Workbench (access denied, user not found, group management), General (browser compatibility, mobile access, data privacy); each answer with step-by-step resolution (FR-004) — MTB-290
- [X] T010 [P] [US2] Enrich `Release Notes v1.0.0` entry (ID `8880129`) in Confluence:UD/Release Notes/Release v1.0.0 — read current content, rewrite with detailed change descriptions explaining user impact for each change (not just feature names), version `v1.0.0`, date `2026-02-22`, Known Issues section, Related Epics linking to [MTB-1](https://mentalhelpglobal.atlassian.net/browse/MTB-1) and [MTB-251](https://mentalhelpglobal.atlassian.net/browse/MTB-251) (FR-007) — MTB-291
- [X] T011 [US2] Update `User Manual` section root page (ID `8749070`) in Confluence:UD/User Manual — verify links to all four child pages are correct, update section description to reflect enriched content — MTB-292

**Checkpoint**: All User Manual pages meet the five detail criteria. Zero `[SCREENSHOT]` placeholders remain. A new user can follow the Getting Started guide to log in and use the system.

---

## Phase 4: User Story 3 — Enrich Non-Technical Onboarding (Priority: P3)

**Goal**: Rewrite each Non-Technical Onboarding page with detailed explanations, real-world examples, and context — sufficient for a non-technical team member to understand the product without a live walkthrough.

**Independent Test**: Have a new project manager read through the Non-Technical Onboarding section and explain the product's purpose, key terms, and user workflows to a colleague without prior walkthrough.

### Implementation for User Story 3

- [X] T012 [P] [US3] Enrich `Product Overview` page (ID `8749089`) in Confluence:UD/Non-Technical Onboarding/Product Overview — read current content, rewrite with: detailed description of the Mental Health Global platform mission, each user type (clients seeking mental health support, therapists providing care, administrators managing the system) with real-world examples of how they use the platform, the two main interfaces (chat for therapy sessions, workbench for administration and review), product value proposition with concrete impact examples; zero code or technical details (FR-005) — MTB-293
- [X] T013 [P] [US3] Enrich `Key Terminology` page (ID `8847399`) in Confluence:UD/Non-Technical Onboarding/Key Terminology — read current content, rewrite with comprehensive glossary: each term includes a clear plain-language definition, context for when the term is encountered in the product, and a concrete usage example; terms to cover: chat session, workbench, group, space, review, supervision, OTP login, therapist assignment, client, administrator, session rating, conversation history, release, deployment (FR-005) — MTB-294
- [X] T014 [P] [US3] Enrich `User Workflows` page (ID `9011367`) in Confluence:UD/Non-Technical Onboarding/User Workflows — read current content, rewrite with detailed journey narratives: (a) Client workflow — from first login through starting a chat session, having a conversation, and viewing history; (b) Therapist workflow — logging in, reviewing assigned sessions, providing supervision notes; (c) Administrator workflow — managing users and groups, reviewing sessions, configuring system settings; each workflow with all decision points and expected outcomes; no code references (FR-005) — MTB-295
- [X] T015 [P] [US3] Enrich `Navigating the System` page (ID `9043969`) in Confluence:UD/Non-Technical Onboarding/Navigating the System — read current content, rewrite with: main navigation areas in the chat interface, main navigation areas in the workbench, how to switch between interfaces, where to find key features (user management, session review, settings), how the system is organized from a user's perspective; include descriptive guidance without screenshots or code (FR-005) — MTB-296
- [X] T016 [US3] Update `Non-Technical Onboarding` section root page (ID `8814593`) in Confluence:UD/Non-Technical Onboarding — verify links to all four child pages, update section description to reflect enriched content — MTB-297

**Checkpoint**: Non-Technical Onboarding section has zero code references, CLI commands, or implementation details. Every term in Key Terminology has definition, context, and example.

---

## Phase 5: User Story 4 — Enrich Technical Onboarding (Priority: P4)

**Goal**: Rewrite each Technical Onboarding page with concrete commands, expected outputs, and troubleshooting steps — sufficient for a new developer to set up their environment and start contributing without asking existing team members.

**Independent Test**: Have a new developer follow the Technical Onboarding section to set up their local environment from scratch and run the application without needing to ask for missing steps.

### Implementation for User Story 4

- [X] T017 [P] [US4] Enrich `Architecture Overview` page (ID `8781844`) in Confluence:UD/Technical Onboarding/Architecture Overview — read current content, rewrite with: detailed data flow between all system components (Express.js backend → PostgreSQL, React frontend → backend API, Dialogflow CX integration, GCP Cloud Run deployment), split-repository model rationale, how each repository fits into the architecture, key integration points (auth flow, chat message flow, session management), cross-references to per-repo CLAUDE.md files (FR-006) — MTB-298
- [X] T018 [P] [US4] Enrich `Repository Structure` page (ID `8781863`) in Confluence:UD/Technical Onboarding/Repository Structure — read current content, rewrite with: all split repositories listed with role, status (Active/Legacy), key directories, primary files, and links to each repo's CLAUDE.md or AGENTS.md; include `chat-backend`, `chat-frontend`, `chat-ui`, `chat-types`, `chat-ci`, `chat-infra`, `client-spec`, `chat-client` (Legacy); describe the dependency flow between repos (FR-006) — MTB-299
- [X] T019 [P] [US4] Enrich `Local Development Setup` page (ID `8683524`) in Confluence:UD/Technical Onboarding/Local Development Setup — read current content, rewrite with: exact prerequisites (Node.js version, PostgreSQL, GITHUB_TOKEN), step-by-step setup for each repo with concrete shell commands, expected terminal output for each command, environment variable configuration (DATABASE_URL, JWT_SECRET, DIALOGFLOW_PROJECT_ID, etc.), database setup and migration commands, how to run each service locally, troubleshooting section for common setup failures (port conflicts, missing env vars, DB connection errors) (FR-006) — MTB-300
- [X] T020 [P] [US4] Enrich `CI/CD Pipelines` page (ID `8978454`) in Confluence:UD/Technical Onboarding/CI-CD Pipelines — read current content, rewrite with: GitHub Actions workflow files in `chat-ci`, how workflows are consumed by other repos via `uses:` references, the deploy flow to GCP Cloud Run (build → push → deploy → smoke), branch strategy (develop → release/* → main), how to trigger deployments, how to read workflow logs, troubleshooting common CI failures (FR-006) — MTB-301
- [X] T021 [P] [US4] Enrich `Coding Conventions` page (ID `8749108`) in Confluence:UD/Technical Onboarding/Coding Conventions — read current content, rewrite with: TypeScript strict mode standards, ESLint and Prettier configuration and usage, Vitest for unit tests (backend and frontend patterns), Playwright for E2E tests in `chat-ui`, commit message conventions, PR review process and checklist, code organization patterns used across repos (FR-006) — MTB-302
- [X] T022 [P] [US4] Enrich `Debugging Guide` page (ID `8978476`) in Confluence:UD/Technical Onboarding/Debugging Guide — read current content, rewrite with step-by-step diagnostic paths for common issues: (a) OTP flow — where to find OTP in dev console, what to check if OTP fails; (b) Dialogflow connectivity — verify project ID, check API credentials, test connection; (c) CORS errors — identify origin mismatches, configure allowed origins; (d) DB connection — verify DATABASE_URL, check PostgreSQL service, test with psql; (e) Frontend build errors — check node_modules, verify env vars, clear cache; each path with expected observations at each diagnostic step (FR-006) — MTB-303
- [X] T023 [US4] Update `Technical Onboarding` section root page (ID `8847361`) in Confluence:UD/Technical Onboarding — verify links to all six child pages, update section description to reflect enriched content — MTB-304

**Checkpoint**: Technical Onboarding has concrete commands with expected outputs for every procedure. CLAUDE.md cross-references are correct. A new developer can follow Local Development Setup end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate all enriched content against quality standards, update homepage, and close Jira tracking.

- [X] T024 Validate zero `[SCREENSHOT]` placeholders remain — read Getting Started (ID `8945665`), Chat Interface Guide (ID `8847380`), and Workbench Guide (ID `8978433`) via `getConfluencePage` and confirm no `[SCREENSHOT:` markers exist in content — MTB-305
- [X] T025 Validate User Manual detail standard — review each User Manual page and confirm it covers all five criteria: purpose, navigation path, interactive elements, numbered workflows, tips/warnings (SC-002) — MTB-306
- [X] T026 Validate Non-Technical Onboarding quality — review all four pages for code references, CLI commands, or developer jargon and flag/remove any violations (SC-003) — MTB-307
- [X] T027 Validate Technical Onboarding cross-references — confirm all CLAUDE.md and AGENTS.md links in Repository Structure page (ID `8781863`) point to correct files (SC-004) — MTB-308
- [X] T028 Update space homepage (ID `8454317`) via `updateConfluencePage` — verify section descriptions reflect enriched content, confirm all navigation links are correct — MTB-309
- [X] T029 Add completion summary comment to Jira Epic MTB-251 with implementation outcome, validation results, and links to updated Confluence pages — MTB-310

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 — Screenshot Capture (Phase 2)**: Depends on Phase 1 (dev environment must be accessible)
- **US2 — User Manual (Phase 3)**: Depends on Phase 2 (screenshots must be captured before embedding)
- **US3 — Non-Technical Onboarding (Phase 4)**: Depends on Phase 1 only — can run in parallel with Phase 2 and Phase 3
- **US4 — Technical Onboarding (Phase 5)**: Depends on Phase 1 only — can run in parallel with Phases 2–4
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 — Screenshot Capture (P1)**: Depends on T001 (dev accessible). No dependencies on other stories.
- **US2 — User Manual (P2)**: Depends on US1 completion (screenshots needed for embedding). No dependencies on US3/US4.
- **US3 — Non-Technical Onboarding (P3)**: No dependencies on other stories. Can start after Phase 1.
- **US4 — Technical Onboarding (P4)**: No dependencies on other stories. Can start after Phase 1.

### Within Each User Story

- Content pages marked [P] can be updated in parallel (different Confluence pages)
- Section root update task runs after all content pages are updated
- Screenshots must be captured before they can be embedded (US1 before US2)

### Parallel Opportunities

- US3 and US4 can run in parallel with US1 and US2 (different Confluence sections, no conflicts)
- All [P] content enrichment tasks within a user story can run in parallel
- T024–T028 (validation) can run in parallel after all content is updated

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify dev access)
2. Complete Phase 2: US1 (capture all 11 screenshots)
3. **STOP and VALIDATE**: Verify all screenshots are captured correctly
4. Screenshots available for embedding in US2

### Incremental Delivery

1. Setup → Dev environment verified
2. US1 (Screenshots) → 11 screenshots captured from dev
3. US2 (User Manual) → Enriched content with embedded screenshots; Release Notes updated
4. US3 (Non-Technical Onboarding) → Self-service content for PMs/support
5. US4 (Technical Onboarding) → Self-service setup for new developers
6. Polish → All validation passed, Jira closed

### Parallel Strategy

```text
After Phase 1 completes:
  Stream A: US1 (Screenshots) → US2 (User Manual enrichment)
  Stream B: US3 (Non-Technical Onboarding)
  Stream C: US4 (Technical Onboarding)
```
