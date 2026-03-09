# Feature Specification: Cloud & GitHub Infrastructure Setup

**Feature Branch**: `003-cloud-github-infra`
**Created**: 2026-02-08
**Status**: Complete
**Jira Epic**: MTB-191
**Input**: User description: "Define the cloud objects and GitHub infrastructure. Store all the secrets in Google Secret Manager. Use GitHub CLI and Cloud CLI for infra setup."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Infrastructure Configuration (Priority: P1)

A DevOps engineer needs to configure all GitHub repositories in the
MentalHelpGlobal organization with consistent settings, environments,
secrets, variables, and branch protection rules. Today this is done
manually through the GitHub web UI, which is error-prone, undocumented,
and impossible to reproduce if a repository needs to be recreated or
audited.

The engineer runs a script that applies the organization's standard
configuration to every repository: environment definitions (dev, prod),
environment-specific secrets and variables, branch protection on
`develop` and `main`, and package registry access for shared types.

**Why this priority**: GitHub infrastructure is entirely unscripted
today. Every repository change (new environment variable, updated
secret, branch rule tweak) is a manual, untraceable action. This is the
largest gap in infrastructure reproducibility.

**Independent Test**: Can be fully tested by running the script against
a single repository and verifying that environments, secrets, variables,
and branch protection rules match the expected configuration. Delivers
immediate value by making GitHub infrastructure auditable and
reproducible.

**Acceptance Scenarios**:

1. **Given** a newly created repository in the organization with no
   configuration, **When** the engineer runs the GitHub setup script
   targeting that repository, **Then** the repository has `dev` and
   `prod` environments, branch protection on `develop` and `main`,
   and all required secrets and variables populated.
2. **Given** an already-configured repository, **When** the engineer
   re-runs the setup script, **Then** the configuration is unchanged
   (idempotent) and no errors occur.
3. **Given** a repository with outdated secret values, **When** the
   engineer runs the script with updated values from Secret Manager,
   **Then** the GitHub secrets are updated to match the current Secret
   Manager values.
4. **Given** the full set of 8 repositories (chat-backend,
   chat-frontend, chat-types, chat-ui, chat-ci, chat-infra,
   chat-client, client-spec), **When** the engineer runs the setup
   script for all repositories, **Then** every repository has
   consistent, identical configuration for shared settings.

---

### User Story 2 - Secrets Consolidation in Secret Manager (Priority: P2)

A DevOps engineer needs to ensure that every application secret used
across the project is stored in Google Secret Manager and managed
exclusively through CLI scripts. Currently, some secrets exist in
Secret Manager (database password, JWT secrets) while others (Gmail
OAuth credentials, additional service credentials) are documented
only in README files and configured manually.

The engineer runs a script that audits the current state of Secret
Manager, identifies any missing secrets from the project's master
list, creates them with placeholder or provided values, and reports
the current inventory.

**Why this priority**: Incomplete secrets management creates security
blind spots. Undocumented or manually managed secrets cannot be
rotated, audited, or recovered reliably. Consolidating everything into
Secret Manager is a prerequisite for the GitHub secrets sync in US1.

**Independent Test**: Can be tested by running the audit script against
the GCP project and verifying that every secret in the master list
exists in Secret Manager with appropriate IAM access grants. Delivers
value by creating a single, auditable source of truth for all secrets.

**Acceptance Scenarios**:

1. **Given** a GCP project with only partial secrets (db-password,
   jwt-secret, jwt-refresh-secret), **When** the engineer runs the
   secrets setup script, **Then** all missing secrets from the master
   list are created in Secret Manager.
2. **Given** all secrets exist in Secret Manager, **When** the engineer
   runs the audit command, **Then** a report is generated listing every
   secret, its creation date, and which services have access.
3. **Given** a secret that needs rotation, **When** the engineer runs
   the update command with a new value, **Then** a new version of the
   secret is created and the previous version remains accessible for
   rollback.
4. **Given** the secrets setup has completed, **When** the engineer
   runs the GitHub sync command, **Then** relevant secrets are
   propagated to the appropriate GitHub repository environments.

---

### User Story 3 - Unified Setup and Verification (Priority: P3)

A DevOps engineer joining the project or recovering from a
configuration loss needs a single entrypoint that orchestrates the
complete infrastructure setup in the correct order: first ensuring
secrets exist in Secret Manager, then configuring all GitHub
repositories with those secrets and environment variables.

The engineer runs one command that sequences the secrets consolidation
(US2) and GitHub configuration (US1), provides progress feedback, and
at the end runs a verification check confirming that the entire
infrastructure matches the expected state.

**Why this priority**: Without a unified entrypoint, engineers must
know which scripts to run in which order and must manually verify
results. This story ties US1 and US2 together into a hands-off
workflow, but each can function independently.

**Independent Test**: Can be tested by running the unified setup on a
project with partial configuration and verifying that both Secret
Manager and GitHub are fully configured afterward, with a passing
verification report.

**Acceptance Scenarios**:

1. **Given** a project with partial Secret Manager entries and
   unconfigured GitHub repositories, **When** the engineer runs the
   unified setup command, **Then** secrets are created first, GitHub
   is configured second, and a verification report confirms all
   checks pass.
2. **Given** a fully configured project, **When** the engineer re-runs
   the unified setup, **Then** no changes are made and the verification
   report confirms the infrastructure is already in the expected state.
3. **Given** the unified setup encounters a failure mid-execution (e.g.,
   network error), **When** the engineer re-runs the command, **Then**
   it resumes from where it left off without duplicating previously
   completed steps.
4. **Given** the setup has completed, **When** the engineer runs only
   the verification command (without setup), **Then** a report is
   generated showing pass/fail status for every expected infrastructure
   component.

---

### Edge Cases

- What happens when the engineer lacks sufficient GitHub permissions
  (e.g., not an org admin)? The script MUST detect insufficient
  permissions early and report which permissions are missing before
  making any changes.
- What happens when a secret in Secret Manager has been disabled or
  destroyed? The audit MUST flag disabled/destroyed secrets and offer
  to recreate them.
- What happens when a GitHub repository does not exist yet? The script
  MUST skip non-existent repositories with a warning rather than
  failing entirely.
- What happens when the GCP project has billing disabled or APIs not
  enabled? The script MUST check prerequisites and report clearly
  before attempting secret operations.
- What happens when GitHub rate limits are hit during bulk repository
  configuration? The script MUST handle rate limiting gracefully with
  retry logic and progress reporting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a script to configure GitHub
  repository settings (environments, secrets, variables, branch
  protection) for all project repositories using the GitHub CLI.
- **FR-002**: System MUST configure two GitHub environments (`dev` and
  `prod`) on each repository with appropriate protection rules (prod
  requires approval for deployments).
- **FR-003**: System MUST set GitHub secrets and variables per
  environment, sourcing secret values from Google Secret Manager.
- **FR-004**: System MUST configure branch protection rules on
  `develop` and `main` branches (require PR reviews, status checks,
  no direct pushes).
- **FR-005**: System MUST provide a script to audit and create secrets
  in Google Secret Manager, covering at minimum: database credentials,
  JWT signing secrets, Gmail OAuth credentials, and any additional
  service credentials documented in project README files.
- **FR-006**: System MUST support creating new secret versions (for
  rotation) without destroying previous versions.
- **FR-007**: System MUST grant appropriate IAM access to secrets for
  the Cloud Run compute service account.
- **FR-008**: System MUST provide a sync mechanism that reads secrets
  from Secret Manager and writes them as GitHub repository secrets
  to the correct environments.
- **FR-009**: System MUST provide a unified entrypoint script that
  runs secrets setup and GitHub configuration in the correct order.
- **FR-010**: All scripts MUST be idempotent — safe to run multiple
  times without side effects or errors.
- **FR-011**: System MUST provide a verification command that checks
  the current infrastructure state against expected configuration and
  reports pass/fail per component.
- **FR-012**: All scripts MUST exist in both the `chat-infra`
  repository and the monorepo equivalent (`chat-client/infra/`) per
  the project's dual-target implementation policy.
- **FR-013**: System MUST validate prerequisites (CLI tools installed,
  authentication status, required permissions) before executing any
  infrastructure changes.
- **FR-014**: System MUST handle errors gracefully with clear messages
  indicating what failed, why, and how to resolve it.

### Key Entities

- **Secret**: A sensitive configuration value stored in Google Secret
  Manager. Has a name, one or more versions, IAM access bindings, and
  a status (active, disabled, destroyed). Examples: database password,
  JWT signing key, OAuth client secret.
- **GitHub Environment**: A deployment target (dev, prod) configured on
  a GitHub repository. Contains environment-specific secrets and
  variables, and may have protection rules (required reviewers,
  wait timers).
- **GitHub Secret**: An encrypted value stored at the repository or
  environment level in GitHub, used by CI/CD workflows. Sourced from
  Secret Manager during sync.
- **GitHub Variable**: A non-sensitive configuration value stored at
  the repository or environment level in GitHub, used by CI/CD
  workflows. Examples: project IDs, region names, URLs.
- **Repository Configuration**: The complete set of settings for a
  GitHub repository including environments, secrets, variables, branch
  protection rules, and package registry access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new team member can fully configure all GitHub
  infrastructure from scratch in under 15 minutes by running a single
  command.
- **SC-002**: 100% of application secrets are stored in the centralized
  secret store with no secrets existing only in documentation or
  manual configuration.
- **SC-003**: All 8 project repositories have identical environment and
  branch protection configuration after running the setup.
- **SC-004**: Re-running the complete setup on an already-configured
  project produces zero changes and zero errors (idempotency).
- **SC-005**: The verification command detects and reports at least 95%
  of configuration drift (missing secrets, changed branch rules,
  missing environments) within 60 seconds.
- **SC-006**: Secret rotation (updating a secret value and propagating
  to GitHub) can be completed in under 5 minutes.
- **SC-007**: Infrastructure setup scripts exist in both the split
  repository and the monorepo, maintaining functional parity between
  the two.

## Assumptions

- The GCP project (`mental-help-global-25`) is already created and the
  engineer has Owner or Editor IAM permissions.
- The GitHub organization (`MentalHelpGlobal`) exists and the engineer
  has admin access to all repositories.
- The `gcloud` CLI and `gh` CLI are installed and authenticated on the
  engineer's machine.
- Core GCP resources (Cloud SQL, Cloud Run, Cloud Storage, Artifact
  Registry, Vertex AI, Dialogflow) are already provisioned and are
  NOT in scope for this feature — only secrets and GitHub configuration
  are addressed.
- The existing Workload Identity Federation setup for GitHub Actions
  authentication remains unchanged.
- Secret values will be provided by the engineer at creation time or
  generated automatically where appropriate (e.g., random JWT secrets).

## Out of Scope

- Provisioning core GCP resources (Cloud SQL, Cloud Run, GCS buckets,
  Artifact Registry) — these already exist.
- Vertex AI model configuration — already set up via existing scripts.
- Dialogflow agent configuration — already configured and referenced by
  existing infrastructure.
- Terraform migration — remains a separate future initiative.
- GitHub repository creation — repositories are assumed to already
  exist.
- Application-level configuration (environment variables that are not
  secrets) beyond what CI/CD workflows require.
