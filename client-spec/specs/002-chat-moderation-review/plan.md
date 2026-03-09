# Implementation Plan: Chat Moderation & Review System

**Branch**: `002-chat-moderation-review` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-chat-moderation-review/spec.md`

## Summary

Build a multi-reviewer chat moderation system enabling qualified therapists to evaluate AI chatbot responses for quality, safety, and therapeutic appropriateness. The system supports blinded peer review with configurable thresholds, risk flagging with SLA-based escalation, controlled deanonymization, and reviewer analytics dashboards. Implementation spans `chat-types`, `chat-backend`, `chat-frontend`, and their monorepo equivalents in `chat-client`, with PostgreSQL persistence on GCP Cloud SQL.

**Key discovery**: The review system is already substantially scaffolded across all repositories — shared types (v1.1.0), database migration (013), backend routes/services, frontend components, and i18n locales all exist. The primary work is **completing, wiring up, testing, and hardening** the existing scaffold rather than building from scratch.

## Technical Context

**Language/Version**: TypeScript 5.x (backend: Node.js + Express 5, frontend: React 18 + Vite)
**Primary Dependencies**:
- Backend: Express 5.1, `pg` 8.x, `jsonwebtoken`, `@google-cloud/storage`, `@mentalhelpglobal/chat-types` ^1.0.0
- Frontend: React 18.3, `react-router-dom` 6.x, `zustand` 5.x, `i18next` 23.x, `react-i18next` 15.x, `lucide-react`, `tailwindcss` 3.x
- Shared: `@mentalhelpglobal/chat-types` 1.1.0 (published via GitHub Packages)
**Storage**: PostgreSQL (Cloud SQL) — migration `013_add_review_system.sql` already exists with 9 tables + session ALTER
**Testing**: Vitest (backend + frontend unit), React Testing Library (frontend), Playwright (E2E in `chat-ui`)
**Target Platform**: GCP Cloud Run (backend), GCS static hosting (frontend)
**Project Type**: Web application (frontend + backend + shared types)
**Performance Goals**: Queue <1s, transcript <2s, submission <500ms, 100+ concurrent reviewers (SC-007, SC-008)
**Constraints**: 99.9% uptime (SC-013), GDPR + Ukrainian DPL compliance (CR-001–CR-004), full i18n in uk/en/ru (FR-027)
**Scale/Scope**: 100+ concurrent reviewers, ~50 sessions/day estimated, 5 user roles mapped to existing RBAC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First Development | PASS | `spec.md` complete with 9 user stories, 27 FRs, 4 CRs, 13 SCs |
| II | Multi-Repository Orchestration | PASS | Plan targets `chat-types`, `chat-backend`, `chat-frontend`, `chat-ui`, `chat-client` |
| III | Test-Aligned Development | PASS | Vitest (backend/frontend), RTL (frontend), Playwright (E2E) — existing patterns |
| IV | Branch and Integration Discipline | PASS | Branch `002-chat-moderation-review` exists; target: `develop` |
| V | Privacy and Security First | PASS | Anonymization, deanonymization, audit logging, GDPR+UA DPL in spec |
| VI | Accessibility and Internationalization | PASS | Full i18n (uk/en/ru), WCAG AA required; review locale files exist |
| VII | Dual-Target Implementation Discipline | PASS | All changes planned for both split repos and `chat-client` monorepo |
| VIII | GCP CLI Infrastructure Management | PASS | No new infra resources needed; uses existing Cloud SQL + Cloud Run |

**Gate result: PASS** — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-chat-moderation-review/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Shared types
chat-types/src/
├── review.ts            # Review entity types (EXISTS)
├── reviewConfig.ts      # Config types and enums (EXISTS)
├── rbac.ts              # RBAC with review permissions (EXISTS)
└── entities.ts          # Base entities, Session with review fields (EXISTS)

# Backend (split repo)
chat-backend/src/
├── routes/
│   ├── review.queue.ts          # Queue & assignment endpoints (EXISTS)
│   ├── review.sessions.ts       # Session review workflow (EXISTS)
│   ├── review.flags.ts          # Risk flag CRUD (EXISTS)
│   ├── review.deanonymization.ts # Deanonymization workflow (EXISTS)
│   ├── review.dashboard.ts      # Dashboard stats (EXISTS)
│   ├── review.notifications.ts  # Notification endpoints (EXISTS)
│   ├── review.reports.ts        # Report generation (EXISTS)
│   └── admin.reviewConfig.ts    # Config management (EXISTS)
├── services/
│   ├── review.service.ts          # Core review logic (EXISTS)
│   ├── reviewQueue.service.ts     # Queue management (EXISTS)
│   ├── reviewScoring.service.ts   # Scoring & tiebreaker (EXISTS)
│   ├── riskFlag.service.ts        # Risk flags (EXISTS)
│   ├── deanonymization.service.ts # Deanonymization (EXISTS)
│   ├── anonymization.service.ts   # Anonymous mapping (EXISTS)
│   ├── crisisDetection.service.ts # Crisis keyword detection (EXISTS)
│   ├── reviewDashboard.service.ts # Dashboard stats (EXISTS)
│   ├── reviewNotification.service.ts # Notifications (EXISTS)
│   ├── reviewReport.service.ts    # Report generation (EXISTS)
│   └── reviewConfig.service.ts    # Config CRUD (EXISTS)
├── middleware/
│   └── reviewAuth.ts              # Review-specific auth (EXISTS)
├── types/
│   └── review.types.ts            # Backend-specific types (EXISTS)
└── db/
    └── migrations/
        └── 013_add_review_system.sql  # Schema migration (EXISTS)

# Frontend (split repo)
chat-frontend/src/
├── features/workbench/review/
│   ├── ReviewQueueView.tsx        # Queue page (EXISTS)
│   ├── ReviewSessionView.tsx      # Session review page (EXISTS)
│   ├── ReviewRatingPanel.tsx      # Rating interface (EXISTS)
│   ├── ReviewDashboard.tsx        # Personal dashboard (EXISTS)
│   ├── TeamDashboard.tsx          # Team dashboard (EXISTS)
│   ├── ReviewConfigPage.tsx       # Admin config (EXISTS)
│   ├── DeanonymizationPanel.tsx   # Deano workflow (EXISTS)
│   ├── EscalationQueue.tsx        # Moderator escalation (EXISTS)
│   ├── RiskFlagDialog.tsx         # Flag submission (EXISTS)
│   ├── ReviewErrorBoundary.tsx    # Error handling (EXISTS)
│   └── components/
│       ├── BannerAlerts.tsx       # Role-based banners (EXISTS)
│       ├── CriteriaFeedbackForm.tsx # Criteria input (EXISTS)
│       ├── NotificationBell.tsx   # Notification icon (EXISTS)
│       ├── ReviewProgress.tsx     # Progress indicator (EXISTS)
│       ├── ScoreDistribution.tsx  # Score chart (EXISTS)
│       ├── ScoreSelector.tsx      # 1-10 score picker (EXISTS)
│       └── SessionCard.tsx        # Queue item card (EXISTS)
├── services/
│   └── reviewApi.ts               # Review API client (EXISTS)
├── stores/
│   └── reviewStore.ts             # Zustand review store (EXISTS)
├── types/
│   └── review.ts                  # Frontend review types (EXISTS)
└── locales/
    ├── en/review.json             # English review i18n (EXISTS)
    ├── uk/review.json             # Ukrainian review i18n (EXISTS)
    └── ru/review.json             # Russian review i18n (EXISTS)

# E2E tests
chat-ui/tests/e2e/
└── review/                        # NEW - Playwright E2E tests

# Monorepo equivalents (dual-target per Constitution VII)
chat-client/
├── server/src/                    # ≡ chat-backend/src/
├── src/                           # ≡ chat-frontend/src/
├── src/types/                     # ≡ chat-types/src/ (shared)
└── tests/e2e/                     # ≡ chat-ui/tests/e2e/
```

**Structure Decision**: Web application (Option 2). All review code is additive to existing Express + React structure. No new projects or repositories needed. Existing scaffold covers ~80% of the file structure; implementation focus is on completing service logic, wiring routes, loading i18n namespaces, and adding tests.

## Key Implementation Gaps (Scaffold → Complete)

Based on codebase exploration, these are the critical gaps between existing scaffold and spec requirements:

### Backend

1. **Route mounting**: Review routes exist in `src/routes/` but are **not imported or mounted** in `src/index.ts`
2. **Deanonymization access hours**: DB default is 24h but spec requires 72h — needs migration update
3. **Notification resilience**: FR-026 requires retry mechanism with escalating alerts when Notification Service is unavailable — not yet implemented
4. **Service completeness**: Services exist but need verification that all spec acceptance scenarios are covered
5. **Audit logging**: `AuditLogEntry.targetType` only supports `'user' | 'session' | 'message'` — needs extension for `'deanonymization' | 'review' | 'risk_flag'`

### Frontend

1. **i18n namespace loading**: Review locale files (`locales/*/review.json`) exist but are **not loaded** in `i18n.ts` — needs namespace registration
2. **Route registration**: Review pages exist but need verification they are registered in React Router
3. **Component completeness**: Components exist but need verification against all acceptance scenarios
4. **Accessibility**: WCAG AA compliance (keyboard navigation, ARIA labels, focus management, contrast ratios)

### Shared Types

1. **Audit log target types**: Need to extend `AuditLogEntry.targetType` union
2. **Notification delivery status**: May need `notificationDeliveryStatus` field on `RiskFlag` for FR-026

### Cross-cutting

1. **Dual-target sync**: All changes must be mirrored in `chat-client` monorepo
2. **E2E tests**: No review E2E tests exist yet in `chat-ui`
3. **Branch creation**: Feature branches needed in all affected repos

## Cross-Repository Dependencies

### Execution Order

```
1. chat-types      → Extend types (audit log, notification status)
2. chat-backend    → Wire routes, complete services, add migration
3. chat-frontend   → Load i18n, wire routes, complete components
4. chat-ui         → Add E2E tests
5. chat-client     → Mirror all changes (dual-target)
```

### Inter-repo Dependencies

| From | To | Dependency |
|------|----|------------|
| `chat-types` | `chat-backend`, `chat-frontend`, `chat-client` | Type updates must be published first |
| `chat-backend` | `chat-frontend` | API endpoints must be available for frontend to consume |
| `chat-frontend` | `chat-ui` | UI must be deployed for E2E tests |

## Complexity Tracking

No constitution violations to justify. All work fits within existing project structure and patterns.
