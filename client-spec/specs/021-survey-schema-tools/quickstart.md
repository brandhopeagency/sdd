# Quickstart: 021-survey-schema-tools

**Branch**: `021-survey-schema-tools` | **Date**: 2026-03-05

---

## Prerequisites

- All split repositories cloned and on `develop` branch
- Node.js / npm installed per each repo's README
- Feature 018-workbench-survey merged to `develop` in all repos
- Feature 019-survey-question-enhancements merged (or in progress with survey UI components available)

---

## Affected Repositories

| Repository | Changes | Branch |
|-----------|---------|--------|
| `chat-types` | New `SchemaExportFormat` and `ExportQuestion` types | `021-survey-schema-tools` |
| `chat-frontend-common` | Extract shared survey UI components (`QuestionRenderer`, inputs, `SurveyProgress`, `SurveyForm`) | `021-survey-schema-tools` |
| `chat-frontend` | Update survey gate imports to use `@mentalhelpglobal/chat-frontend-common/survey-ui` | `021-survey-schema-tools` |
| `chat-backend` | New `POST /api/workbench/survey-schemas/import` endpoint | `021-survey-schema-tools` |
| `workbench-frontend` | Autosave, preview modal, export/import UI | `021-survey-schema-tools` |
| `chat-ui` | E2E tests for autosave, preview, export, import | `021-survey-schema-tools` |

---

## Implementation Order

```
1. chat-types          → Add export format types
2. chat-frontend-common → Extract survey UI components
3. chat-frontend        → Update imports (no functional change)
4. chat-backend         → Add import endpoint
5. workbench-frontend   → Autosave + Preview + Export + Import UI
6. chat-ui              → E2E tests
```

Dependencies flow: `chat-types` → `chat-frontend-common` → `chat-frontend` + `workbench-frontend` → `chat-backend` (independent) → `chat-ui` (last).

---

## Setup Steps

### 1. Create feature branches

```bash
# In each affected repository:
cd D:\src\MHG\chat-types && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
cd D:\src\MHG\chat-frontend-common && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
cd D:\src\MHG\chat-frontend && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
cd D:\src\MHG\chat-backend && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
cd D:\src\MHG\workbench-frontend && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
cd D:\src\MHG\chat-ui && git checkout develop && git pull && git checkout -b 021-survey-schema-tools
```

### 2. Install dependencies

```bash
# In each repository:
npm install
```

### 3. Verify existing survey features work

```bash
# chat-backend: run tests
cd D:\src\MHG\chat-backend && npm test

# workbench-frontend: run tests
cd D:\src\MHG\workbench-frontend && npm test

# chat-frontend: run tests
cd D:\src\MHG\chat-frontend && npm test
```

---

## Verification Checklist

- [ ] Autosave: Edit a draft schema, wait 2s, close tab, reopen — changes preserved
- [ ] Autosave: Disconnect network, make edit, reconnect — save recovers
- [ ] Autosave: Save indicator shows "Saving...", "Saved [time]", "Save failed"
- [ ] Preview: Open preview modal on draft schema — gate-style rendering
- [ ] Preview: Conditional questions appear/hide based on sample answers
- [ ] Preview: Typed inputs render correctly (numeric, date, rating scale)
- [ ] Preview: Progress indicator shows X of N (adjusts for conditionals)
- [ ] Preview: Review step shown at end
- [ ] Preview: No data persisted after closing modal
- [ ] Export: Download JSON for any schema status
- [ ] Export: File contains all question config, no server-internal fields
- [ ] Export: File includes `schemaVersion: 1`
- [ ] Import: Upload valid JSON → new draft created
- [ ] Import: Upload invalid JSON → clear error messages
- [ ] Import: Visibility condition references validated
- [ ] Import: Version check rejects newer schemaVersion
- [ ] RBAC: Supervisor can access preview, export, and import
