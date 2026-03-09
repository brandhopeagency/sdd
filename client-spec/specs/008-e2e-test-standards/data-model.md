# Data Model: E2E Test Standards & Conventions

**Feature**: 008-e2e-test-standards  
**Date**: 2026-02-10

This spec is a conventions/standards feature, not a data-heavy feature. The "data model" here describes the configuration structures and mappings that the enforcement tooling operates on.

## Entity: i18n Namespace Map

**Purpose**: Maps feature directory paths to their required i18n namespace.

```typescript
// Used by ESLint rule `enforce-i18n-namespace` in rule options
interface NamespaceMap {
  [directoryPattern: string]: string; // directory glob → namespace name
}

// Example configuration:
const namespaceMap: NamespaceMap = {
  "src/features/workbench/review": "review",
  // Add new feature namespaces here as they are created
};
```

**Validation rules**:
- Each directory pattern MUST map to exactly one namespace.
- The namespace MUST correspond to an existing JSON file under `locales/en/<namespace>.json`.
- Components outside mapped directories are not checked.

---

## Entity: Test Role

**Purpose**: Maps E2E test role aliases to database credentials and application roles.

```typescript
// Source: tests/e2e/fixtures/roles.ts (already exists)
interface TestRoleEntry {
  email: string;       // e.g., "e2e-researcher@test.local"
  role: string;        // e.g., "researcher" — must match UserRole enum value
}

type TestRoles = Record<string, TestRoleEntry>;
```

**Database representation** (in `users` table):

| Column | Type | Constraint | Source |
|--------|------|-----------|--------|
| `email` | `varchar` | UNIQUE | `TEST_ROLES[key].email` |
| `role` | `varchar` | FK to UserRole enum | `TEST_ROLES[key].role` |
| `status` | `varchar` | Must be `'active'` | Set by seed script |
| `approved_at` | `timestamp` | NOT NULL | Set by seed script (`NOW()`) |

**Lifecycle**:
- Created by `globalSetup` seed script on first test run.
- Updated (upserted) on every subsequent test run to ensure correctness.
- Never deleted by the seed script (manual cleanup only).

---

## Entity: Role-Permission Matrix (Reference)

**Purpose**: Reference data for test authors when selecting `test.use({ role })`.

| Role | WORKBENCH_ACCESS | WORKBENCH_RESEARCH | WORKBENCH_MODERATION | WORKBENCH_USER_MANAGEMENT | WORKBENCH_PRIVACY |
|------|:---:|:---:|:---:|:---:|:---:|
| `user` | - | - | - | - | - |
| `qa_specialist` | - | - | - | - | - |
| `researcher` | Y | Y | Y | - | - |
| `moderator` | Y | Y | Y | Y | - |
| `group_admin` | Y | -* | - | - | - |
| `owner` | Y | Y | Y | Y | Y |

\* `group_admin` has `WORKBENCH_GROUP_RESEARCH` (group-scoped), not global `WORKBENCH_RESEARCH`.

**Canonical source**: `@mentalhelpglobal/chat-types` → `src/rbac.ts` → `ROLE_PERMISSIONS`

---

## Entity: Locale File Structure

**Purpose**: Defines the expected file layout for i18n translation files.

```text
src/locales/
├── en.json              # Root namespace (default)
├── uk.json              # Root namespace (Ukrainian)
├── ru.json              # Root namespace (Russian)
└── en/                  # Feature namespaces
    └── review.json      # "review" namespace
    # Future: uk/review.json, ru/review.json when localized
```

**Validation rules**:
- Every key in `en.json` MUST exist in `uk.json` and `ru.json` (and vice versa).
- Every namespace file under `locales/en/` SHOULD have corresponding files under `locales/uk/` and `locales/ru/` (warning, not error, since translation may lag).
- The `workbench.nav.*` key set in root locale files MUST include entries for all sidebar navigation items.

---

## Entity: Pre-flight Check Result

**Purpose**: Structure returned by `globalSetup` pre-flight checks.

```typescript
interface PreflightResult {
  seedStatus: 'ok' | 'warning' | 'error';
  seedDetails: string;               // e.g., "6/6 test users verified"
  cdnStatus: 'ok' | 'warning' | 'skipped';
  cdnDetails: string;                // e.g., "Cache-Control: no-cache confirmed"
  backendStatus: 'ok' | 'warning' | 'error';
  backendDetails: string;            // e.g., "API health check passed"
}
```

**Behavior**:
- `ok`: Precondition met, proceed normally.
- `warning`: Precondition may not be met, log warning, proceed (tests may fail individually).
- `error`: Critical precondition failed (e.g., database unreachable), abort suite with descriptive message.
- `skipped`: Check not applicable (e.g., CDN check skipped for local dev).
