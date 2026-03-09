# Data Model: Cloud & GitHub Infrastructure Setup

**Feature**: 003-cloud-github-infra
**Date**: 2026-02-08

This feature does not use a database. The "data model" describes the
configuration entities that the scripts manage — the declarative JSON
files that define the desired infrastructure state.

## Entities

### SecretDefinition

Represents a secret that MUST exist in Google Secret Manager.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name in Secret Manager (e.g., `db-password`) |
| `description` | string | Yes | Human-readable purpose |
| `auto_generate` | boolean | No | If true, generate a random value on first creation (default: false) |
| `generate_length` | integer | No | Length of auto-generated value (default: 32) |
| `github_secret_name` | string | No | Corresponding GitHub Secret name if synced (e.g., `DATABASE_URL`) |
| `github_transform` | string | No | Transformation to apply when syncing to GitHub (e.g., `database_url` constructs a connection string) |
| `iam_members` | string[] | No | Service accounts that need accessor role |

**Relationships**: A SecretDefinition may map to one or more
GitHubSecrets (via `github_secret_name`). Some secrets require
transformation before syncing (e.g., `db-password` becomes part of
a `DATABASE_URL` connection string).

### RepositoryConfig

Represents a GitHub repository that the setup scripts manage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Repository name (e.g., `chat-backend`) |
| `owner` | string | Yes | GitHub organization (e.g., `MentalHelpGlobal`) |
| `environments` | string[] | No | Environments to create (e.g., `["dev", "prod"]`) |
| `branch_protection` | string[] | No | Branches to protect (e.g., `["develop", "main"]`) |
| `has_deployments` | boolean | No | Whether this repo has CI/CD deployments (determines if env secrets/variables are needed) |

**Relationships**: A RepositoryConfig references one or more
EnvironmentConfigs (by environment name).

### EnvironmentConfig

Represents the desired state of a GitHub environment.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Environment name (e.g., `dev`, `prod`) |
| `protection_rules` | object | No | Deployment protection (reviewers, wait timer) |
| `secrets` | object | Yes | Map of secret name to source (Secret Manager name or literal) |
| `variables` | object | Yes | Map of variable name to value |

**Relationships**: An EnvironmentConfig is applied to every
RepositoryConfig that lists this environment and has
`has_deployments: true`.

### BranchProtectionRule

Represents the desired branch protection configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | Yes | Branch name (e.g., `main`, `develop`) |
| `require_pr` | boolean | Yes | Require pull request reviews |
| `required_approvals` | integer | No | Minimum approving reviews (default: 1) |
| `dismiss_stale_reviews` | boolean | No | Dismiss approvals on new pushes (default: true) |
| `require_status_checks` | boolean | No | Require CI status checks (default: true) |
| `status_checks` | string[] | No | Required status check names |
| `enforce_admins` | boolean | No | Apply rules to admins (default: true) |
| `allow_force_push` | boolean | No | Allow force pushes (default: false) |
| `allow_deletions` | boolean | No | Allow branch deletion (default: false) |

**Relationships**: BranchProtectionRules are applied to each
RepositoryConfig for the branches listed in `branch_protection`.

### VerificationResult

Represents the output of the verification script (not persisted as
a config file, but generated at runtime).

| Field | Type | Description |
|-------|------|-------------|
| `component` | string | What was checked (e.g., `secret:db-password`, `env:chat-backend/dev`) |
| `status` | enum | `pass`, `fail`, `warn` |
| `expected` | string | Expected state |
| `actual` | string | Actual state found |
| `message` | string | Human-readable description |

## Entity Relationships

```text
SecretDefinition ──→ GitHub Secret (via sync)
       │
       └──→ IAM Binding (service account access)

RepositoryConfig ──→ EnvironmentConfig (per environment)
       │
       └──→ BranchProtectionRule (per protected branch)

EnvironmentConfig ──→ GitHub Secrets (from SecretDefinition sync)
       │
       └──→ GitHub Variables (direct values)
```

## State Transitions

### Secret Lifecycle

```text
MISSING ──[setup-secrets.sh creates]──→ ACTIVE (v1, no value)
                                              │
ACTIVE (v1) ──[set value]──→ ACTIVE (v2+)    │
                                              │
ACTIVE ──[manual disable in Console]──→ DISABLED
                                              │
DISABLED ──[verify.sh detects]──→ FLAGGED (warn in report)
```

### GitHub Environment Lifecycle

```text
NOT_EXISTS ──[setup-github.sh creates]──→ CONFIGURED
                                               │
CONFIGURED ──[re-run setup]──→ CONFIGURED (idempotent, no change)
                                               │
CONFIGURED ──[manual change]──→ DRIFTED
                                               │
DRIFTED ──[verify.sh detects]──→ FLAGGED (fail in report)
         ──[setup-github.sh re-run]──→ CONFIGURED (corrected)
```
