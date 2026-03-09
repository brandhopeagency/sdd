# Implementation Plan: User & Chat Tagging for Review Filtering

**Branch**: `010-chat-review-tagging` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-chat-review-tagging/spec.md`

## Summary

Extend the Chat Moderation & Review System (spec 002) with user and chat tagging capabilities that enable automatic exclusion of test-user sessions and short chats from the review queue. Add tag-based filtering to the review queue UI, an "Excluded" audit view, and admin tag management. Implementation spans `chat-types`, `chat-backend`, `chat-frontend`, and their monorepo equivalents in `chat-client`, with a new PostgreSQL migration for tag-related tables.

**Key context**: The review system is already substantially scaffolded (spec 002). This feature is additive — new tables, new API endpoints, new UI components, and modifications to existing review queue filtering logic. No changes to core review scoring, flagging, or deanonymization workflows.

## Technical Context

**Language/Version**: TypeScript 5.x (backend: Node.js + Express 5, frontend: React 18 + Vite)
**Primary Dependencies**:
- Backend: Express 5.1, `pg` 8.x, `@mentalhelpglobal/chat-types` ^1.1.0
- Frontend: React 18.3, `zustand` 5.x, `i18next` 23.x, `lucide-react`, `tailwindcss` 3.x
- Shared: `@mentalhelpglobal/chat-types` (published via GitHub Packages)
**Storage**: PostgreSQL (Cloud SQL) — new migration 015 for tag tables + review_configuration extension
**Testing**: Vitest (backend + frontend unit), React Testing Library (frontend), Playwright (E2E in `chat-ui`)
**Target Platform**: GCP Cloud Run (backend), GCS static hosting (frontend)
**Project Type**: Web application (frontend + backend + shared types)
**Performance Goals**: Tag filters <1s (SC-004, SC-008), exclusion processing <1s per session (SC-001)
**Constraints**: GDPR + Ukrainian DPL compliance inherited from spec 002; full i18n in uk/en/ru (Constitution VI)
**Scale/Scope**: Extends existing review system; tag volume estimated low (10s of tag definitions, 100s of user-tag assignments, 1000s of session-tag assignments)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First Development | PASS | `spec.md` complete with 5 user stories, 18 FRs, 8 SCs, 2 clarifications |
| II | Multi-Repository Orchestration | PASS | Plan targets `chat-types`, `chat-backend`, `chat-frontend`, `chat-ui`, `chat-client` |
| III | Test-Aligned Development | PASS | Vitest (backend/frontend), RTL (frontend), Playwright (E2E) — existing patterns |
| IV | Branch and Integration Discipline | PASS | Branch `010-chat-review-tagging` exists; target: `develop` |
| V | Privacy and Security First | PASS | Tags do not contain PII; user tags managed by admin/moderator only; audit logging via existing infrastructure |
| VI | Accessibility and Internationalization | PASS | Tag names displayed in UI require i18n for labels/buttons; tag values are user-defined strings (not translated) |
| VII | Dual-Target Implementation Discipline | PASS | All changes planned for both split repos and `chat-client` monorepo |
| VIII | GCP CLI Infrastructure Management | PASS | No new infra resources needed; uses existing Cloud SQL + Cloud Run |

**Gate result: PASS** — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/010-chat-review-tagging/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
│   └── tags-api.yaml    # Tag management & filtering API
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Shared types
chat-types/src/
├── tags.ts              # NEW — Tag entity types, TagDefinition, UserTag, ChatTag, ExclusionRecord
├── review.ts            # MODIFY — Add tag filter params to queue query types
├── reviewConfig.ts      # MODIFY — Add minMessageThreshold to ReviewConfiguration
└── rbac.ts              # MODIFY — Add TAG_MANAGE, TAG_ASSIGN permissions

# Backend (split repo)
chat-backend/src/
├── routes/
│   ├── admin.tags.ts            # NEW — Tag definition CRUD (admin)
│   ├── admin.userTags.ts        # NEW — User tag assignment (admin/moderator)
│   ├── review.sessionTags.ts    # NEW — Session tag management (moderator)
│   └── review.queue.ts          # MODIFY — Add tag filter, excluded view, short-chat exclusion
├── services/
│   ├── tagDefinition.service.ts      # NEW — Tag CRUD logic
│   ├── userTag.service.ts            # NEW — User-tag assignment logic
│   ├── sessionTag.service.ts         # NEW — Session-tag management logic
│   ├── sessionExclusion.service.ts   # NEW — Exclusion evaluation and recording
│   └── reviewQueue.service.ts        # MODIFY — Integrate tag filtering and exclusion
├── middleware/
│   └── reviewAuth.ts                 # MODIFY — Add tag permissions
└── db/
    └── migrations/
        └── 015_add_tagging_system.sql   # NEW — Tag tables, config extension, seed data

# Frontend (split repo)
chat-frontend/src/
├── features/workbench/review/
│   ├── ReviewQueueView.tsx      # MODIFY — Add tag filter, excluded tab
│   ├── ReviewSessionView.tsx    # MODIFY — Display session tags, add/remove tags
│   ├── components/
│   │   ├── TagFilter.tsx        # NEW — Tag multi-select filter for queue
│   │   ├── TagBadge.tsx         # NEW — Tag display chip/badge component
│   │   ├── TagInput.tsx         # NEW — Combobox for selecting/creating tags
│   │   ├── ExcludedTab.tsx      # NEW — Excluded sessions view
│   │   └── SessionCard.tsx      # MODIFY — Display tags on session cards
│   ├── TagManagementPage.tsx    # NEW — Admin tag CRUD page
│   └── UserTagPanel.tsx         # NEW — User profile tag assignment panel
├── services/
│   └── tagApi.ts                # NEW — Tag API client
├── stores/
│   └── reviewStore.ts           # MODIFY — Add tag filter state, excluded sessions
├── types/
│   └── review.ts                # MODIFY — Add tag types
└── locales/
    ├── en/review.json           # MODIFY — Add tag-related i18n keys
    ├── uk/review.json           # MODIFY — Add tag-related i18n keys
    └── ru/review.json           # MODIFY — Add tag-related i18n keys

# E2E tests
chat-ui/tests/e2e/
└── review/
    └── tagging.spec.ts          # NEW — Tag management and filtering E2E tests

# Monorepo equivalents (dual-target per Constitution VII)
chat-client/
├── server/src/                  # ≡ chat-backend/src/
├── src/                         # ≡ chat-frontend/src/
├── src/types/                   # ≡ chat-types/src/ (shared)
└── tests/e2e/                   # ≡ chat-ui/tests/e2e/
```

**Structure Decision**: Web application (same as spec 002). All tagging code is additive to existing Express + React + review module structure. No new projects or repositories needed. New files are co-located with existing review feature code.

## Cross-Repository Dependencies

### Execution Order

```
1. chat-types      → Add tag types, extend review config type, add permissions
2. chat-backend    → Add migration 015, new routes/services, modify queue service
3. chat-frontend   → Add tag components, modify queue view, add tag management page
4. chat-ui         → Add tagging E2E tests
5. chat-client     → Mirror all changes (dual-target)
```

### Inter-repo Dependencies

| From | To | Dependency |
|------|----|------------|
| `chat-types` | `chat-backend`, `chat-frontend`, `chat-client` | Tag types and permission constants must be published first |
| `chat-backend` | `chat-frontend` | Tag API endpoints must be available for frontend to consume |
| `chat-frontend` | `chat-ui` | Tag UI must be deployed for E2E tests |

## Key Implementation Decisions

### Session Exclusion Strategy

Exclusion is evaluated at **session ingestion time** (when a completed chat session enters the review pipeline). The review queue service checks:
1. Does the originating user have any tag with "exclude from reviews" behavior? → Exclude and create ExclusionRecord.
2. Does the session have fewer than `minMessageThreshold` user+AI messages? → Tag as "short", exclude, and create ExclusionRecord.

Excluded sessions are stored normally but marked with ExclusionRecords. The review queue query filters them out by default and includes them when the "Excluded" tab is active.

### Tag Filtering in Review Queue

The existing `GET /api/review` endpoint (review queue) is extended with:
- `tags` query parameter — comma-separated tag names for inclusion filter
- `excluded` query parameter — `true` to show excluded sessions only
- Default behavior: exclude sessions with ExclusionRecords unless `excluded=true` or specific tags are requested

### Ad-hoc Tag Creation

When a moderator types a new tag name while tagging a session (FR-011), the backend:
1. Checks for existing TagDefinition with that name (case-insensitive)
2. If not found, creates a new TagDefinition with category `chat`, `excludeFromReviews: false`, `createdBy: moderator`
3. Applies the tag to the session

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VII. Dual-target batch mirroring (Phase 8) instead of per-task mirroring | Split-repo implementation is completed and verified first (Phases 1-7), then batch-mirrored to `chat-client` monorepo in Phase 8 (T039-T043). This avoids context-switching between repo structures during active development and ensures split-repo changes are coherent before replicating. | Per-task mirroring would require switching between split repos and monorepo after every task, doubling context load and increasing the risk of partial/inconsistent monorepo state during development. The batch approach guarantees parity at the feature level, not the task level, while still completing dual-target delivery before merge. |
