# CLAUDE.md - Chat CI

## Project Overview

Reusable GitHub Actions workflows for the Mental Health Chat application monorepo. All CI/CD logic is centralized here and consumed by other repos via `uses:` references.

## Workflows

| Workflow | Purpose | Consumer |
|----------|---------|----------|
| `test-backend.yml` | Node.js test + coverage | chat-backend |
| `test-frontend.yml` | Lint + test + optional build | chat-frontend |
| `test-e2e.yml` | Playwright E2E tests | chat-ui |
| `deploy-backend.yml` | Docker build + Cloud Run deploy | chat-backend |
| `deploy-frontend.yml` | Vite build + GCS upload | chat-frontend |
| `build-docker.yml` | Docker build + Artifact Registry push | chat-backend |
| `contract-check.yml` | X-API-Version semver check | chat-frontend |

## Usage

Consumer repos reference workflows like:

```yaml
jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-backend.yml@v1
    with:
      coverage-threshold: 45
    secrets: inherit
```

## Versioning

- Tag `v1` (floating) points to the latest compatible release
- Tag `v1.0.0` (fixed) for pinned references
- Breaking changes require a `v2` tag

## Key Design Decisions

- All workflows use `workflow_call` trigger (reusable)
- `GITHUB_TOKEN` is passed via `secrets: inherit` for private npm packages
- GCP authentication uses Workload Identity Federation (no service account keys)
