# chat-ci

Centralized CI/CD workflows for Mental Health Global chat application repositories.

## Available Workflows

| Workflow | Purpose | Consumer |
|----------|---------|----------|
| `test-backend.yml` | Run backend unit tests with coverage | chat-backend |
| `test-frontend.yml` | Run frontend lint, unit tests, and build | chat-frontend |
| `test-e2e.yml` | Run Playwright E2E tests against deployed env | chat-ui |
| `deploy-backend.yml` | Build Docker + deploy to Cloud Run | chat-backend |
| `deploy-frontend.yml` | Build + deploy static files to GCS | chat-frontend |
| `build-docker.yml` | Build and push Docker image to Artifact Registry | chat-backend |
| `contract-check.yml` | Validate API version compatibility | chat-frontend |

## Usage

Reference workflows from your repository using `workflow_call`:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-backend.yml@v1
    with:
      coverage-threshold: 45
    secrets: inherit
```

## Versioning

- Pin to major version tag: `@v1` (recommended)
- Pin to exact version: `@v1.0.0`
- MINOR updates are backward-compatible
- MAJOR bumps require updating the reference

## Workflow Inputs

### test-backend.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| node-version | string | '20' | Node.js version |
| working-directory | string | '.' | Directory with package.json |
| coverage-threshold | number | 45 | Minimum coverage % |

### test-frontend.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| node-version | string | '20' | Node.js version |
| coverage-threshold | number | 25 | Minimum coverage % |
| run-build | boolean | true | Also run production build |

### test-e2e.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| base-url | string | required | Frontend URL to test |
| test-email | string | playwright@mentalhelp.global | Auth email |
| timeout | number | 90000 | Test timeout (ms) |
| retries | number | 1 | Retry count |

### deploy-backend.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| environment | string | required | dev/staging/prod |
| service-name | string | required | Cloud Run service name |
| region | string | europe-west1 | GCP region |
| min-instances | number | 0 | Min Cloud Run instances |
| max-instances | number | 10 | Max Cloud Run instances |
| memory | string | 512Mi | Container memory |
| cpu | string | 1 | Container CPU |

### deploy-frontend.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| environment | string | required | dev/staging/prod |
| bucket-name | string | required | GCS bucket name |
| backend-url | string | required | Backend API URL |

### contract-check.yml

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| backend-url | string | required | Backend health endpoint |
| required-version | string | required | Minimum API version |
