# Cross-Repository Dependency Diagram

## Package Dependencies

```
@mentalhelpglobal/chat-types (npm package on GitHub Packages)
    │
    ├──► chat-backend (depends via package.json)
    │      └── src/types/ re-exports from @mentalhelpglobal/chat-types
    │
    └──► chat-frontend (depends via package.json)
           └── src/types/ re-exports from @mentalhelpglobal/chat-types
```

## CI/CD Dependencies

```
chat-ci (reusable GitHub Actions workflows, tagged @v1)
    │
    ├──► chat-backend/.github/workflows/ci.yml
    │      ├── uses: test-backend.yml@v1
    │      └── uses: deploy-backend.yml@v1
    │
    ├──► chat-frontend/.github/workflows/ci.yml
    │      ├── uses: test-frontend.yml@v1
    │      └── uses: deploy-frontend.yml@v1
    │
    └──► chat-ui/.github/workflows/ci.yml
           └── uses: test-e2e.yml@v1
```

## Runtime Dependencies

```
chat-frontend (React SPA)
    │
    ├──► chat-backend (API calls via VITE_API_URL)
    │      │
    │      ├──► PostgreSQL (DATABASE_URL)
    │      └──► Dialogflow CX (DIALOGFLOW_* env vars)
    │
    └──► X-API-Version header (contract check)

chat-ui (Playwright E2E)
    │
    └──► chat-frontend + chat-backend (via PLAYWRIGHT_BASE_URL)
```

## Infrastructure Dependencies

```
chat-infra
    │
    ├──► GCP Cloud Run (chat-backend deployment target)
    ├──► GCP Cloud SQL (database)
    ├──► GCP GCS (chat-frontend deployment target)
    ├──► GCP Artifact Registry (Docker images)
    └──► GCP Workload Identity Federation (GitHub Actions auth)
```

## Repository Overview

| Repository | Type | Depends On | Depended By |
|------------|------|-----------|-------------|
| `chat-types` | npm package | - | chat-backend, chat-frontend |
| `chat-ci` | GHA workflows | - | chat-backend, chat-frontend, chat-ui |
| `chat-backend` | Express API | chat-types, chat-ci | chat-frontend, chat-ui |
| `chat-frontend` | React SPA | chat-types, chat-ci | chat-ui |
| `chat-ui` | Playwright | chat-ci | - |
| `chat-infra` | IaC scripts | - | - |
| `client-spec` | Orchestration | - | - |

## Update Propagation

When updating shared dependencies:

1. **chat-types change** → Bump version, publish → Update chat-backend + chat-frontend package.json → CI runs
2. **chat-ci workflow change** → Push to chat-ci, update tag → Next CI run in consumers picks up changes
3. **API contract change** → Update backend API_VERSION → contract-check.yml validates compatibility
