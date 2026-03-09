# Implementation Plan: Split Frontend Into Client and Workbench Applications

**Branch**: `001-split-workbench-app` | **Date**: 2026-02-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-split-workbench-app/spec.md`

## Summary

Split the current `chat-frontend` single-build/dual-deploy application into two independent frontend repositories — one for the client chat experience and one for the workbench — so each application has its own codebase, build pipeline, deployment lifecycle, and domain. The current codebase is already architecturally pre-split (hostname-based surface detection, conditional routing, isolated feature directories, separate GCS buckets). The work involves physically separating the codebase into two repositories, extracting shared code into a common package, updating CI/CD pipelines, and adjusting cross-surface navigation to use full external URLs.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18, Node.js (build tooling)
**Primary Dependencies**: Vite 5, react-router-dom 6, Zustand 5, Tailwind CSS 3, i18next, lucide-react, @mentalhelpglobal/chat-types (shared types via GitHub Packages)
**Storage**: N/A (frontend applications; all state via backend API)
**Testing**: Vitest + React Testing Library (unit); Playwright in `chat-ui` (E2E)
**Target Platform**: Web — GCS static hosting behind Global HTTPS Load Balancer with CDN
**Project Type**: Multi-repository web frontend (two separate Vite/React applications)
**Performance Goals**: No regression from current load times; independent deployments must not increase page load by more than 10%
**Constraints**: Shared authentication via HTTP-only cookies on `.mentalhelp.chat` parent domain; both apps must share session state without re-authentication; existing domain topology already provisioned
**Scale/Scope**: ~30 routes (workbench), ~3 routes (chat); 6 affected repositories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from feature/bugfix branches
- [x] Required approvals and required CI checks are identified for each target repo
- [x] Post-merge hygiene is defined: delete merged remote/local feature branches and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are defined (breakpoints, installability, and mobile-browser coverage)
- [x] Post-deploy smoke checks are defined for critical routes, deep links, and API endpoints

## Affected Repositories

| Repository | Role in This Feature | Key Changes |
|------------|---------------------|-------------|
| `chat-frontend` | Source — client chat application (retain) | Remove workbench code, update routing to chat-only, update cross-surface links to external URLs, add PWA manifest |
| **New: `workbench-frontend`** | Target — new workbench application | New repo with workbench-specific code extracted from `chat-frontend` |
| **New: `chat-frontend-common`** | Shared UI package | Auth components, i18n setup, API client, shared utilities, Tailwind preset |
| `chat-types` | Shared types | No changes expected — already provides the permission/entity types both apps need |
| `chat-infra` | Infrastructure | CI/CD pipeline updates for new repos; GCS buckets and domain routing already provisioned |
| `chat-ci` | CI workflows | New reusable workflows for `workbench-frontend` and `chat-frontend-common`; update existing `deploy-frontend.yml` |
| `chat-ui` | E2E tests | Split test suites by surface; add cross-surface navigation tests |

## Project Structure

### Documentation (this feature)

```text
specs/001-split-workbench-app/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity relationships
├── quickstart.md        # Phase 1: developer setup guide
├── contracts/           # Phase 1: validation contracts
└── tasks.md             # Phase 2: actionable task breakdown
```

### Source Code — chat-frontend (after split)

```text
chat-frontend/
├── src/
│   ├── features/chat/           # Chat UI (ChatShell, ChatInterface, MessageBubble, FeedbackModal)
│   ├── stores/chatStore.ts      # Chat-specific state
│   ├── services/dialogflowService.ts  # Chat API client
│   ├── routes/                  # Chat-only routing (no surface detection needed)
│   ├── App.tsx                  # Simplified — chat routes only
│   ├── main.tsx                 # Entry point
│   ├── config.ts                # Environment config (VITE_API_URL only)
│   └── index.css                # Tailwind entry
├── public/
│   ├── manifest.json            # NEW: PWA manifest for chat
│   └── icons/                   # NEW: PWA icons
├── package.json                 # Depends on chat-frontend-common + chat-types
├── vite.config.ts
└── vitest.config.ts
```

### Source Code — workbench-frontend (new repository)

```text
workbench-frontend/
├── src/
│   ├── features/workbench/      # All workbench UI (WorkbenchShell, Layout, Dashboard, users/, groups/, review/, etc.)
│   ├── stores/
│   │   ├── workbenchStore.ts    # Workbench-specific state
│   │   └── reviewStore.ts       # Review system state
│   ├── services/
│   │   ├── reviewApi.ts         # Review API client
│   │   └── tagApi.ts            # Tag API client
│   ├── routes/                  # Workbench-only routing
│   ├── App.tsx                  # Workbench routes only
│   ├── main.tsx                 # Entry point
│   ├── config.ts                # Environment config (VITE_WORKBENCH_API_URL)
│   └── index.css                # Tailwind entry
├── package.json                 # Depends on chat-frontend-common + chat-types
├── vite.config.ts
└── vitest.config.ts
```

### Source Code — chat-frontend-common (new shared package)

```text
chat-frontend-common/
├── src/
│   ├── auth/                    # Auth components (OtpLoginForm, WelcomeScreen, LoginPage, PendingApprovalPage)
│   ├── stores/authStore.ts      # Auth state management (Zustand)
│   ├── services/
│   │   ├── apiClient.ts         # Base API client with auth interceptors
│   │   └── api.ts               # Auth API functions (login, refresh, me)
│   ├── components/              # Shared UI (LanguageSelector, GroupScopeRoute, RegisterPopup, error pages)
│   ├── utils/                   # Shared utilities (permissions, PII masking)
│   ├── locales/                 # i18n translation files (uk, en, ru) — shared keys only
│   ├── i18n.ts                  # i18next initialization
│   ├── types/                   # Re-exports from @mentalhelpglobal/chat-types
│   └── index.ts                 # Package entry — public API
├── tailwind-preset.js           # Shared Tailwind design tokens (colors, fonts, spacing)
├── package.json                 # Published to GitHub Packages as @mentalhelpglobal/chat-frontend-common
└── tsconfig.json
```

**Structure Decision**: Three repositories — `chat-frontend` (trimmed), `workbench-frontend` (new), `chat-frontend-common` (new shared package). This follows the existing multi-repository pattern from the constitution (Principle VII) and mirrors the `chat-types` shared package model. The shared package avoids code duplication for auth, i18n, and UI primitives while maintaining independent build/deploy for each application.

## Domain Topology (Already Provisioned)

| Surface | Environment | Frontend Domain | API Domain |
|---------|-------------|-----------------|------------|
| Chat | Production | `mentalhelp.chat` | `api.mentalhelp.chat` |
| Chat | Development | `dev.mentalhelp.chat` | `api.dev.mentalhelp.chat` |
| Workbench | Production | `workbench.mentalhelp.chat` | `api.workbench.mentalhelp.chat` |
| Workbench | Development | `workbench.dev.mentalhelp.chat` | `api.workbench.dev.mentalhelp.chat` |

GCS buckets, backend buckets, serverless NEGs, DNS records, and SSL certificates are already provisioned via `chat-infra` scripts. No new infrastructure provisioning is required for domains.

## Authentication & Session Strategy

Both applications share the `.mentalhelp.chat` parent domain. Authentication tokens stored as HTTP-only cookies scoped to `.mentalhelp.chat` will be accessible by both `mentalhelp.chat` and `workbench.mentalhelp.chat`. This satisfies FR-004 (no re-authentication) and FR-005 (shared sign-out).

The `authStore` from `chat-frontend-common` handles token management identically in both apps. The backend CORS configuration already allows both frontend URLs.

## Cross-Surface Navigation

After the split, in-app `navigate()` calls between surfaces must become full external links (`window.location.href` or `<a href>`):

- Chat → Workbench: The workbench button in `ChatInterface` links to `workbench.mentalhelp.chat` (or dev equivalent)
- Workbench → Chat: The "Back to Chat" link in `WorkbenchLayout` links to `mentalhelp.chat` (or dev equivalent)

Cross-surface URLs are resolved from environment config (`VITE_CHAT_URL`, `VITE_WORKBENCH_URL`).

## Legacy Redirect Strategy

The current `legacyRedirects.tsx` handles cross-surface redirects within the same codebase. After the split:

- **Chat app**: If a user visits `/workbench/*` on the chat domain, redirect to `{WORKBENCH_URL}/workbench/*`
- **Workbench app**: If a user visits `/chat/*` on the workbench domain, redirect to `{CHAT_URL}/chat/*`
- **Hash-based deep links**: The `main.tsx` hash migration (`#/path` → `/path`) remains in both apps for backward compatibility

## CI/CD Pipeline Changes

**Current state**: `chat-ci/deploy-frontend.yml` deploys `chat-frontend` to two GCS buckets (chat + workbench) from a single build.

**Target state**: Separate deploy workflows for each app:
- `deploy-chat-frontend.yml`: Builds `chat-frontend`, syncs to `GCS_BUCKET` (chat bucket)
- `deploy-workbench-frontend.yml`: Builds `workbench-frontend`, syncs to `GCS_WORKBENCH_BUCKET` (workbench bucket)
- `publish-chat-frontend-common.yml`: Builds and publishes shared package to GitHub Packages on `main` push

Each workflow triggers independently, enabling FR-008 (independent deployment).

## Test Strategy

| Repository | Test Type | Framework | Focus |
|------------|-----------|-----------|-------|
| `chat-frontend` | Unit | Vitest + RTL | Chat components, chat store, chat routing |
| `workbench-frontend` | Unit | Vitest + RTL | Workbench components, workbench/review stores, workbench routing |
| `chat-frontend-common` | Unit | Vitest + RTL | Auth flow, API client, shared components |
| `chat-ui` | E2E | Playwright | Cross-surface navigation, auth flow, permission enforcement, legacy redirects, chat journeys, workbench journeys |

Post-deploy smoke checks (per constitution VIII):
- Verify chat app loads on `dev.mentalhelp.chat` and `mentalhelp.chat`
- Verify workbench app loads on `workbench.dev.mentalhelp.chat` and `workbench.mentalhelp.chat`
- Verify cross-surface links navigate correctly
- Verify unauthorized workbench access is denied
- Verify legacy bookmark redirects resolve

## Responsive & PWA Strategy

**Chat application**:
- Responsive: mobile/tablet/desktop (existing Tailwind responsive classes preserved)
- PWA: New `manifest.json` with app name, icons, start URL `/chat`, display `standalone`
- Mobile testing: Android Chrome, iOS Safari (per constitution IX)

**Workbench application**:
- Responsive: tablet/desktop (FR-012 — workbench is not a mobile-primary experience)
- PWA: Not required (workbench is a desktop-oriented admin tool)

## Execution Order

1. **Create `chat-frontend-common`** — extract shared code, publish to GitHub Packages
2. **Create `workbench-frontend`** — new repo with workbench code, depends on common package
3. **Trim `chat-frontend`** — remove workbench code, depend on common package, add PWA
4. **Update `chat-ci`** — new deploy workflows for each app
5. **Update `chat-ui`** — split E2E tests by surface, add cross-surface tests
6. **Release validation** — smoke test all domains, verify independent deploy, verify legacy redirects

## Complexity Tracking

No constitution violations. The introduction of a third repository (`chat-frontend-common`) follows the existing shared-package pattern established by `chat-types` and is consistent with Principle VII (Split-Repository First).
