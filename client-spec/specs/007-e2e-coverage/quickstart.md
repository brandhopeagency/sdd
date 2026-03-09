# Quickstart: E2E Test Coverage Expansion

**Feature**: 007-e2e-coverage | **Date**: 2026-02-08

## Prerequisites

1. **Node.js 20+** and npm installed
2. **Playwright browsers** installed: `npx playwright install chromium`
3. **Dev environment running**: `chat-backend-dev` on Cloud Run + GCS frontend
4. **Test accounts seeded**: Run `seed-e2e-accounts.sql` against the dev database (one-time)
5. **Console OTP provider**: Dev environment `EMAIL_PROVIDER` set to `console`

## Running Tests

### Against Deployed Dev Environment

```bash
# From chat-ui/ or chat-client/ root
PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/mhg-chat-client-dev/index.html" \
PLAYWRIGHT_EMAIL="e2e-owner@test.local" \
npx playwright test
```

### Against Local Dev Server

```bash
# Start the frontend (in another terminal)
npm run dev -- --host --port 4173

# Run tests (defaults to http://localhost:4173)
npx playwright test
```

### Running Specific Test Files

```bash
# Single file
npx playwright test tests/e2e/review/review-queue.spec.ts

# Single area
npx playwright test tests/e2e/auth/

# By grep pattern
npx playwright test --grep "review"
```

### Headed Mode (Debugging)

```bash
npx playwright test --headed --timeout=90000
```

### Playwright UI Mode

```bash
npx playwright test --ui
```

## Test Accounts

| Role | Email | Workbench? | Use For |
|------|-------|-----------|---------|
| User | `e2e-user@test.local` | No | Auth, chat |
| QA Specialist | `e2e-qa@test.local` | No | Chat debug toggle |
| Researcher | `e2e-researcher@test.local` | Yes | Research list |
| Moderator | `e2e-moderator@test.local` | Yes | Workbench, users, research, moderation |
| Group Admin | `e2e-group-admin@test.local` | Yes | Group dashboard |
| Owner | `e2e-owner@test.local` | Yes | Privacy, review, groups (all access) |

## Writing New Tests

### File Location

Place test files in the appropriate directory under `tests/e2e/`:

```
tests/e2e/
├── auth/           # Authentication, login, logout, route guards
├── chat/           # Chat interface, messages, feedback
├── groups/         # Group lifecycle, invites, membership
├── review/         # Review queue, session review
└── workbench/      # Workbench sections, user management, research, privacy
```

### Test Template

```typescript
import { test, expect } from '../fixtures/authTest';  // authenticated tests
// OR
import { test, expect } from '../fixtures/e2eTest';   // unauthenticated tests

test.describe('feature: area name', () => {
  test('descriptive test name with context', async ({ page }) => {
    // Navigate
    await page.goto('/#/route');

    // Act
    await page.getByRole('button', { name: /action/i }).click();

    // Assert
    await expect(page.getByRole('heading', { name: /expected/i })).toBeVisible();
  });
});
```

### Role-Specific Tests

```typescript
import { test, expect } from '../fixtures/authTest';

// Override the role for this test file
test.use({ role: 'moderator' });

test('moderator can access user management', async ({ page }) => {
  await page.goto('/#/workbench/users');
  await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
});
```

### Key Patterns

1. **Use `getByRole()` and `getByPlaceholder()`** — not CSS selectors or test IDs
2. **Use regex for text matching** — `/send code$/i` instead of exact strings
3. **Don't assert AI response text** — only assert a non-empty response bubble appears
4. **Use `expect.poll()` for async state** — when waiting for data to appear
5. **Skip when preconditions fail** — use `test.skip(condition, 'reason')` instead of hard failure
6. **Initialize language** — call `initLanguage(page, 'en')` before navigation if locators depend on English text

### OTP Login in Tests

```typescript
import { loginWithOtp } from '../helpers/auth';

test('requires fresh OTP login', async ({ page }) => {
  await loginWithOtp(page, 'e2e-user@test.local');
  // page is now authenticated and on the chat page
});
```

For most tests, use the `authTest` fixture instead — it handles storage state caching automatically.

## CI Integration

### Automatic Trigger

The E2E suite runs automatically after every successful deploy to the dev environment (triggered by the `Deploy to GCP` workflow completing on the `develop` branch).

### Manual Trigger

Go to Actions → "E2E Tests (Dev)" → Run workflow → fill in `base_url` and `email`.

### Viewing Results

1. **In the PR**: Check status shows pass/fail
2. **Artifacts**: Download `playwright-report` for HTML report, `test-results` for logs/screenshots
3. **Repro files**: Failed tests generate `repro.md` with exact commands to reproduce locally

## Seed Data Setup

### One-Time Setup

```bash
# Connect to dev database via Cloud SQL Proxy
gcloud sql connect chat-db-dev --user=chat_user --database=chat_app

# Run seed script
\i path/to/seed-e2e-accounts.sql

# Verify
SELECT email, role, status FROM users WHERE email LIKE 'e2e-%@test.local';
```

### Expected Output

```
          email           |     role      | status
--------------------------+---------------+--------
 e2e-user@test.local      | user          | active
 e2e-qa@test.local        | qa_specialist | active
 e2e-researcher@test.local| researcher    | active
 e2e-moderator@test.local | moderator     | active
 e2e-group-admin@test.local| group_admin  | active
 e2e-owner@test.local     | owner         | active
(6 rows)
```

## Debugging Tips

1. **Headed mode**: Run with `--headed` to watch the browser
2. **UI mode**: Run with `--ui` for Playwright's interactive test runner
3. **Trace viewer**: On retry, traces are captured — view with `npx playwright show-trace trace.zip`
4. **Console logs**: Check `browser-logs.json` in test results for captured console output
5. **Screenshots**: Failed tests automatically capture `failure.png`
6. **Repro command**: Each failed test generates a `repro.md` with the exact command to reproduce

## Dual-Target Reminder

All test files exist in both repositories:

| Split Repo | Monorepo |
|-----------|----------|
| `chat-ui/tests/e2e/` | `chat-client/tests/e2e/` |
| `chat-ui/playwright.config.ts` | `chat-client/playwright.config.ts` |

When adding or modifying tests, update both locations. The files should be identical.
