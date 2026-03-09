# UI E2E (Playwright) – Dev environment

This document describes **all UI E2E test cases** implemented under `tests/e2e/`, how they validate UI/UX + system behavior, and how **console/network logs**, **steps-to-reproduce**, and **screenshots** are produced (locally and in CI).

## Target environment

- **Dev (deployed)**: `https://storage.googleapis.com/mental-help-global-25-dev-frontend/index.html`
- The app uses **HashRouter**, so navigations use `#/...` routes (handled by `tests/e2e/helpers/routes.ts`).

## How OTP login works in tests

- The app logs an OTP `devCode` to the **browser console** in dev/test environments (see `src/stores/authStore.ts`).
- `tests/e2e/helpers/auth.ts` listens to `page.on('console')`, extracts the `devCode`, and completes the OTP flow.

## Running locally

### Run against deployed dev UI

```bash
PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/mental-help-global-25-dev-frontend/index.html" \
PLAYWRIGHT_EMAIL="playwright@mentalhelp.global" \
npm run test:e2e
```

### Run a single file / a single test

```bash
PLAYWRIGHT_BASE_URL="https://storage.googleapis.com/mental-help-global-25-dev-frontend/index.html" \
npx playwright test "tests/e2e/auth/login-otp.spec.ts" --grep "login via OTP" --headed --timeout=90000
```

## What every test checks (best practices)

Each test is written to include:

- **UI rendering**: key controls present, visible, enabled/disabled states correct.
- **System reaction**: navigation, state transitions, API-driven state changes.
- **UX expectations**: obvious CTAs, proper disabling, predictable keyboard behavior, clear error states.
- **Developer console / network sanity**:
  - fail on `console.error`
  - fail on uncaught `pageerror`
  - fail on `requestfailed`
  - always capture logs into an attachment

## Log & artifact policy

All tests that import `test` from `tests/e2e/fixtures/e2eTest.ts` get:

- `browser-logs.json` attached for **every run** (pass/fail), containing:
  - console messages (OTP codes are **masked** in stored logs)
  - `pageerror` entries
  - failed network requests
- On failures (test body failure OR log assertion failure):
  - `repro.md` is written into the test output folder and attached
  - `failure.png` screenshot is captured and attached

You can find artifacts under `test-results/**/` after a run.

## Suites and cases (full list)

### Smoke / boot

- `tests/e2e/smoke.spec.ts`
  - Renders Welcome screen
  - Validates primary CTA visibility
  - Runs with deterministic `language=en`

### Auth

- `tests/e2e/auth/login-otp.spec.ts`
  - OTP login using `devCode` from console
  - Ensures landing in chat UI

- `tests/e2e/auth/otp-validation.spec.ts`
  - Invalid email: browser-native validation blocks submit; verifies validation message exists; ensures the OTP step does not appear
  - Invalid OTP: ensures server-side error is shown and OTP step remains visible

- `tests/e2e/auth/route-guards.spec.ts`
  - Unauthenticated `/chat` redirects to `/login`
  - Unauthenticated `/workbench` redirects to `/login`

- `tests/e2e/auth/route-guards-authenticated.spec.ts`
  - Authenticated `/workbench` redirects to `/chat` **if the user lacks Workbench access**
  - Auto-skips if the account actually has Workbench access (not applicable)

### Chat

- `tests/e2e/chat/guest-chat.spec.ts`
  - Welcome → guest chat path
  - Guest register popup opens and dismisses via backdrop click

- `tests/e2e/chat/chat-session.spec.ts`
  - Keyboard UX: Enter sends; Shift+Enter adds newline
  - Session UX: New Session clears transcript; End Chat returns to Welcome

### Workbench (permission-gated)

Workbench tests are written to **skip** if the current user lacks required permissions.

- `tests/e2e/workbench/workbench-shell.spec.ts`
  - Workbench shell renders (if permitted)
  - “Back to chat” works

- `tests/e2e/workbench/users.spec.ts`
  - User Management list renders (if `workbench:user_management`)
  - “Add User” opens “Create User” modal and closes via Cancel

- `tests/e2e/workbench/research-and-moderation.spec.ts`
  - Research list renders (if `workbench:research`)
  - Moderation view opens (if there is at least one session)

- `tests/e2e/workbench/privacy.spec.ts`
  - Privacy dashboard renders (if `workbench:privacy`)

- `tests/e2e/workbench/settings.spec.ts`
  - Settings page renders key sections + theme buttons

## CI (GitHub Actions) – Dev UI E2E

Workflow: `.github/workflows/ui-e2e-dev.yml`

Behavior:

- Runs Playwright against the deployed dev UI (`PLAYWRIGHT_BASE_URL`).
- Prints a detailed Playwright progress log to job output via `--reporter=line,html`.
- Uploads artifacts:
  - `test-results/` (includes `repro.md` + screenshots on failure, plus per-test logs)
  - `playwright-report/` (HTML report)
- On failures, prints all `test-results/**/repro.md` to job logs as “steps to reproduce”.


