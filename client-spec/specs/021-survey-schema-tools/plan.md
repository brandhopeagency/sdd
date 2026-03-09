# Implementation Plan: Survey Schema Tools — Autosave, Preview & Export/Import

**Branch**: `021-survey-schema-tools` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/021-survey-schema-tools/spec.md`

## Summary

Add three authoring tools to the Workbench survey schema editor: (1) debounced autosave that persists draft changes every 2 seconds via the existing PATCH endpoint, (2) a modal preview that renders the survey in gate-style layout using shared question components extracted to `chat-frontend-common`, and (3) JSON export/import for schema portability with a dedicated server-side import endpoint for validation. No new database entities; one new API endpoint; shared component extraction is the main architectural change.

## Technical Context

**Language/Version**: TypeScript 5.x (all repos)  
**Primary Dependencies**: React 18 (frontends), Express.js (backend), Vitest (testing), `@mentalhelpglobal/chat-types`, `@mentalhelpglobal/chat-frontend-common`  
**Storage**: PostgreSQL (existing `survey_schemas` table — no schema changes)  
**Testing**: Vitest (unit), Playwright in `chat-ui` (E2E)  
**Target Platform**: Web (modern browsers: Chrome, Firefox, Safari, Edge)  
**Project Type**: Web (multi-repository split architecture)  
**Performance Goals**: Autosave within 2s debounce; preview modal opens in <500ms; export/import completes in <2s for schemas up to 100 questions  
**Constraints**: No new database tables or migrations; export is client-side (no server file storage); preview is client-side (no response data persisted)  
**Scale/Scope**: 6 repositories affected; ~15–20 source files modified; 1 new API endpoint

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
- [x] Jira Epic exists for this feature with spec content in description; Jira issue key is recorded in spec.md header
- [x] Documentation impact is identified: which Confluence doc types (User Manual, Technical Onboarding, Release Notes, Non-Technical Onboarding) require updates upon production deployment
- [x] Release readiness verified: deploy workflows exist in all target repos, prod GitHub environments are provisioned, health endpoints are available, infrastructure and feature changes are scoped to appropriate release cycles (Principle XII)

### Constitution Notes

- **Jira Epic**: [MTB-583](https://mentalhelpglobal.atlassian.net/browse/MTB-583) — recorded in spec.md header.
- **Documentation impact**: User Manual (survey schema editor section — new autosave, preview, export/import features), Release Notes (always), Non-Technical Onboarding (if survey authoring workflow section exists).
- **Responsive checks**: Preview modal must match gate responsive behavior (FR-027). Tested on desktop + mobile viewport in E2E.
- **Smoke checks**: After deploy, verify PATCH schema endpoint, new POST import endpoint, and workbench survey editor loads correctly.

## Project Structure

### Documentation (this feature)

```text
specs/021-survey-schema-tools/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── schema-import-api.md  # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-types/
└── src/
    └── survey.ts                          # Add SchemaExportFormat, ExportQuestion types

chat-frontend-common/
└── src/
    └── survey-ui/                         # NEW: Extracted shared survey components
        ├── index.ts                       # Barrel export
        ├── SurveyForm.tsx                 # Question-by-question flow (gate + preview modes)
        ├── QuestionRenderer.tsx           # Dispatches by question type
        ├── SurveyProgress.tsx             # Progress bar (current/total)
        ├── FreeTextInput.tsx
        ├── SingleChoiceInput.tsx
        ├── MultiChoiceInput.tsx
        ├── BooleanInput.tsx
        ├── NumericInput.tsx
        ├── DateTimeInput.tsx
        ├── PresetTextInput.tsx
        └── RatingScaleInput.tsx

chat-frontend/
└── src/
    └── features/survey/
        ├── SurveyGate.tsx                 # Update imports → chat-frontend-common/survey-ui
        ├── SurveyForm.tsx                 # Remove (moved to chat-frontend-common)
        └── components/                    # Remove (moved to chat-frontend-common)
            └── *.tsx                      # All input components moved

chat-backend/
└── src/
    └── routes/
        └── survey.schemas.ts              # Add POST /import route
    └── services/
        └── surveySchema.service.ts        # Add importSchema() method

workbench-frontend/
└── src/
    └── features/workbench/surveys/
        ├── SurveySchemaEditorView.tsx     # Add autosave logic, preview button, export button
        ├── SurveySchemaListView.tsx       # Add import button
        ├── components/
        │   ├── SaveStatusIndicator.tsx    # NEW: Autosave status display
        │   ├── SurveyPreviewModal.tsx     # NEW: Modal preview using shared components
        │   ├── SchemaExportButton.tsx     # NEW: Export action
        │   ├── SchemaImportDialog.tsx     # NEW: Import file picker + validation UI
        │   └── ConflictNotification.tsx   # NEW: Concurrent edit notification
        ├── hooks/
        │   └── useDebouncedSave.ts        # NEW: Autosave debounce hook
        └── utils/
            ├── schemaExporter.ts          # NEW: Schema → SchemaExportFormat mapping
            └── schemaImporter.ts          # NEW: Client-side validation + API call

chat-ui/
└── tests/
    └── survey-schema-tools/
        ├── autosave.spec.ts               # NEW: Autosave E2E tests
        ├── preview.spec.ts                # NEW: Preview modal E2E tests
        └── export-import.spec.ts          # NEW: Export/import round-trip E2E tests
```

**Structure Decision**: Multi-repository web application following the existing split-repo architecture. The key architectural decision is extracting survey UI components from `chat-frontend` to `chat-frontend-common` for shared use by both the gate and the preview modal.

## Affected Repositories Summary

| Repository | Changes | Scope |
|-----------|---------|-------|
| `chat-types` | Add `SchemaExportFormat`, `ExportQuestion` types | Small (1 file) |
| `chat-frontend-common` | Extract survey UI components to `survey-ui/` module | Medium (12 files moved/created) |
| `chat-frontend` | Update imports to `@mentalhelpglobal/chat-frontend-common/survey-ui`; remove moved files | Medium (refactor, no new functionality) |
| `chat-backend` | New `POST /import` endpoint with validation | Small (2 files) |
| `workbench-frontend` | Autosave hook + indicator, preview modal, export/import UI | Large (8 new files, 2 modified) |
| `chat-ui` | E2E tests for all three features | Medium (3 test files) |

## Cross-Repository Dependencies

```
chat-types (types first)
    ↓
chat-frontend-common (extract components, depends on types)
    ↓
chat-frontend (update imports, depends on common)
    ↓ (parallel with)
chat-backend (import endpoint, depends on types)
    ↓
workbench-frontend (all features, depends on common + types)
    ↓
chat-ui (E2E tests, depends on all above deployed)
```

## Key Technical Decisions

| Decision | Rationale | Reference |
|----------|-----------|-----------|
| 2-second debounced autosave via existing PATCH | Standard interval; no backend changes; reuses existing save flow | research.md R1 |
| Extract survey UI to chat-frontend-common | DRY; spec requires gate-identical rendering; constitution mandates shared code in common | research.md R2 |
| Client-side export (Blob download) | No server storage needed; schema data already loaded in browser | research.md R3 |
| Dedicated server-side import endpoint | Authoritative validation; reuses existing validators; separated from generic create | research.md R4 |
| updatedAt comparison for conflict detection | Simple; no backend changes; sufficient for last-write-wins | research.md R5 |
| Question IDs preserved in export | Required for visibility condition round-trip fidelity | spec.md Clarification Q1 |
| Modal overlay for preview | Simulates gate blocking layout; one-click return to editor | spec.md Clarification Q3 |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Component extraction breaks existing gate | Medium | High | Comprehensive E2E tests on gate before and after extraction; no functional changes in chat-frontend |
| Autosave creates excessive API load | Low | Medium | 2s debounce; single pending request at a time; cancel previous in-flight on new save |
| Import file with conflicting question UUIDs | Low | Low | UUIDs are generated per schema; collision probability negligible; server generates new schema-level ID |
| Preview rendering drifts from gate | Low | Medium | Both use identical shared components; visual regression tests |
