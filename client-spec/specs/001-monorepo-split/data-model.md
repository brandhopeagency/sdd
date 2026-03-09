# Data Model: Monorepo Split

**Feature**: 001-monorepo-split
**Date**: 2026-02-04

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GitHub Organization: MentalHelpGlobal                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌───────────────┐              ┌───────────────┐              ┌───────────────┐
│   chat-ci     │◄─────────────│ chat-backend  │              │ chat-frontend │
│               │  workflow    │               │              │               │
│ Reusable      │  reference   │ Express.js    │◄────────────►│ React/Vite    │
│ Workflows     │              │ API Server    │  API calls   │ SPA           │
└───────────────┘              └───────────────┘              └───────────────┘
        ▲                               │                               │
        │                               │                               │
        │                               ▼                               ▼
        │                      ┌───────────────┐              ┌───────────────┐
        │                      │ @mhg/chat-    │              │ @mhg/chat-    │
        │                      │ types         │              │ types         │
        │                      │ (dependency)  │              │ (dependency)  │
        │                      └───────────────┘              └───────────────┘
        │                               ▲                               ▲
        │                               │                               │
        │                      ┌────────┴───────────────────────────────┘
        │                      │
        │              ┌───────────────┐
        │              │  chat-types   │
        └──────────────│               │
         workflow      │ Shared TS     │
         reference     │ Package       │
                       └───────────────┘
        ▲
        │
┌───────────────┐              ┌───────────────┐
│   chat-ui     │              │  chat-infra   │
│               │              │               │
│ Playwright    │──────────────│ IaC Scripts   │
│ E2E Tests     │  tests       │ Terraform     │
│               │  against     │               │
└───────────────┘              └───────────────┘
```

## Entities

### Repository

A git repository containing source code for a specific concern.

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | Repository name (e.g., "chat-backend") |
| owner | string | GitHub organization ("MentalHelpGlobal") |
| visibility | enum | public / private |
| default_branch | string | "main" |
| protected_branches | string[] | ["main", "develop"] |
| secrets | Secret[] | Environment secrets for CI/CD |
| variables | Variable[] | Non-sensitive CI/CD variables |

**Instances**:
- chat-backend
- chat-frontend
- chat-ui
- chat-infra
- chat-ci
- chat-types

### Shared Package

A versioned npm package published to GitHub Packages.

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | "@mhg/chat-types" |
| version | semver | "1.0.0" (semantic versioning) |
| registry | url | "https://npm.pkg.github.com" |
| exports | Module[] | TypeScript modules exported |
| consumers | Repository[] | Repositories that depend on this package |

**Constraints**:
- Version MUST follow semantic versioning (MAJOR.MINOR.PATCH)
- Breaking changes MUST increment MAJOR version
- Consumers MUST pin to compatible version range (^1.0.0)

### Reusable Workflow

A GitHub Actions workflow callable from other repositories.

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | Workflow identifier |
| path | string | ".github/workflows/{name}.yml" |
| trigger | enum | workflow_call |
| inputs | Input[] | Parameters accepted from caller |
| secrets | Secret[] | Secrets required from caller |
| outputs | Output[] | Values returned to caller |

**Instances in chat-ci**:
- test-backend.yml
- test-frontend.yml
- test-e2e.yml
- deploy-backend.yml
- deploy-frontend.yml
- build-docker.yml
- contract-check.yml

### Environment

A deployment target with specific configuration.

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | "dev" / "staging" / "prod" |
| backend_url | url | Cloud Run service URL |
| frontend_url | url | GCS bucket URL |
| gcp_project | string | GCP project ID |
| secrets | Secret[] | Environment-specific secrets |

**Instances**:
- dev: Development environment
- staging: Pre-production testing
- prod: Production environment

### API Contract

A specification of the interface between frontend and backend.

| Attribute | Type | Description |
|-----------|------|-------------|
| version | semver | API version (e.g., "1.0.0") |
| endpoints | Endpoint[] | REST endpoint definitions |
| types | TypeDefinition[] | Request/response type definitions |
| breaking_changes | BreakingChange[] | Log of breaking changes |

## Relationships

### Repository Dependencies

```
chat-backend ──depends on──► @mhg/chat-types
chat-frontend ──depends on──► @mhg/chat-types
chat-ui ──tests──► chat-frontend + chat-backend
```

### Workflow Inheritance

```
chat-backend ──calls──► chat-ci/test-backend.yml
chat-backend ──calls──► chat-ci/deploy-backend.yml
chat-frontend ──calls──► chat-ci/test-frontend.yml
chat-frontend ──calls──► chat-ci/deploy-frontend.yml
chat-ui ──calls──► chat-ci/test-e2e.yml
chat-types ──calls──► chat-ci (publish workflow)
```

### Deployment Dependencies

```
chat-infra ──provisions──► GCP resources
chat-backend ──deploys to──► Cloud Run
chat-frontend ──deploys to──► GCS
chat-ui ──tests against──► deployed environments
```

## State Transitions

### Repository Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Empty   │────►│Populated │────►│ Active   │────►│ Archived │
│          │     │(filtered)│     │(deployed)│     │(readonly)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
   create        git-filter-repo   CI/CD active    archived
```

### Package Version Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Draft   │────►│Published │────►│Deprecated│────►│ Removed  │
│          │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
   develop       npm publish      deprecation     unpublish
                 to GH Packages   notice added    (rare)
```

### Migration Phase Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│Monorepo  │────►│ Parallel │────►│ Cutover  │────►│Split Only│
│  Only    │     │Operation │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
   current       both deployed    traffic shift   monorepo
   state         and functional   to new repos    archived
```

## Validation Rules

### Repository Constraints

1. Each repository MUST have branch protection on `main` and `develop`
2. Each repository MUST reference `chat-ci` workflows (no inline CI)
3. Each repository MUST pass all tests before merge to `develop`
4. Direct commits to `main` MUST be blocked

### Package Constraints

1. `@mhg/chat-types` version MUST be pinned in `package.json` (not "latest")
2. Breaking type changes MUST increment MAJOR version
3. All consumers MUST update within 1 sprint of MAJOR release

### Workflow Constraints

1. Workflows MUST be pinned to version tags (@v1.0.0), not branches
2. Workflow changes MUST be tested in sandbox before production use
3. `secrets: inherit` MUST be used for cleaner configuration

### Environment Constraints

1. Production deployments MUST pass all E2E tests first
2. Environment variables MUST NOT be hardcoded (use GitHub secrets)
3. API version compatibility MUST be validated before frontend deployment
