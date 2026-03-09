# Quickstart: Split Frontend Into Client and Workbench Applications

**Feature**: 001-split-workbench-app
**Date**: 2026-02-21

## Prerequisites

- Node.js 18+ and npm 9+
- Access to `MentalHelpGlobal` GitHub organization
- GitHub Packages registry configured for `@mentalhelpglobal` scope
- All sibling repositories cloned at `D:\src\MHG\`

## Repository Layout (After Split)

```
D:\src\MHG\
├── client-spec/              # This repo — specifications and plans
├── chat-frontend/            # Chat application (trimmed — chat-only)
├── workbench-frontend/       # Workbench application (NEW)
├── chat-frontend-common/     # Shared UI package (NEW)
├── chat-types/               # Shared TypeScript types
├── chat-backend/             # Backend API (no changes)
├── chat-infra/               # Infrastructure scripts
├── chat-ci/                  # CI/CD workflows
├── chat-ui/                  # Playwright E2E tests
└── chat-client/              # LEGACY — do not modify
```

## Step 1 — Set Up chat-frontend-common

```bash
cd D:\src\MHG\chat-frontend-common

# Install dependencies
npm install

# Build the package
npm run build

# For local development (consumed by chat-frontend and workbench-frontend):
# No publish needed — consumer apps use resolve.alias in development
```

### Package Contents

The shared package exports:
- **Auth components**: `WelcomeScreen`, `LoginPage`, `PendingApprovalPage`, `OtpLoginForm`
- **Auth store**: `useAuthStore` (Zustand with persist)
- **API client**: `apiClient` (Axios instance with auth interceptors), `authApi`
- **Shared components**: `LanguageSelector`, `GroupScopeRoute`, `RegisterPopup`, route error pages
- **Utils**: `permissions.ts`, `piiMasking.ts`
- **i18n**: `initI18n()` setup function, `common` namespace translations (uk, en, ru)
- **Types**: Re-exports from `@mentalhelpglobal/chat-types`
- **Tailwind preset**: `tailwind-preset.js` (colors, fonts, spacing, breakpoints)

## Step 2 — Set Up chat-frontend (Trimmed)

```bash
cd D:\src\MHG\chat-frontend

# Install dependencies (includes chat-frontend-common)
npm install

# Run development server
npm run dev
# → Opens at http://localhost:5173

# For local development with chat-frontend-common source:
LOCAL_COMMON=1 npm run dev
```

### Environment Variables

| Variable | Dev Value | Description |
|----------|-----------|-------------|
| `VITE_API_URL` | `https://api.dev.mentalhelp.chat` | Chat backend API |
| `VITE_WORKBENCH_URL` | `https://workbench.dev.mentalhelp.chat` | Workbench app URL (for cross-surface links) |
| `VITE_ALLOW_GUEST_ACCESS` | `true` | Enable guest chat mode |

### Key Changes From Pre-Split

- No workbench routes, stores, or components
- No surface detection (`getSurface()` removed — always chat)
- Cross-surface link to workbench uses full external URL from `VITE_WORKBENCH_URL`
- Auth, i18n, and shared components imported from `@mentalhelpglobal/chat-frontend-common`
- New `public/manifest.json` for PWA installability

## Step 3 — Set Up workbench-frontend (New)

```bash
cd D:\src\MHG\workbench-frontend

# Install dependencies (includes chat-frontend-common)
npm install

# Run development server
npm run dev
# → Opens at http://localhost:5174

# For local development with chat-frontend-common source:
LOCAL_COMMON=1 npm run dev
```

### Environment Variables

| Variable | Dev Value | Description |
|----------|-----------|-------------|
| `VITE_API_URL` | `https://api.workbench.dev.mentalhelp.chat` | Workbench backend API |
| `VITE_CHAT_URL` | `https://dev.mentalhelp.chat` | Chat app URL (for cross-surface links) |

### Key Differences From chat-frontend

- Workbench routes only (`/workbench/*` with ~25 sub-routes)
- Requires `WORKBENCH_ACCESS` permission at root level
- Contains `workbenchStore`, `reviewStore`, `reviewApi`, `tagApi`
- Admin API functions (users, sessions, groups, approvals, audit)
- No PWA manifest (workbench is desktop-oriented)
- "Back to Chat" link uses full external URL from `VITE_CHAT_URL`

## Step 4 — Run Tests

```bash
# Unit tests (each repo independently)
cd D:\src\MHG\chat-frontend && npm test
cd D:\src\MHG\workbench-frontend && npm test
cd D:\src\MHG\chat-frontend-common && npm test

# E2E tests (against deployed dev environment)
cd D:\src\MHG\chat-ui && npx playwright test
```

## Step 5 — Deploy (CI/CD)

Deployment is triggered automatically by pushes to `develop` (dev) or `main` (prod) via GitHub Actions.

| Repository | Workflow | Deploys To |
|------------|----------|------------|
| `chat-frontend` | `deploy-chat-frontend.yml` | GCS bucket for chat surface |
| `workbench-frontend` | `deploy-workbench-frontend.yml` | GCS bucket for workbench surface |
| `chat-frontend-common` | `publish-chat-frontend-common.yml` | GitHub Packages |

### Manual Deployment

```bash
# Build chat frontend
cd D:\src\MHG\chat-frontend
npm run build
gsutil -m rsync -r -d dist/ gs://mental-help-global-25-dev-frontend/

# Build workbench frontend
cd D:\src\MHG\workbench-frontend
npm run build
gsutil -m rsync -r -d dist/ gs://mental-help-global-25-dev-workbench-frontend/
```

## Verification Checklist

After deployment, verify:

- [ ] `dev.mentalhelp.chat` loads chat app with chat-only navigation
- [ ] `workbench.dev.mentalhelp.chat` loads workbench app with workbench-only navigation
- [ ] Sign in on chat → navigate to workbench → authenticated without re-login
- [ ] Sign out on workbench → chat tab shows signed-out state on next interaction
- [ ] Visit `dev.mentalhelp.chat/workbench/users` → redirected to workbench domain
- [ ] Visit `workbench.dev.mentalhelp.chat/chat` → redirected to chat domain
- [ ] Unauthorized user accessing workbench → access denied with link back to chat
- [ ] Chat PWA install prompt appears on supported browsers
- [ ] Chat app is responsive on mobile viewport
- [ ] Both apps display correct language (uk/en/ru) based on browser settings

## Local Development Tips

### Running Both Apps Simultaneously

```bash
# Terminal 1 — Chat frontend (port 5173)
cd D:\src\MHG\chat-frontend && LOCAL_COMMON=1 npm run dev

# Terminal 2 — Workbench frontend (port 5174)
cd D:\src\MHG\workbench-frontend && LOCAL_COMMON=1 npm run dev

# Terminal 3 — Backend (port 8080, all surfaces)
cd D:\src\MHG\chat-backend && npm run dev
```

### Testing Cross-Surface Navigation Locally

Cross-surface links in local dev point to `localhost:5174` (workbench) and `localhost:5173` (chat). Auth sharing via cookies requires both apps to run on `localhost` (same origin for cookie purposes). For full cross-domain testing, use the deployed dev environment.

### Modifying the Shared Package

When editing `chat-frontend-common` with `LOCAL_COMMON=1`:
- Changes to shared source files trigger HMR in the consumer app immediately
- No rebuild or republish needed during local development
- Remember to build and publish the package before merging to `develop`
