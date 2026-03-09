# Contract: Playwright globalSetup

**Feature**: 008-e2e-test-standards  
**Date**: 2026-02-10

## Overview

The `globalSetup` function runs once before any Playwright test worker starts. It performs two phases: database seeding and runtime pre-flight checks.

## Interface

```typescript
// tests/e2e/global-setup.ts
export default async function globalSetup(config: FullConfig): Promise<void>
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PLAYWRIGHT_BASE_URL` | No | `http://localhost:4173` | Frontend URL for CDN checks |

## Phase 1: Seed Test Users

**Input**: `TEST_ROLES` from `tests/e2e/fixtures/roles.ts`

**SQL operation** (per role):

```sql
INSERT INTO users (email, role, status, approved_at, created_at, updated_at)
VALUES ($1, $2, 'active', NOW(), NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active',
  approved_at = COALESCE(users.approved_at, NOW()),
  updated_at = NOW();
```

**Parameters**:
- `$1`: `TEST_ROLES[key].email`
- `$2`: `TEST_ROLES[key].role`

**Error behavior**:
- Database unreachable → Log warning, continue (tests will fail individually with clear auth errors)
- Invalid role value → Log error and abort (indicates `roles.ts` and `UserRole` enum are out of sync)

## Phase 2: Pre-flight Checks

### CDN Cache Header Check

**Request**: `HEAD ${PLAYWRIGHT_BASE_URL}`

**Expected response headers**:
- `Cache-Control` contains `no-cache` OR `no-store` OR `must-revalidate`

**Error behavior**:
- Request fails → Log warning, continue (local dev or network issue)
- Wrong Cache-Control → Log warning with actual header value, continue

### Backend Health Check

**Request**: `GET ${API_BASE_URL}/health` (derived from `PLAYWRIGHT_BASE_URL` config or separate env var)

**Expected response**: HTTP 200

**Error behavior**:
- Request fails → Log warning, continue
- Non-200 response → Log warning with status code, continue

## Output

The function logs a summary to stdout:

```
[globalSetup] Seed: 6/6 test users verified ✓
[globalSetup] CDN:  Cache-Control: no-cache confirmed ✓
[globalSetup] API:  Health check passed ✓
```

Or with warnings:

```
[globalSetup] Seed: 6/6 test users verified ✓
[globalSetup] CDN:  ⚠ Cache-Control header is "public, max-age=3600" — expected no-cache
[globalSetup] API:  ⚠ Health check failed: ECONNREFUSED
```
