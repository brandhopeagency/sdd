# Implementation Plan: Chat Moderation and Review System

**Branch**: `003-chat-moderation-review` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-chat-moderation-review/spec.md`

## Summary

Deliver a full moderation-review workflow for anonymized AI chat sessions across queueing, per-message scoring, multi-review resolution, risk escalation, governed deanonymization, and reviewer/admin dashboards. Implementation targets split repositories and extends the existing review foundation defined in earlier specs with complete role-based workflows, auditable decision paths, and SLA-aware escalation handling.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 backend, React 18 frontend)  
**Primary Dependencies**:
- Backend: Express, Zod validation, role-permission middleware, internal notification/email services
- Frontend: React, routing, state store, i18n, shared review UI components
- Shared: `@mentalhelpglobal/chat-types` for contracts and RBAC constants
**Storage**: PostgreSQL (review lifecycle tables, ratings, flags, deanonymization requests, audit events)  
**Testing**: Vitest (backend/frontend unit), React Testing Library (frontend), Playwright (chat-ui E2E)  
**Target Platform**: GCP Cloud Run services + web client deployment  
**Project Type**: Web application (split backend/frontend/types/ui repositories)  
**Performance Goals**:
- Review queue load under 1 second for normal reviewer workloads
- Session review view load under 2 seconds for average transcript size
- Review submission and flag submission acknowledged in under 500ms for 95% of requests
**Constraints**:
- Privacy-first: anonymization by default and role-gated deanonymization
- Regulatory alignment: GDPR and HIPAA-aligned controls
- Accessibility: WCAG AA support for reviewer interfaces
- Internationalization: all reviewer-facing text available in `uk`, `en`, `ru`
**Scale/Scope**:
- Up to 1M sessions/month and 3M+ ratings/month
- 500+ active reviewers across reviewer/senior/moderator/commander/admin roles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Gate (Pre-Research)

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First Development | PASS | `spec.md` and requirements checklist are present before planning. |
| II | Multi-Repository Orchestration | PASS | Plan explicitly targets split repos and documents execution order. |
| III | Test-Aligned Development | PASS | Uses existing Vitest/RTL/Playwright patterns per target repositories. |
| IV | Branch and Integration Discipline | PASS | Working branch `003-chat-moderation-review`; integration target remains `develop`. |
| V | Privacy and Security First | PASS | Anonymization, RBAC, audit logging, and deanonymization governance are first-class requirements. |
| VI | Accessibility and Internationalization | PASS | Accessibility and translation constraints are included in design and contracts. |
| VII | Split-Repository First | PASS | No implementation planned for legacy monorepo; split repositories are canonical targets. |
| VIII | GCP CLI Infrastructure Management | PASS | No new infra provisioning required; existing deployment model reused. |

**Gate result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/003-chat-moderation-review/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 data design
├── quickstart.md        # Phase 1 verification flow
├── contracts/           # Phase 1 API contracts
│   ├── review-api.yaml
│   ├── risk-api.yaml
│   └── admin-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
chat-types/
└── src/
    ├── review.ts
    ├── reviewConfig.ts
    └── rbac.ts

chat-backend/
└── src/
    ├── routes/
    │   ├── review.queue.ts
    │   ├── review.sessions.ts
    │   ├── review.flags.ts
    │   ├── review.deanonymization.ts
    │   ├── review.dashboard.ts
    │   └── admin.reviewConfig.ts
    ├── services/
    │   ├── reviewQueue.service.ts
    │   ├── reviewAggregation.service.ts
    │   ├── riskFlag.service.ts
    │   └── deanonymization.service.ts
    └── db/migrations/

chat-frontend/
└── src/
    ├── features/workbench/review/
    │   ├── ReviewQueueView.tsx
    │   ├── ReviewSessionView.tsx
    │   ├── ReviewDashboard.tsx
    │   ├── EscalationQueue.tsx
    │   └── DeanonymizationPanel.tsx
    ├── services/reviewApi.ts
    ├── stores/reviewStore.ts
    └── locales/{uk,en,ru}/review.json

chat-ui/
└── tests/e2e/review/
```

**Structure Decision**: Use split-repository web architecture (`chat-types` → `chat-backend` → `chat-frontend` → `chat-ui`). Repository order is dependency-driven: shared contracts first, APIs second, UI third, end-to-end verification last.

## Cross-Repository Dependencies

### Execution Order

1. `chat-types`: finalize shared types, enums, and RBAC contract updates.
2. `chat-backend`: implement queue/review/risk/deanonymization workflows and persistence rules.
3. `chat-frontend`: implement reviewer queue/session flows, risk and dashboard screens, and role-gated interactions.
4. `chat-ui`: add and pass end-to-end tests for core reviewer and escalation paths.

### Integration Dependencies

| From | To | Dependency |
|------|----|------------|
| `chat-types` | `chat-backend`, `chat-frontend` | Shared review contracts and permission constants must be consumed before implementation lock. |
| `chat-backend` | `chat-frontend` | Route payloads and validation rules define frontend API client and UI states. |
| `chat-frontend` + `chat-backend` | `chat-ui` | E2E scenarios require deployed/servable workflows across both services. |

## Post-Design Constitution Re-Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First Development | PASS | Design artifacts derive directly from approved feature spec. |
| II | Multi-Repository Orchestration | PASS | Data model and contracts explicitly map to split-repo surfaces. |
| III | Test-Aligned Development | PASS | Quickstart prescribes repository-native test suites and evidence capture points. |
| IV | Branch and Integration Discipline | PASS | Plan assumes same feature branch in all affected split repos, merge to `develop`. |
| V | Privacy and Security First | PASS | Data model includes immutable audit paths and controlled identity reveal lifecycle. |
| VI | Accessibility and Internationalization | PASS | Contracted UI flows require keyboard/screen-reader support and trilingual copy. |
| VII | Split-Repository First | PASS | No legacy-monorepo tasks defined. |
| VIII | GCP CLI Infrastructure Management | PASS | No infrastructure drift introduced by this plan. |

**Post-design gate result**: PASS

## Complexity Tracking

No constitution violations detected; no exceptions required.
