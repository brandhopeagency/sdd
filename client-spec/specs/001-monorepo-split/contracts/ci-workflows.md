# CI Workflow Contracts

**Feature**: 001-monorepo-split
**Date**: 2026-02-04

## Overview

This document specifies the reusable GitHub Actions workflows to be created in `chat-ci` repository. Each workflow is designed to be called from other repositories using `workflow_call` trigger.

---

## test-backend.yml

**Purpose**: Run backend unit tests

### Interface

```yaml
name: Backend Unit Tests
on:
  workflow_call:
    inputs:
      node-version:
        description: Node.js version
        type: string
        default: '20'
      working-directory:
        description: Directory containing package.json
        type: string
        default: '.'
      coverage-threshold:
        description: Minimum coverage percentage
        type: number
        default: 45
    secrets:
      GITHUB_TOKEN:
        required: true
    outputs:
      coverage:
        description: Coverage percentage achieved
        value: ${{ jobs.test.outputs.coverage }}
```

### Behavior

1. Checkout repository
2. Setup Node.js with specified version
3. Install dependencies (`npm ci`)
4. Run tests with coverage (`npm run test:coverage`)
5. Fail if coverage below threshold
6. Output coverage percentage

### Consumer Example

```yaml
# chat-backend/.github/workflows/ci.yml
jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-backend.yml@v1
    with:
      coverage-threshold: 45
    secrets: inherit
```

---

## test-frontend.yml

**Purpose**: Run frontend unit tests and build validation

### Interface

```yaml
name: Frontend Unit Tests
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
      coverage-threshold:
        type: number
        default: 25
      run-build:
        description: Also run production build
        type: boolean
        default: true
    secrets:
      GITHUB_TOKEN:
        required: true
    outputs:
      coverage:
        value: ${{ jobs.test.outputs.coverage }}
```

### Behavior

1. Checkout repository
2. Setup Node.js
3. Install dependencies
4. Run linting (`npm run lint`)
5. Run tests with coverage
6. Optionally run build (`npm run build`)
7. Fail if coverage below threshold

### Consumer Example

```yaml
# chat-frontend/.github/workflows/ci.yml
jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-frontend.yml@v1
    with:
      coverage-threshold: 25
      run-build: true
    secrets: inherit
```

---

## test-e2e.yml

**Purpose**: Run Playwright E2E tests against deployed environment

### Interface

```yaml
name: E2E Tests
on:
  workflow_call:
    inputs:
      base-url:
        description: Frontend URL to test against
        type: string
        required: true
      test-email:
        description: Email for OTP authentication
        type: string
        default: 'playwright@mentalhelp.global'
      timeout:
        description: Test timeout in milliseconds
        type: number
        default: 90000
      retries:
        description: Number of test retries
        type: number
        default: 1
    secrets:
      GITHUB_TOKEN:
        required: true
    outputs:
      passed:
        value: ${{ jobs.e2e.outputs.passed }}
      report-url:
        value: ${{ jobs.e2e.outputs.report-url }}
```

### Behavior

1. Checkout repository
2. Setup Node.js
3. Install dependencies
4. Install Playwright browsers
5. Run tests with specified base URL
6. Upload test results and HTML report as artifacts
7. Output pass/fail status and report URL

### Consumer Example

```yaml
# chat-ui/.github/workflows/ci.yml
jobs:
  e2e:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-e2e.yml@v1
    with:
      base-url: 'https://storage.googleapis.com/mhg-dev-frontend/index.html'
      timeout: 90000
    secrets: inherit
```

---

## deploy-backend.yml

**Purpose**: Build Docker image and deploy to Cloud Run

### Interface

```yaml
name: Deploy Backend
on:
  workflow_call:
    inputs:
      environment:
        description: Target environment (dev/staging/prod)
        type: string
        required: true
      service-name:
        description: Cloud Run service name
        type: string
        required: true
      region:
        description: GCP region
        type: string
        default: 'europe-west1'
      min-instances:
        type: number
        default: 0
      max-instances:
        type: number
        default: 10
      memory:
        type: string
        default: '512Mi'
      cpu:
        type: string
        default: '1'
    secrets:
      GCP_PROJECT_ID:
        required: true
      GCP_SA_KEY:
        required: true
      # Environment-specific secrets passed through
```

### Behavior

1. Authenticate with GCP using Workload Identity Federation
2. Build Docker image with commit SHA tag
3. Push to Artifact Registry
4. Deploy to Cloud Run with specified configuration
5. Output service URL

### Consumer Example

```yaml
# chat-backend/.github/workflows/deploy.yml
jobs:
  deploy:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/deploy-backend.yml@v1
    with:
      environment: ${{ github.ref == 'refs/heads/main' && 'prod' || 'dev' }}
      service-name: chat-backend
    secrets: inherit
```

---

## deploy-frontend.yml

**Purpose**: Build and deploy static frontend to GCS

### Interface

```yaml
name: Deploy Frontend
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      bucket-name:
        description: GCS bucket name
        type: string
        required: true
      backend-url:
        description: Backend API URL for build
        type: string
        required: true
    secrets:
      GCP_PROJECT_ID:
        required: true
      GCP_SA_KEY:
        required: true
```

### Behavior

1. Authenticate with GCP
2. Install dependencies
3. Build with VITE_API_URL set to backend URL
4. Sync to GCS bucket using gsutil
5. Set cache headers (no-cache for index.html, long cache for /assets/)

### Consumer Example

```yaml
# chat-frontend/.github/workflows/deploy.yml
jobs:
  deploy:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/deploy-frontend.yml@v1
    with:
      environment: dev
      bucket-name: mhg-dev-frontend
      backend-url: https://chat-backend-dev-xxx.run.app
    secrets: inherit
```

---

## contract-check.yml

**Purpose**: Validate API compatibility between frontend and backend versions

### Interface

```yaml
name: API Contract Check
on:
  workflow_call:
    inputs:
      backend-url:
        description: Backend health endpoint
        type: string
        required: true
      required-version:
        description: Minimum required API version
        type: string
        required: true
    outputs:
      compatible:
        value: ${{ jobs.check.outputs.compatible }}
      backend-version:
        value: ${{ jobs.check.outputs.backend-version }}
```

### Behavior

1. Fetch backend health endpoint
2. Extract X-API-Version header
3. Compare against required version using semver
4. Output compatibility status

### Consumer Example

```yaml
# chat-frontend/.github/workflows/deploy.yml
jobs:
  check-api:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/contract-check.yml@v1
    with:
      backend-url: https://chat-backend-dev.run.app/health
      required-version: '1.0.0'

  deploy:
    needs: check-api
    if: needs.check-api.outputs.compatible == 'true'
    # ... deploy job
```

---

## build-docker.yml

**Purpose**: Build and push Docker image to Artifact Registry

### Interface

```yaml
name: Build Docker Image
on:
  workflow_call:
    inputs:
      dockerfile:
        type: string
        default: 'Dockerfile'
      context:
        type: string
        default: '.'
      image-name:
        type: string
        required: true
      tag:
        type: string
        default: ${{ github.sha }}
    secrets:
      GCP_PROJECT_ID:
        required: true
      GCP_SA_KEY:
        required: true
    outputs:
      image-url:
        value: ${{ jobs.build.outputs.image-url }}
```

### Behavior

1. Authenticate with GCP
2. Configure Docker for Artifact Registry
3. Build image with specified Dockerfile
4. Tag with commit SHA and optional additional tags
5. Push to Artifact Registry
6. Output full image URL

---

## Versioning Strategy

### Semantic Versioning

Workflows follow semantic versioning:
- **v1.0.0**: Initial release
- **v1.1.0**: New features (backward compatible)
- **v1.1.1**: Bug fixes
- **v2.0.0**: Breaking changes (input/output changes)

### Version Tags

```
v1       → Latest v1.x.x (use for production)
v1.0     → Latest v1.0.x
v1.0.0   → Exact version
main     → Latest (not recommended for production)
```

### Upgrade Policy

1. MINOR updates: Consumers automatically get improvements
2. MAJOR updates: Consumers must update reference (v1 → v2)
3. Deprecation notice: 2 sprints before removal

---

## Testing Strategy

### Sandbox Repository

Create `chat-ci-sandbox` repository for testing workflow changes:

1. Fork workflow with changes
2. Reference fork in sandbox repo
3. Run full CI/CD cycle
4. Merge to main after validation
5. Create version tag

### Required Tests

Before releasing new workflow version:
- [ ] All input combinations tested
- [ ] Error handling validated
- [ ] Output values verified
- [ ] Secrets properly masked in logs
- [ ] Backward compatibility confirmed (minor versions)
