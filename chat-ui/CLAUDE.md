# CLAUDE.md - Chat UI (E2E Tests)

## Project Overview

End-to-end tests for the Mental Health Chat application using Playwright. Tests cover authentication flows, chat sessions, guest mode, and the admin workbench.

## Commands

```bash
npm install                    # Install dependencies
npx playwright install         # Install browser binaries
npm run test:e2e               # Run all E2E tests
npm run test:e2e:headed        # Run tests with visible browser
npm run test:e2e:ui            # Open Playwright UI mode
```

## Architecture

```
tests/e2e/
  auth/           # Authentication flow tests (OTP, route guards)
  chat/           # Chat session and guest chat tests
  workbench/      # Admin workbench tests (users, groups, settings)
  fixtures/       # Playwright test fixtures
  helpers/        # Shared helpers (auth, i18n, routes)
  smoke.spec.ts   # Smoke test
playwright.config.ts  # Playwright configuration
```

### Environment Variables

- `PLAYWRIGHT_BASE_URL` - Target application URL (default: `http://localhost:4173`)
- `PLAYWRIGHT_PORT` - Local dev server port (default: `4173`)

When `PLAYWRIGHT_BASE_URL` is set, the local dev server is not started.

## MCP Integration

`.mcp.json` configures the Playwright MCP server for AI-assisted test authoring.

## CI/CD

Uses `MentalHelpGlobal/chat-ci/.github/workflows/test-e2e.yml@v1` reusable workflow.
