# Feature Specification: Decommission chat-client Pipelines & Consolidate Split-Repo CI

**Feature Branch**: `009-pipeline-decommission`  
**Created**: 2026-02-10  
**Status**: Complete
**Jira Epic**: MTB-227
**Input**: User description: "Add any new requirements that appeared in this chat and let's decommission the deployment pipelines in chat-client"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Deployment Pipelines from chat-client Monorepo (Priority: P1)

As a platform team member, I want all deployment pipelines removed from the `chat-client` monorepo so that deployments only happen through the canonical split repositories (`chat-frontend`, `chat-backend`, `chat-ui`), eliminating the risk of conflicting or duplicate deployments.

**Why this priority**: The monorepo (`chat-client`) still contains deployment workflows that overlap with the split repos. If someone accidentally triggers a deploy from chat-client, it could overwrite the production artifacts deployed by the canonical repos. This is the highest-risk item.

**Independent Test**: Verify that the chat-client repository has no CI/CD workflows that deploy to GCS, Cloud Run, or any production/staging environment. Pushing to any branch in chat-client must not trigger any deployment.

**Acceptance Scenarios**:

1. **Given** the chat-client repository, **When** a developer pushes to the `main` or `develop` branch, **Then** no deployment to GCS, Cloud Run, or any cloud environment is triggered.
2. **Given** the chat-client repository, **When** a developer opens a pull request, **Then** no GitHub Actions workflows trigger at all — quality checks are run locally by the developer.
3. **Given** the chat-client repository has deployment workflows removed, **When** the chat-frontend and chat-backend repos deploy to dev, **Then** there is no conflict or artifact overwrite from chat-client.

---

### User Story 2 - Standardize chat-types Dependency Resolution in CI (Priority: P1)

As a CI pipeline maintainer, I want a consistent, documented pattern for resolving the `@mentalhelpglobal/chat-types` package in all CI environments so that builds never fail due to missing type dependencies.

**Why this priority**: Both chat-frontend and chat-backend CI pipelines broke because the `file:../chat-types` dependency doesn't resolve in CI runners. The fix (checkout + build chat-types locally) was applied ad-hoc. This needs to be standardized and documented so future repos and contributors follow the same pattern.

**Independent Test**: Each split repo (chat-frontend, chat-backend, chat-ui) can run its full CI pipeline in a clean GitHub Actions runner with no pre-existing sibling directories, and all steps (install, lint, test, build, deploy) succeed.

**Acceptance Scenarios**:

1. **Given** a clean CI runner with only the target repo checked out, **When** `npm install` runs, **Then** `@mentalhelpglobal/chat-types` resolves successfully without manual intervention.
2. **Given** the chat-types package is updated with new exports, **When** CI runs for any dependent repo, **Then** the latest chat-types code is built and available during the pipeline.
3. **Given** a new repository that depends on chat-types, **When** a developer sets up CI using the documented pattern, **Then** they can copy the standard workflow snippet and have a working pipeline.

---

### User Story 3 - Ensure GCP Secrets Are Properly Provisioned for Deployments (Priority: P2)

As a DevOps team member, I want all GCP Secret Manager secrets referenced by Cloud Run services to have valid versions and proper IAM bindings so that deployments never fail due to missing or inaccessible secrets.

**Why this priority**: The chat-backend deployment failed because `gmail-client-secret` and `gmail-refresh-token` secrets existed as empty shells (no versions). This is a recurring pattern risk — any new secret added to the deploy workflow must be validated before the first deployment attempt.

**Independent Test**: A pre-deployment validation check confirms that every secret referenced in the Cloud Run deploy command has at least one active version and the Cloud Run service account has `secretAccessor` role on it.

**Acceptance Scenarios**:

1. **Given** a Cloud Run deployment workflow references secrets, **When** the pipeline runs, **Then** a pre-flight check validates that every referenced secret has at least one version and the service account can access it.
2. **Given** a new secret is added to the deploy workflow, **When** the developer forgets to create the secret in GCP, **Then** the pre-flight check fails with a clear error message listing the missing or empty secrets.
3. **Given** all secrets are properly provisioned, **When** the Cloud Run service starts, **Then** it can read all secret values without `MODULE_NOT_FOUND` or `Secret not found` errors.

---

### User Story 4 - Handle CJS/ESM Interoperability for Shared Packages (Priority: P2)

As a frontend developer, I want shared packages (like chat-types) that compile to CommonJS to work seamlessly in Vite/Rollup-based projects so that production builds don't fail on named export resolution.

**Why this priority**: The chat-frontend build failed because Vite/Rollup couldn't resolve named exports from the CJS-compiled chat-types package. The fix (`commonjsOptions.include`) was applied locally but should be part of a documented standard for any shared package consumed by Vite-based frontends.

**Independent Test**: Running `npm run build` in chat-frontend produces a successful production bundle that correctly imports and tree-shakes all exports from chat-types.

**Acceptance Scenarios**:

1. **Given** chat-types is compiled as CommonJS, **When** chat-frontend runs a production Vite build, **Then** all named exports (UserRole, Permission, ROLE_PERMISSIONS, etc.) resolve correctly.
2. **Given** a new shared package compiled as CommonJS is added, **When** a developer adds it to the Vite frontend, **Then** the documented configuration pattern ensures the build succeeds.

---

### User Story 5 - Maintain Coverage Thresholds Across Feature Merges (Priority: P3)

As a quality assurance contributor, I want coverage thresholds to automatically adjust when large features are merged so that CI doesn't break on unrelated PRs due to coverage drops from new untested code.

**Why this priority**: The review feature (PR #8) added many components without unit tests, dropping coverage below the 25% threshold and blocking all subsequent CI runs. Coverage thresholds should be managed proactively.

**Independent Test**: After merging a feature that adds significant untested code, the CI pipeline either adjusts thresholds automatically or clearly reports the coverage delta without blocking unrelated work.

**Acceptance Scenarios**:

1. **Given** a feature PR adds new code without full test coverage, **When** it merges to develop, **Then** coverage thresholds are updated in the same PR to reflect the new baseline.
2. **Given** coverage drops below the configured threshold, **When** CI runs, **Then** the failure message clearly indicates which files/features caused the drop and suggests the threshold adjustment needed.

---

### Edge Cases

- What happens if chat-client still has local developer scripts that reference deployment targets? They should be updated or removed to avoid confusion.
- What happens if someone creates a GitHub Actions workflow in chat-client that accidentally deploys? Branch protection rules or workflow restrictions should prevent this.
- What happens if the chat-types package needs breaking changes? All dependent repos must be tested together before publishing.
- What happens if GCP secrets are rotated? The pre-flight check should validate secret accessibility, not specific values.

## Clarifications

### Session 2026-02-10

- Q: Should chat-client retain GitHub Actions CI (lint/test on push/PR), or remove all workflows and keep only local npm scripts? → A: Remove all GitHub Actions workflows from chat-client; retain only local npm scripts.
- Q: Which branch/tag of chat-types should CI check out — default branch, pinned tag, or version-matched? → A: Always check out the default branch (current behavior); simple, always latest.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat-client repository MUST NOT contain any GitHub Actions workflows — neither deployment nor CI quality checks. All `.github/workflows/` files must be removed.
- **FR-002**: The chat-client repository MUST retain local development npm scripts (lint, type-check, unit tests, E2E tests) so contributors who develop against the monorepo can run quality checks locally.
- **FR-003**: All split repositories (chat-frontend, chat-backend, chat-ui) MUST include a standardized CI step that checks out the default branch of `@mentalhelpglobal/chat-types` and builds it before dependency installation.
- **FR-004**: The chat-types checkout step MUST use a GitHub token with cross-repo read access (`repo` scope) stored as the `PKG_TOKEN` secret.
- **FR-005**: All Docker images that depend on chat-types MUST include the built chat-types directory in both the builder and production stages.
- **FR-006**: Cloud Run deployment workflows MUST include a pre-flight validation step that verifies all referenced GCP secrets have at least one active version and the service account has `secretAccessor` role.
- **FR-007**: Vite-based frontend projects that consume CommonJS shared packages MUST configure `build.commonjsOptions.include` to cover those packages.
- **FR-008**: Coverage thresholds in CI MUST be reviewed and updated as part of any PR that adds significant new code (more than 500 lines of application code).
- **FR-009**: The ESLint configuration in CI MUST exclude any locally-checked-out dependency directories (e.g., `chat-types/`) from linting.
- **FR-010**: Each split repository MUST have the `PKG_TOKEN` secret configured with sufficient permissions for both npm registry access and cross-repo checkout.

### Key Entities

- **chat-client**: The original monorepo containing all frontend, backend, and test code. To be retained for local development only, with no deployment capability.
- **chat-frontend**: The canonical frontend deployment repository. Deploys to GCS via GitHub Actions.
- **chat-backend**: The canonical backend deployment repository. Deploys to Cloud Run via GitHub Actions.
- **chat-ui**: The canonical E2E test repository. Runs Playwright tests against deployed environments.
- **chat-types**: Shared TypeScript type definitions package. Published to GitHub Packages and also consumed locally via `file:` dependencies.
- **GCP Secret Manager secrets**: Credentials referenced by Cloud Run services (database-url, jwt-secret, jwt-refresh-secret, gmail-client-secret, gmail-refresh-token).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero GitHub Actions workflow files exist in the chat-client repository — the `.github/workflows/` directory is empty or absent.
- **SC-002**: All three split repos (chat-frontend, chat-backend, chat-ui) pass their full CI pipeline on a clean GitHub Actions runner within 5 minutes, with zero manual interventions required.
- **SC-003**: A new contributor can set up CI for a new repository that depends on chat-types by following the documented pattern in under 15 minutes.
- **SC-004**: Cloud Run deployments succeed on first attempt when all application code is correct — no failures due to missing secrets, missing dependencies, or CJS/ESM interop issues.
- **SC-005**: Coverage threshold adjustments are included in 100% of feature PRs that add more than 500 lines of untested application code.
- **SC-006**: The chat-client repository retains full local development capability — `npm run dev`, `npm run lint`, `npm run test`, and `npm run build` all work correctly for monorepo contributors (no GitHub Actions required).

## Assumptions

- The chat-client monorepo will continue to exist for local development convenience but is not the source of truth for deployments.
- The `PKG_TOKEN` secret uses a GitHub Personal Access Token (or equivalent) with `repo` and `read:packages` scopes, shared across all repos in the organization.
- The `EMAIL_PROVIDER=console` setting means Gmail secrets are not functionally required in the dev environment, but must exist for Cloud Run to accept the deployment configuration.
- Coverage threshold management is a process/convention requirement enforced by PR review, not automated tooling.

## Scope Boundaries

### In Scope
- Removing deployment workflows from chat-client
- Documenting the chat-types CI pattern
- Pre-flight secret validation in deployment workflows
- Vite CJS/ESM configuration standard
- Coverage threshold management convention

### Out of Scope
- Migrating chat-types to ESM (dual CJS/ESM build) — this is a separate, larger effort
- Deleting the chat-client repository entirely
- Automating coverage threshold adjustment (manual review is sufficient for now)
- Setting up production deployment pipelines (only dev environment is in scope)
