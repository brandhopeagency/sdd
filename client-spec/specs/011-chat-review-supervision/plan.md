# Implementation Plan: Chat Review Supervision & Group Management Enhancements

**Branch**: `011-chat-review-supervision` | **Date**: 2026-02-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-chat-review-supervision/spec.md`

## Summary

This feature introduces a supervisor second-level review workflow for chat moderation, with a three-column review interface, configurable supervision policies per group, grade description tooltips, flexible criteria feedback (checkbox-based), configurable reviewer counts per group, supervisor-only tag creation, new queue tabs for supervision pipeline visibility, RAG call detail transparency, and inline new-user creation during group member addition. Changes span shared types, backend APIs, the workbench frontend (reviewer/admin), the chat frontend (end-user), and E2E tests.

## Technical Context

**Language/Version**: TypeScript 5.6 (frontend) / 5.9 (backend), Node.js 24.x  
**Primary Dependencies**: Express.js 5.1 (backend), React 18.3 + Vite 5 + Tailwind CSS 3 + Zustand 5 + React Router 6 (frontend), i18next (i18n)  
**Storage**: PostgreSQL (Cloud SQL) via `pg`  
**Testing**: Vitest 4 + React Testing Library (unit), Playwright 1.57 (E2E)  
**Target Platform**: Web (desktop/tablet/mobile responsive), GCP Cloud Run  
**Project Type**: Multi-repository web application  
**Performance Goals**: Queue views load <1s, review submission <500ms, supervisor review completion <5 min average  
**Constraints**: GDPR + Ukrainian data protection compliance, WCAG AA accessibility, uk/en/ru localization  
**Scale/Scope**: 100+ concurrent reviewers, supervision queue adds proportional load based on per-group policy

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

### Constitution Compliance Notes

- **Split-repo first (VII)**: All changes target split repos only. `workbench-frontend` is included as the reviewer/admin UI host (not listed in constitution's repo table but is an active split repo).
- **Types first (VII)**: New types (`chat-types`) published before backend/frontend consume them.
- **Branch discipline (IV)**: Feature branch `011-chat-review-supervision` created in all affected repos from `develop`.
- **Privacy (V)**: Supervisor reviews inherit existing anonymization; supervisor sees anonymized user IDs only.
- **Accessibility (VI)**: Three-column layout includes keyboard navigation, focus management, and screen reader labels. All new text keys added to uk/en/ru.
- **Responsive/PWA (IX)**: Three-column supervisor view collapses to tabbed layout on mobile/tablet. All new views tested at 320px, 768px, 1024px+ breakpoints.
- **Post-deploy smoke**: Supervision queue endpoint, supervisor review submit, grade description fetch, group user creation, RAG detail fetch verified post-deploy.

## Project Structure

### Documentation (this feature)

```text
specs/011-chat-review-supervision/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
│   ├── supervision-api.yaml
│   ├── grade-description-api.yaml
│   ├── reviewer-config-api.yaml
│   ├── rag-detail-api.yaml
│   └── group-user-creation-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-types/                          # Shared types (@mentalhelpglobal/chat-types)
├── src/
│   ├── rbac.ts                      # Add SUPERVISOR role, new permissions
│   ├── review.ts                    # Add SupervisorReview, RAGCallDetail types
│   ├── reviewConfig.ts              # Add supervision policy, grade descriptions
│   ├── tags.ts                      # Add tag creation permission type
│   └── index.ts                     # Export new types

chat-backend/                        # Express.js API
├── src/
│   ├── db/migrations/
│   │   ├── xxx_add_supervisor_reviews.sql
│   │   ├── xxx_add_grade_descriptions.sql
│   │   ├── xxx_add_supervision_policy.sql
│   │   └── xxx_add_rag_call_details.sql
│   ├── routes/
│   │   ├── review.supervision.ts    # NEW: supervisor review endpoints
│   │   ├── review.gradeDescriptions.ts # NEW: grade description CRUD
│   │   ├── review.sessions.ts       # MODIFY: criteria checkbox logic
│   │   ├── review.queue.ts          # MODIFY: awaiting supervision tab
│   │   ├── review.sessionTags.ts    # MODIFY: restrict tag creation by role
│   │   ├── admin.reviewConfig.ts    # MODIFY: per-group reviewer count + supervision policy
│   │   ├── chat.ts                  # MODIFY: include RAG details for testers
│   │   └── group.ts                 # MODIFY: add new user creation flow
│   ├── services/
│   │   ├── supervision.service.ts   # NEW: supervision workflow logic
│   │   ├── gradeDescription.service.ts # NEW: grade description CRUD
│   │   ├── review.service.ts        # MODIFY: criteria flexibility
│   │   ├── reviewQueue.service.ts   # MODIFY: supervision queue filtering
│   │   ├── reviewConfig.service.ts  # MODIFY: per-group config
│   │   ├── ragDetail.service.ts     # NEW: RAG metadata retrieval
│   │   └── group.service.ts         # MODIFY: inline user creation
│   └── middleware/
│       └── reviewAuth.ts            # MODIFY: supervisor role checks

workbench-frontend/                  # Reviewer/Admin UI
├── src/
│   ├── features/workbench/review/
│   │   ├── SupervisorReviewView.tsx  # NEW: 3-column supervisor interface
│   │   ├── SupervisorQueueTab.tsx    # NEW: Awaiting Supervision tab
│   │   ├── AwaitingFeedbackTab.tsx   # NEW: Reviewer awaiting feedback tab
│   │   ├── ReviewQueueView.tsx       # MODIFY: add new tabs
│   │   ├── ReviewSessionView.tsx     # MODIFY: RAG details panel
│   │   ├── ReviewConfigPage.tsx      # MODIFY: per-group config UI
│   │   ├── TagManagementPage.tsx     # MODIFY: restrict creation by role
│   │   └── components/
│   │       ├── SupervisorCommentPanel.tsx   # NEW
│   │       ├── ReviewerAssessmentColumn.tsx # NEW
│   │       ├── GradeTooltip.tsx             # NEW: score description tooltip
│   │       ├── CriteriaFeedbackForm.tsx     # MODIFY: checkbox + optional comments
│   │       ├── ScoreSelector.tsx            # MODIFY: add help icon
│   │       ├── RAGDetailPanel.tsx           # NEW: expandable RAG details
│   │       └── TagInput.tsx                 # MODIFY: hide create for reviewers
│   ├── features/workbench/group/
│   │   └── GroupUsersView.tsx        # MODIFY: inline new user creation
│   ├── features/workbench/users/
│   │   └── CreateUserModal.tsx       # MODIFY: support inline creation from group context
│   └── stores/
│       ├── supervisionStore.ts       # NEW: supervision state management
│       └── reviewStore.ts            # MODIFY: criteria flexibility state

chat-frontend/                       # End-user chat
├── src/
│   └── features/chat/
│       ├── MessageBubble.tsx         # MODIFY: add RAG details toggle for testers
│       └── components/
│           └── RAGDetailPanel.tsx    # NEW: shared RAG detail component

chat-ui/                             # E2E tests (Playwright)
├── tests/e2e/
│   ├── review/
│   │   ├── supervision-flow.spec.ts       # NEW: supervisor approve/disapprove/return
│   │   ├── grade-tooltip.spec.ts          # NEW: tooltip visibility
│   │   ├── criteria-checkbox.spec.ts      # NEW: flexible criteria
│   │   └── rag-details.spec.ts            # NEW: RAG panel in review
│   ├── workbench/
│   │   └── reviewer-config.spec.ts        # NEW: per-group config
│   └── groups/
│       └── add-new-user.spec.ts           # NEW: inline user creation
│   └── fixtures/
│       └── roles.ts                       # MODIFY: add supervisor role
```

**Structure Decision**: Multi-repository web application. The workbench admin/reviewer UI lives in `workbench-frontend` (separate from `chat-frontend` which is the end-user chat). Shared types go through `chat-types` first. Backend API is in `chat-backend`. E2E tests in `chat-ui`.

## Cross-Repository Execution Order

1. **chat-types** — Add new types, enums, permissions (Supervisor role, supervision types, RAG detail types, grade description types). Bump version.
2. **chat-backend** — Database migrations, new routes/services, modify existing routes. Update `chat-types` dependency.
3. **workbench-frontend** — New supervisor views, modified review components, config UI. Update `chat-types` dependency.
4. **chat-frontend** — RAG detail panel for testers. Update `chat-types` dependency.
5. **chat-ui** — New E2E tests for supervision flow, grade tooltips, criteria checkboxes, RAG details, group user creation. Add supervisor test role.

## Test Strategy

| Repository | Test Type | Framework | Scope |
|------------|-----------|-----------|-------|
| chat-types | Unit | Vitest | Permission helper functions, role-permission mapping |
| chat-backend | Unit | Vitest + Supertest | Supervision service, grade description CRUD, reviewer config per-group, group user creation, tag creation permission checks |
| workbench-frontend | Unit | Vitest + RTL | SupervisorReviewView rendering, GradeTooltip display, CriteriaFeedbackForm checkbox behavior, RAGDetailPanel expand/collapse |
| chat-frontend | Unit | Vitest + RTL | RAG detail toggle for testers, hidden for non-testers |
| chat-ui | E2E | Playwright | Full supervision flow, grade tooltips, criteria checkboxes, RAG details, per-group config, group user creation |

### E2E Test Roles

Existing roles used: `qa` (reviewer), `owner` (admin), `moderator`, `group_admin`  
New role required: `supervisor` — added to `chat-ui/tests/e2e/fixtures/roles.ts` with email `e2e-supervisor@test.local`

### Responsive Testing

- Three-column supervisor view tested at: 320px (mobile, stacked), 768px (tablet, tabbed), 1024px+ (desktop, 3-column)
- Grade tooltip tested on hover (desktop) and tap (mobile)
- Awaiting Supervision/Feedback tabs tested across breakpoints

### Post-Deploy Smoke Checks

- `GET /api/review/supervision/queue` — returns supervision queue
- `POST /api/review/supervision/:reviewId/decision` — supervisor can approve/disapprove
- `GET /api/review/grade-descriptions` — returns 10 grade descriptions
- `POST /api/group/users` with new user email — creates user and adds to group
- `GET /api/chat/sessions/:id/messages` with tester tag — includes RAG metadata

## Complexity Tracking

No constitution violations to justify. All changes fit within existing patterns.
