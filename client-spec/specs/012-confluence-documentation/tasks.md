# Tasks: Confluence Documentation Framework

**Input**: Design documents from `/specs/012-confluence-documentation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Not applicable — this is a documentation-only feature with manual content validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All tasks use the Atlassian MCP `createConfluencePage` or `updateConfluencePage` tools. Page paths use the convention `Confluence:UD/<Section>/<Page>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different pages, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Confluence page paths in descriptions

## MCP Parameters (shared across all tasks)

| Parameter | Value |
|-----------|-------|
| `cloudId` | `3aca5c6d-161e-42c2-8945-9c47aeb2966d` |
| `spaceId` | `8454147` |
| `contentFormat` | `markdown` |
| Homepage ID | `8454317` |

---

## Phase 1: Setup (Space Homepage)

**Purpose**: Replace the default Confluence homepage with a structured overview linking to all four documentation sections.

- [X] T001 Update the space homepage — MTB-6 (page ID `8454317`) via `updateConfluencePage` in Confluence:UD/User Documentation Home — replace default boilerplate with an overview describing the four documentation sections (Release Notes, User Manual, Non-Technical Onboarding, Technical Onboarding), their audiences, and navigation links to each section root page

---

## Phase 2: Foundational (Section Root Pages)

**Purpose**: Create the four section root pages as children of the homepage. All user story content pages depend on their section root existing first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create the `Release Notes` section root page (ID: 8781825) — MTB-7 via `createConfluencePage` (parentId: `8454317`) in Confluence:UD/Release Notes — include section purpose (user-friendly summary of each production release), audience (end users, stakeholders), and a note that entries are listed in reverse chronological order
- [X] T003 [P] Create the `User Manual` section root page (ID: 8749070) — MTB-8 via `createConfluencePage` (parentId: `8454317`) in Confluence:UD/User Manual — include section purpose (step-by-step guidance for chat and workbench interfaces), audience (clients, therapists, administrators), and a table of contents linking to child pages
- [X] T004 [P] Create the `Non-Technical Onboarding` section root page (ID: 8814593) — MTB-9 via `createConfluencePage` (parentId: `8454317`) in Confluence:UD/Non-Technical Onboarding — include section purpose (product overview, workflows, terminology for non-technical team members), audience (PMs, support staff, stakeholders), and a table of contents
- [X] T005 [P] Create the `Technical Onboarding` section root page (ID: 8847361) — MTB-10 via `createConfluencePage` (parentId: `8454317`) in Confluence:UD/Technical Onboarding — include section purpose (repository structure, setup, CI/CD, conventions, debugging), audience (developers), and a table of contents linking to child pages

**Checkpoint**: All four section root pages exist under the homepage. Homepage links to all sections. Navigation verified (1 click from homepage to any section).

---

## Phase 3: User Story 1 — Release Notes Published on Production Deploy (Priority: P1) 🎯 MVP

**Goal**: Establish the Release Notes section with an initial entry demonstrating the standard format, so the team has a working template for all future production releases.

**Independent Test**: Navigate to Confluence:UD/Release Notes and verify the section root page exists with at least one child entry containing: version, date, changes, known issues, and Jira Epic link. Entries should be reachable in 2 clicks from the homepage.

### Implementation for User Story 1

- [X] T006 [US1] Create the first Release Notes entry page (ID: 8880129) — MTB-11 via `createConfluencePage` (parentId: Release Notes section root page ID) in Confluence:UD/Release Notes/Release v1.0.0 — 2026-02-22 — use the template from quickstart.md: include release version `v1.0.0`, date `2026-02-22`, What's New section listing initial documentation framework setup, Known Issues `None`, and Related Epics linking to [MTB-1](https://mentalhelpglobal.atlassian.net/browse/MTB-1)
- [X] T007 [US1] Update the `Release Notes` section root page — MTB-12 to add a link to the initial release entry and a note explaining the Release Notes entry format for future authors in Confluence:UD/Release Notes

**Checkpoint**: Release Notes section has one entry following the standard format. Stakeholders can navigate to it in 2 clicks from the homepage.

---

## Phase 4: User Story 2 — User Manual Maintained with Current Screenshots (Priority: P2)

**Goal**: Create the initial User Manual pages covering key chat and workbench workflows, written in non-technical language, ready for screenshot additions.

**Independent Test**: Navigate to Confluence:UD/User Manual and verify child pages exist for Getting Started, Chat Interface Guide, Workbench Guide, and FAQ. All content uses non-technical language. Pages are reachable in 2 clicks from the homepage (1 click to User Manual root, 1 click to specific guide).

### Implementation for User Story 2

- [X] T008 [P] [US2] Create `Getting Started` page (ID: 8945665) — MTB-13 via `createConfluencePage` (parentId: User Manual section root page ID) in Confluence:UD/User Manual/Getting Started — cover account creation, first login with OTP, and initial orientation to the chat and workbench interfaces; use non-technical language accessible to clients, therapists, and administrators; include placeholder markers `[SCREENSHOT: <description>]` where screenshots should be added later
- [X] T009 [P] [US2] Create `Chat Interface Guide` page (ID: 8847380) — MTB-14 via `createConfluencePage` (parentId: User Manual section root page ID) in Confluence:UD/User Manual/Chat Interface Guide — cover starting a new chat session, sending messages, viewing conversation history, and ending sessions; use non-technical language; include `[SCREENSHOT: <description>]` placeholders
- [X] T010 [P] [US2] Create `Workbench Guide` page (ID: 8978433) — MTB-15 via `createConfluencePage` (parentId: User Manual section root page ID) in Confluence:UD/User Manual/Workbench Guide — cover admin overview, user management, group management, session review and supervision, and settings configuration; use non-technical language; include `[SCREENSHOT: <description>]` placeholders
- [X] T011 [P] [US2] Create `FAQ` page (ID: 8814612) — MTB-16 via `createConfluencePage` (parentId: User Manual section root page ID) in Confluence:UD/User Manual/FAQ — list common questions and answers covering login issues, chat functionality, workbench navigation, and general troubleshooting; written for end users in plain language
- [X] T012 [US2] Update the `User Manual` section root page — MTB-17 to add links to all four child pages (Getting Started, Chat Interface Guide, Workbench Guide, FAQ) in Confluence:UD/User Manual

**Checkpoint**: User Manual section has four content pages in non-technical language with screenshot placeholders. All pages reachable in 2 clicks from homepage.

---

## Phase 5: User Story 3 — Non-Technical Onboarding for Team Members (Priority: P3)

**Goal**: Create Non-Technical Onboarding pages that enable PMs, support staff, and stakeholders to understand the product without developer assistance.

**Independent Test**: Have a non-technical team member read the Non-Technical Onboarding section and verify they can understand the product's purpose, terminology, and key workflows without encountering code references, CLI commands, or implementation details.

### Implementation for User Story 3

- [X] T013 [P] [US3] Create `Product Overview` page (ID: 8749089) — MTB-18 via `createConfluencePage` (parentId: Non-Technical Onboarding section root page ID) in Confluence:UD/Non-Technical Onboarding/Product Overview — describe what Mental Health Global does, who it serves (clients seeking mental health support, therapists, administrators), and the two main interfaces (chat for users, workbench for admin/review); no code or technical details
- [X] T014 [P] [US3] Create `Key Terminology` page (ID: 8847399) — MTB-19 via `createConfluencePage` (parentId: Non-Technical Onboarding section root page ID) in Confluence:UD/Non-Technical Onboarding/Key Terminology — define product terms in plain language: chat session, workbench, group, space, review, supervision, OTP login, therapist assignment, and other user-facing concepts
- [X] T015 [P] [US3] Create `User Workflows` page (ID: 9011367) — MTB-20 via `createConfluencePage` (parentId: Non-Technical Onboarding section root page ID) in Confluence:UD/Non-Technical Onboarding/User Workflows — describe key user journeys: client starting a chat, therapist reviewing sessions, administrator managing users and groups; written as narrative descriptions, not technical flow diagrams
- [X] T016 [P] [US3] Create `Navigating the System` page (ID: 9043969) — MTB-21 via `createConfluencePage` (parentId: Non-Technical Onboarding section root page ID) in Confluence:UD/Non-Technical Onboarding/Navigating the System — explain where to find things in the product: main navigation areas, how to switch between chat and workbench, and how the system is organized from a user's perspective
- [X] T017 [US3] Update the `Non-Technical Onboarding` section root page — MTB-22 to add links to all four child pages (Product Overview, Key Terminology, User Workflows, Navigating the System) in Confluence:UD/Non-Technical Onboarding

**Checkpoint**: Non-Technical Onboarding section has four content pages. Zero code references, CLI commands, or implementation details present. A non-technical reader can understand the product from these pages alone.

---

## Phase 6: User Story 4 — Technical Onboarding for New Developers (Priority: P4)

**Goal**: Create Technical Onboarding pages that enable new developers to understand the architecture, set up their environment, and start contributing.

**Independent Test**: Have a new developer follow the Technical Onboarding section to set up their local environment and verify they can understand the split-repo layout, find per-repo CLAUDE.md files, and run the application locally without asking existing team members.

### Implementation for User Story 4

- [X] T018 [P] [US4] Create `Architecture Overview` page (ID: 8781844) — MTB-23 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/Architecture Overview — describe the system architecture: Express.js backend with PostgreSQL and Dialogflow CX, React frontend with Vite, split-repository model, GCP Cloud Run deployment, and key integration points
- [X] T019 [P] [US4] Create `Repository Structure` page (ID: 8781863) — MTB-24 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/Repository Structure — list all split repositories with their roles (chat-backend, chat-frontend, chat-ui, chat-types, chat-ci, chat-infra, client-spec), status (Active/Legacy), and links to each repo's CLAUDE.md or AGENTS.md file
- [X] T020 [P] [US4] Create `Local Development Setup` page (ID: 8683524) — MTB-25 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/Local Development Setup — cover prerequisites (Node.js, PostgreSQL, GITHUB_TOKEN), environment variables (DATABASE_URL, JWT_SECRET, DIALOGFLOW_PROJECT_ID, etc.), database setup, and commands to run each service locally
- [X] T021 [P] [US4] Create `CI/CD Pipelines` page (ID: 8978454) — MTB-26 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/CI-CD Pipelines — describe GitHub Actions workflows in chat-ci, how they are consumed by other repos, the deploy flow to GCP Cloud Run, and the branch strategy (develop → release/* → main)
- [X] T022 [P] [US4] Create `Coding Conventions` page (ID: 8749108) — MTB-27 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/Coding Conventions — cover TypeScript standards, ESLint/Prettier configuration, Vitest for unit tests, Playwright for E2E, commit message conventions, and PR review process
- [X] T023 [P] [US4] Create `Debugging Guide` page (ID: 8978476) — MTB-28 via `createConfluencePage` (parentId: Technical Onboarding section root page ID) in Confluence:UD/Technical Onboarding/Debugging Guide — cover log locations (Cloud Run logs, local console), common issues (OTP flow, Dialogflow connectivity, CORS), environment-specific configs (dev vs prod), and browser console debugging for frontend
- [X] T024 [US4] Update the `Technical Onboarding` section root page — MTB-29 to add links to all six child pages (Architecture Overview, Repository Structure, Local Development Setup, CI/CD Pipelines, Coding Conventions, Debugging Guide) in Confluence:UD/Technical Onboarding

**Checkpoint**: Technical Onboarding section has six content pages. Each page references relevant split-repo CLAUDE.md/AGENTS.md files. A developer can follow the setup guide end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full documentation structure, update homepage with final links, and close out Jira tracking.

- [ ] T025 [US2] DEFERRED — Capture production screenshots and replace `[SCREENSHOT: <description>]` placeholders — MTB-30 in Confluence:UD/User Manual/Getting Started, Chat Interface Guide, and Workbench Guide — capture current production UI screenshots for login/OTP, chat sessions, messaging, conversation history, admin overview, user/group management, session review, and settings; upload as Confluence attachments and embed in pages (FR-005)
- [X] T026 Update the space homepage (page ID `8454317`) via `updateConfluencePage` in Confluence:UD/User Documentation Home — add final links to all section root pages with accurate page IDs, verify navigation structure, and ensure all four sections are prominently linked
- [X] T027 Validate 3-click navigation: verify every content page is reachable within 3 clicks from the homepage (homepage → section root → content page) in Confluence:UD
- [X] T028 Validate content quality: review User Manual and Non-Technical Onboarding pages for code references, CLI commands, or developer jargon — flag and remove any violations in Confluence:UD/User Manual and Confluence:UD/Non-Technical Onboarding
- [X] T029 Validate Technical Onboarding references: confirm all CLAUDE.md and AGENTS.md links are correct and point to existing files in Confluence:UD/Technical Onboarding/Repository Structure
- [X] T030 Run quickstart.md validation: verify Release Notes entry matches the template format defined in specs/012-confluence-documentation/quickstart.md
- [X] T031 Transition completed Jira Tasks/Stories and add result comments via Atlassian MCP
- [X] T032 Add completion summary comment to Jira Epic MTB-1 with evidence references and outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (homepage must exist before creating child pages) — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Phase 2 (section root pages must exist before creating content pages)
  - User stories can proceed in parallel (different sections, no conflicts)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 — Release Notes (P1)**: Depends on T002 (Release Notes section root). No dependencies on other stories.
- **US2 — User Manual (P2)**: Depends on T003 (User Manual section root). No dependencies on other stories.
- **US3 — Non-Technical Onboarding (P3)**: Depends on T004 (Non-Technical Onboarding section root). No dependencies on other stories.
- **US4 — Technical Onboarding (P4)**: Depends on T005 (Technical Onboarding section root). No dependencies on other stories.

### Within Each User Story

- Content pages marked [P] can be created in parallel (different Confluence pages)
- Section root update task runs after all content pages are created (needs page IDs)
- No test-before-implementation pattern (content is created, then validated in Polish phase)

### Parallel Opportunities

- All four section root pages (T002–T005) can be created in parallel
- All content pages within a user story marked [P] can be created in parallel
- All four user stories can run in parallel (different Confluence sections)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (homepage update)
2. Complete Phase 2: Foundational (create section root pages)
3. Complete Phase 3: User Story 1 (Release Notes)
4. **STOP and VALIDATE**: Verify Release Notes entry exists with correct format
5. Team can start publishing Release Notes on future production deploys

### Incremental Delivery

1. Setup + Foundational → Navigation structure ready
2. Add US1 (Release Notes) → MVP — release cadence established
3. Add US2 (User Manual) → End users have self-service documentation
4. Add US3 (Non-Technical Onboarding) → PMs/support can self-onboard
5. Add US4 (Technical Onboarding) → New developers can self-onboard
6. Each story adds value independently

### Parallel Strategy

All four user stories operate on different Confluence sections with zero conflict:

```text
After Phase 2 completes:
  Author A: US1 (Release Notes) — T006–T007
  Author B: US2 (User Manual) — T008–T012
  Author C: US3 (Non-Technical Onboarding) — T013–T017
  Author D: US4 (Technical Onboarding) — T018–T024
```

---

## Notes

- All tasks use the Atlassian MCP (`plugin-atlassian-atlassian`) for Confluence page creation/updates
- Page IDs for section roots will be captured during Phase 2 and used as `parentId` in Phase 3+ tasks
- Screenshots for User Manual are created as placeholders during initial page creation (T008–T010) and replaced with production screenshots in T025 (MTB-30)
- Content should be sourced from the product knowledge summarized in research.md and the CLAUDE.md files referenced in plan.md
