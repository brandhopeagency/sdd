# Quickstart: E2E Test Standards & Conventions

**Feature**: 008-e2e-test-standards  
**Date**: 2026-02-10

## Prerequisites

- Node.js 20+ with npm
- Access to the `mental-help-global-25` GCP project
- PostgreSQL client library (`pg`) installed as dev dependency
- `DATABASE_URL` environment variable pointing to the target database

## Developer Workflow

### Running E2E Tests (Self-Bootstrapping)

```bash
# Set environment variables
export PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/<bucket>/index.html"
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Run tests — globalSetup handles seeding automatically
npx playwright test
```

The `globalSetup` script will:
1. Verify/create all test user accounts in the database
2. Check CDN cache headers (warning only)
3. Proceed to run tests

### Running Lint Checks Locally

```bash
# ESLint (includes i18n namespace rule)
npm run lint

# Locale key completeness
npm run lint:locales

# Both (recommended before commit)
npm run lint && npm run lint:locales
```

### Building Frontend for Deployment

```bash
# For non-local environments, VITE_API_URL is REQUIRED
export VITE_API_URL="https://chat-backend-dev-942889188964.europe-west1.run.app"
npm run build

# Local development (fallback to localhost:3001 is fine)
npm run dev
```

**Warning**: If `VITE_API_URL` is unset during a production/staging build, the build will **fail** with a clear error message. This is intentional — see FR-007.

### Manual Deployment to GCS (When Not Using CI)

```bash
# Build with correct API URL
export VITE_API_URL="https://your-backend-url"
npm run build

# Upload to GCS
gsutil -m rsync -r -d dist/ gs://your-bucket/

# CRITICAL: Set correct cache headers
gsutil setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://your-bucket/index.html
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" "gs://your-bucket/assets/**"
```

## Writing New E2E Tests — Convention Checklist

### 1. Choose the Right Role

Consult the permission matrix in `tests/e2e/helpers/permissions.ts`:

| Feature Area | Minimum Role |
|-------------|-------------|
| `/chat` | `user` |
| `/workbench` (any) | `researcher` |
| `/workbench` + user management | `moderator` |
| `/workbench` + privacy | `owner` |
| `/workbench` + group admin | `group_admin` |

### 2. Navigate Directly

```typescript
// GOOD — direct navigation for setup
await gotoRoute(page, '/workbench/review')

// BAD — fragile sidebar click for setup
await page.getByRole('button', { name: /review/i }).click()
```

Use sidebar clicks ONLY when testing sidebar behavior.

### 3. Add Permission Guards

```typescript
// Always add this guard after navigating to a protected route
if (/#\/chat(\/|$)/.test(page.url())) {
  test.skip(true, 'Account lacks workbench:access')
}
```

### 4. Use Specific Locators

```typescript
// GOOD — scoped to nav container
page.locator('nav').getByRole('button', { name: /approvals/i })

// GOOD — specific element type
page.locator('p').getByText(/request failed/i)

// BAD — matches multiple elements
page.getByText(/approvals/i)
```

### 5. Handle PII Masking

```typescript
// GOOD — structural assertion
const rowCount = await page.locator('tbody tr').count()
expect(rowCount).toBeGreaterThan(0)

// BAD — depends on visible PII text
const rowText = await page.locator('tbody tr').first().textContent()
expect(rowText).toContain('e2e-user@test.local')
```

### 6. Use Correct i18n Namespace

When adding components to a feature area with its own namespace:

```typescript
// GOOD — explicit namespace
const { t } = useTranslation('review')

// BAD — falls back to default namespace, renders raw keys
const { t } = useTranslation()
```

## Environment Variables Reference

| Variable | Required | Context | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes (non-local builds) | Build time | Backend API URL embedded in frontend bundle |
| `PLAYWRIGHT_BASE_URL` | Yes (remote testing) | Test time | Frontend URL for Playwright to navigate to |
| `DATABASE_URL` | Yes (seeding) | Test time | PostgreSQL connection string for globalSetup seed |

## Affected Repositories

| Repository | Changes |
|-----------|---------|
| `chat-client` | ESLint rule, locale check script, Vite plugin, globalSetup, permission helpers |
| `chat-frontend` | ESLint rule, locale check script, Vite plugin (mirror of chat-client changes) |
| `chat-ui` | globalSetup, permission helpers (mirror of chat-client E2E changes) |
| `chat-ci` | No changes (deploy.yml already correct) |
