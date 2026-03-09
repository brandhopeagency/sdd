# Research: E2E Test Standards & Conventions

**Feature**: 008-e2e-test-standards  
**Date**: 2026-02-10

## R1: Custom ESLint Rule for i18n Namespace Enforcement (FR-001, FR-011)

**Decision**: Write a custom ESLint rule (`enforce-i18n-namespace`) using the flat config format (`eslint.config.js`) already in use.

**Rationale**: The project already uses ESLint with `typescript-eslint` and flat config. A custom rule can statically analyze `useTranslation()` calls within feature directories and verify the namespace argument matches the directory's designated namespace. This is the most reliable enforcement because it runs on every lint pass and in CI.

**Implementation approach**:
- The rule reads the file path to determine which feature directory it belongs to (e.g., `src/features/workbench/review/` → namespace `review`).
- It checks all `useTranslation()` call expressions and verifies the first argument is a string literal matching the expected namespace.
- A mapping from directory pattern to namespace is configured in the rule options (e.g., `{ "src/features/workbench/review": "review" }`).
- Files outside mapped directories are ignored.

**Alternatives considered**:
- **grep/sed script**: Simpler but fragile; no AST awareness, false positives on comments/strings.
- **TypeScript compiler plugin**: Over-engineered for this use case; ESLint already runs on every file.
- **react-i18next ESLint plugin (`eslint-plugin-i18next`)**: Exists but focuses on missing translations, not namespace correctness. Custom rule is more targeted.

---

## R2: Locale Key Completeness Check (FR-002, FR-011)

**Decision**: Write a CI script (`scripts/check-locale-keys.ts`) that compares key hierarchies across `en.json`, `uk.json`, `ru.json` and verifies all `workbench.nav.*` keys exist in every locale.

**Rationale**: This is a structural check (JSON key comparison), not a code pattern check. A standalone script is simpler than an ESLint rule because it operates on JSON files, not TypeScript ASTs. It also catches missing namespace files across locales (e.g., `en/review.json` exists but `uk/review.json` does not).

**Implementation approach**:
- Script loads all root locale files and all namespace subdirectory files.
- For root locale files: extracts all keys from `en.json` and verifies identical key structure exists in `uk.json` and `ru.json`.
- For namespace files: verifies every namespace that exists under `locales/en/` also exists under `locales/uk/` and `locales/ru/`.
- Outputs missing keys/files as CI failure with exact paths.
- Added to `package.json` as `"lint:locales"` and called in CI before build.

**Alternatives considered**:
- **i18next-parser**: Scans code for translation keys and generates locale files; useful for initial scaffolding but doesn't enforce cross-locale parity.
- **Manual review**: Error-prone and already failed (the `workbench.nav.review` key was missing).

---

## R3: Vite Build-Time Environment Variable Validation (FR-007, FR-011)

**Decision**: Add a Vite plugin (`vite-plugin-env-check`) or a pre-build script that validates `VITE_API_URL` is set and is not a localhost URL when the build mode is `production` or a known environment (dev, staging).

**Rationale**: Vite's `import.meta.env` silently returns `undefined` for unset variables. The current `config.ts` fallback to `localhost:3001` is the root cause. A build-time check is the only way to catch this before deployment.

**Implementation approach**:
- Option A (Vite plugin): A `configResolved` hook checks `process.env.VITE_API_URL`. If the resolved mode is not `development`, and the variable is unset or matches `localhost`, throw an error that halts the build.
- Option B (pre-build script): A Node.js script in `scripts/check-env.ts` runs before `vite build` in the CI pipeline. Checks `process.env.VITE_API_URL` and exits non-zero if invalid.
- **Chosen**: Option A (Vite plugin) — integrated into the build process itself, so it cannot be bypassed by running `vite build` directly.

**Alternatives considered**:
- **Remove the fallback from `config.ts`**: Would break local development (`npm run dev` without env vars). The fallback is correct for local dev; the issue is only in deployed builds.
- **CI-only check**: Less reliable because developers might deploy from local machines (as happened in the recent fix cycle).

---

## R4: Playwright globalSetup for Seed Data and Pre-flight Checks (FR-009, FR-012)

**Decision**: Create `tests/e2e/global-setup.ts` registered in `playwright.config.ts` as `globalSetup`. It performs two phases: (1) seed/verify test users, (2) validate runtime preconditions.

**Rationale**: No `globalSetup` currently exists in either `chat-client` or `chat-ui`. Adding one is a single config change. The seed logic uses the `pg` library (already available as a backend dependency) to connect to the target database and upsert test users.

**Implementation approach**:
- `global-setup.ts` exports an async function.
- **Phase 1 (Seed)**: Reads `TEST_ROLES` from `fixtures/roles.ts`. Connects to the database using `DATABASE_URL` env var (same connection string the backend uses). For each role, runs an `INSERT ... ON CONFLICT (email) DO UPDATE` to ensure the user exists with correct `status`, `role`, and `approved_at`.
- **Phase 2 (Pre-flight)**: Fetches `PLAYWRIGHT_BASE_URL/index.html` and checks that (a) it responds 200, (b) the response headers include `Cache-Control: no-cache` or similar. If the check fails, logs a clear warning but does not abort (CDN propagation may still be in progress).
- **Database connection**: Uses `DATABASE_URL` env var. For local dev, this points to a local PostgreSQL. For CI/dev, it points to the Cloud SQL instance (via Cloud SQL Auth Proxy or direct IP).
- **Error handling**: If the database is unreachable, the seed step logs a warning and the suite continues (tests will fail individually with clear auth errors rather than a cryptic global abort).

**Alternatives considered**:
- **CI pipeline step only**: Would not help developers running tests locally. The globalSetup approach is universal.
- **Playwright fixtures**: Per-worker fixtures would run seed logic multiple times. GlobalSetup runs once.
- **Docker-based seed**: Over-engineered for the current Cloud SQL setup.

---

## R5: Role-Permission Documentation for Test Authors (FR-003, FR-004)

**Decision**: Create a reference table in the E2E test helpers directory (`tests/e2e/helpers/permissions.ts`) that exports the role-permission matrix, plus a TSDoc comment block that test authors can consult.

**Rationale**: The canonical RBAC definitions live in `@mentalhelpglobal/chat-types` (`rbac.ts`). E2E tests in `chat-client` don't import from `chat-types` (they use a local copy in `src/types/index.ts`). Duplicating the entire RBAC module into the test helpers would create drift. Instead, export a lightweight reference map and link to the canonical source.

**Implementation approach**:
- `tests/e2e/helpers/permissions.ts` exports `ROLE_WORKBENCH_PERMISSIONS`: a record mapping each `TestRole` to an array of key permission strings relevant to test routing decisions.
- Includes a JSDoc block with the full permission matrix table for developer reference.
- Test files can import and use this for assertions or guards, but the primary purpose is documentation.

**Alternatives considered**:
- **Import from `chat-types` in E2E tests**: Would require adding `chat-types` as a dev dependency of the E2E test project. Adds complexity; the information changes rarely.
- **Markdown documentation only**: Less discoverable than in-code documentation that appears via IDE autocomplete.

---

## R6: CDN Cache Headers in Deployment Pipeline (FR-008)

**Decision**: The deployment pipeline already sets correct headers. Verify and add a pre-flight check.

**Rationale**: The `deploy.yml` workflow already includes `gsutil setmeta` commands that set `Cache-Control: no-cache, no-store, must-revalidate` on `index.html` and `Cache-Control: public, max-age=31536000, immutable` on `assets/**`. The issue in the recent fix cycle was a *manual local deployment* that bypassed this pipeline. The pre-flight check in `globalSetup` (R4) catches this.

**Implementation approach**:
- No changes to CI pipeline needed (already correct).
- The `globalSetup` pre-flight check (R4, Phase 2) validates headers at test time.
- Document the correct `gsutil setmeta` commands in `quickstart.md` for manual deployment scenarios.

**Alternatives considered**:
- **GCS bucket-level default metadata**: GCS doesn't support per-file-pattern default metadata at the bucket level. Must be set per-object or via `gsutil setmeta`.
- **Cloud CDN cache invalidation on every deploy**: Expensive and adds latency. `no-cache` on `index.html` is the correct approach.

---

## R7: Dual-Target Scope Assessment

**Decision**: Changes apply to both `chat-client` (monorepo) and `chat-ui` (split repo) per Constitution Principle VII, but with asymmetric scope.

**Rationale**: The constitution mandates dual-target delivery. However, the ESLint rules (R1) and locale checks (R2) apply to frontend application code (`chat-client/src/` and `chat-frontend/src/`), while the Playwright globalSetup (R4) and permission helpers (R5) apply to E2E test code (`chat-client/tests/e2e/` and `chat-ui/tests/e2e/`). The Vite plugin (R3) applies to the frontend build in both `chat-client` and `chat-frontend`.

**Dual-target mapping**:

| Artifact | chat-client (monorepo) | Split repo |
|----------|----------------------|------------|
| ESLint rule (R1) | `chat-client/eslint.config.js` | `chat-frontend/eslint.config.js` |
| Locale check (R2) | `chat-client/scripts/check-locale-keys.ts` | `chat-frontend/scripts/check-locale-keys.ts` |
| Vite env plugin (R3) | `chat-client/vite.config.ts` | `chat-frontend/vite.config.ts` |
| globalSetup (R4) | `chat-client/tests/e2e/global-setup.ts` + `playwright.config.ts` | `chat-ui/tests/e2e/global-setup.ts` + `playwright.config.ts` |
| Permission helpers (R5) | `chat-client/tests/e2e/helpers/permissions.ts` | `chat-ui/tests/e2e/helpers/permissions.ts` |
| CI pipeline (R6) | `chat-client/.github/workflows/deploy.yml` | `chat-ci/.github/workflows/` |
