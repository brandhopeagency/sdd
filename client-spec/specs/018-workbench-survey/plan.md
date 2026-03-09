# Implementation Plan: Workbench Survey Module (MHG-SURV-001)

**Branch**: `018-workbench-survey` | **Date**: 2026-03-04 | **Spec**: `specs/018-workbench-survey/spec.md`
**Input**: Feature specification from `D:\src\MHG\client-spec\specs\018-workbench-survey\spec.md`

## Summary

Deliver a workbench-managed Survey Module that enforces a blocking pre-chat survey gate for users in targeted groups. Researchers/Admins can author schemas, deploy time-boxed instances, view responses, and **invalidate** results (instance-wide, per-group, or individual), which can re-open the gate and remove derived memory. Chat users complete surveys via a wizard with progress and a final review step.

## Technical Context

**Language/Version**:
- Backend: TypeScript (Node 20), Express
- Frontends: TypeScript + React 18, Vite

**Primary Dependencies**:
- Backend: `pg` (raw SQL), existing auth/RBAC middleware, existing GCS agent-memory module
- Frontend: Zustand, react-router-dom v6, TailwindCSS, i18next, `@dnd-kit/*`

**Storage**:
- PostgreSQL (Cloud SQL in dev/prod). New tables: `survey_schemas`, `survey_instances`, `survey_responses` (+ extensions for invalidation and group context).
- Agent memory stored in GCS (existing `agentMemory` system-message store).

**Testing**:
- Backend: Vitest
- Frontends: Vitest + RTL (where present)
- E2E: Playwright against dev deployments (manual + automated smoke where available)

**Target Platform**:
- Backend: Cloud Run
- Frontends: GCS static hosting + CDN

**Project Type**: Multi-repo web app (backend + two frontends + shared types)

**Performance Goals**:
- Gate-check p95 < 250ms for typical group sizes (dozens of instances, small response table slices)
- Memory update is asynchronous (non-blocking to user submission)

**Constraints**:
- GDPR / pseudonymity: never store raw user PK in `survey_responses`
- Schema immutability: published/archived schemas cannot be mutated
- Cloud Run scale-to-zero: background timers are not sufficient alone for time-based transitions

**Scale/Scope**:
- Schemas up to ~70 questions, instances per group per week in the dozens, responses per instance in the hundreds.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from feature branches
- [x] Required approvals and required CI checks apply per repo branch protection
- [x] Post-merge hygiene defined (delete merged branches; sync `develop`)
- [x] Responsive + PWA checks defined (desktop/tablet/mobile; installability sanity)
- [x] Post-deploy smoke checks defined (gate-check + schema/instance CRUD)
- [x] Jira Epic exists and is recorded in spec header (`MTB-405`)
- [x] Documentation impact identified (User Manual + Non-Technical onboarding likely; Release Notes at prod)
- [x] Release readiness considerations recorded (deploy workflows exist; dev verified)

## Project Structure

### Documentation (this feature)

```text
specs/018-workbench-survey/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── survey-schemas.yaml
│   ├── survey-instances.yaml
│   └── survey-gate.yaml
└── tasks.md
```

### Source Code (affected repositories / key paths)

```text
D:\src\MHG\chat-types\
  src/survey.ts
  src/rbac.ts
  src/index.ts

D:\src\MHG\chat-backend\
  src/db/migrations/024_create_survey_tables.sql
  src/services/surveySchema.service.ts
  src/services/surveyInstance.service.ts
  src/services/surveyResponse.service.ts
  src/routes/survey.schemas.ts
  src/routes/survey.instances.ts
  src/routes/survey.gate.ts
  src/services/agentMemory/agentMemory.service.ts   # extend for survey memory entries

D:\src\MHG\workbench-frontend\
  src/services/surveyApi.ts
  src/stores/surveyStore.ts
  src/services/adminApi.ts                          # groups list
  src/features/workbench/surveys/**                 # schemas/instances/responses + invalidation UI

D:\src\MHG\chat-frontend\
  src/services/surveyApi.ts
  src/stores/surveyGateStore.ts
  src/features/survey/**                            # wizard + review step
```

## Phase 0: Research (complete)

Captured in `research.md`:
- JSONB schema storage, snapshot strategy
- Status transition strategy for Cloud Run scale-to-zero (hybrid timer + inline transitions)
- Invalidation scopes and required response group context
- “Add to memory” integration approach (deterministic, replace-only per `(pseudonymousId, instanceId)`)
- Survey wizard review-step UX

## Phase 1: Design & Contracts (complete)

Artifacts:
- `data-model.md`: updated entities + invalidation + `add_to_memory` + response `group_id`
- `contracts/`: updated OpenAPI contracts for schemas, instances (+ invalidation), gate
- `quickstart.md`: updated run/deploy notes and dev validation steps

## Phase 2: Task Breakdown (next)

Run `/speckit.tasks` to:
- Add backend changes: schema/migration extensions, invalidation endpoints, response group_id capture, memory upsert/remove, gate-check invalidation semantics
- Add workbench UI changes: add-to-memory toggle, responses view + invalidation controls (instance/group/individual)
- Add chat UI changes: review step + jump-to-question editing, progress display, and persistence semantics
- Add tests/evidence tasks for dev regression and Playwright screenshots where applicable

## Complexity Tracking

No constitution violations requiring justification.
