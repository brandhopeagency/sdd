# Implementation Plan: Responsive PWA With Cross-Device E2E Testing

**Branch**: `001-responsive-pwa-e2e` | **Date**: 2026-02-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-responsive-pwa-e2e/spec.md`

## Summary

Both the chat application and the workbench application must be made fully
responsive across phone/tablet/desktop viewports, installable as PWAs on
mobile, and covered by an automated E2E test suite that validates responsive
behavior at all viewport classes in CI.

The chat app has a basic PWA manifest and icons but no service worker; the
workbench app has no PWA setup at all. Responsive CSS usage is minimal in
chat-frontend and moderate in workbench-frontend. The E2E test suite in
chat-ui already has one responsive test and separate Playwright projects for
chat and workbench, but only tests Desktop Chrome.

The approach is to add `vite-plugin-pwa` to both apps for service worker
generation and install prompt support, extend Tailwind responsive patterns
across core layouts, and add parameterized Playwright viewport tests that run
in CI as a merge gate.

## Technical Context

**Language/Version**: TypeScript 5.6  
**Primary Dependencies**: React 18.3, Vite 5.4, Tailwind CSS 3.4, vite-plugin-pwa (new), Zustand 5.0  
**Storage**: N/A (no new storage; service worker cache only)  
**Testing**: Vitest (unit), Playwright 1.57 (E2E)  
**Target Platform**: Web — mobile (iOS Safari, Android Chrome), tablet, desktop browsers  
**Project Type**: Web — two independent frontend apps + shared E2E suite  
**Performance Goals**: All core flows complete without layout breakage at all viewport classes; PWA install prompt appears within 3 seconds of eligibility  
**Constraints**: No offline-first requirement (service worker for installability only); must not regress desktop experience; must not break existing E2E tests  
**Scale/Scope**: 2 frontend apps, ~15 core routes total, 3 viewport classes, 1 E2E suite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from
      feature/bugfix branches
- [x] Required approvals and required CI checks are identified for each target repo
- [x] Post-merge hygiene is defined: delete merged remote/local feature branches
      and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are
      defined (breakpoints, installability, and mobile-browser coverage)
- [x] Post-deploy smoke checks are defined for critical routes, deep links,
      and API endpoints
- [x] Jira Epic exists for this feature with spec content in description;
      Jira issue key is recorded in spec.md header
- [x] Documentation impact is identified: which Confluence doc types
      (User Manual, Technical Onboarding, Release Notes, Non-Technical
      Onboarding) require updates upon production deployment

### Constitution Check Notes

**Affected repositories** (with per-repo scope):

| Repository | Scope | Key Paths |
|------------|-------|-----------|
| `chat-frontend` | Responsive layouts, PWA setup | `vite.config.ts`, `src/App.tsx`, `src/index.css`, `public/manifest.json` |
| `workbench-frontend` | Responsive layouts, PWA setup | `vite.config.ts`, `src/App.tsx`, `public/manifest.webmanifest` (new) |
| `chat-frontend-common` | Shared breakpoint tokens (if needed) | `tailwind-preset.js` |
| `chat-ui` | E2E responsive/PWA tests | `playwright.config.ts`, `tests/e2e/routing/`, `tests/e2e/pwa/` (new) |
| `chat-ci` | CI workflow for responsive E2E gate | `.github/workflows/test-e2e.yml` |
| `client-spec` | Spec artifacts and evidence | `specs/001-responsive-pwa-e2e/` |

**Test strategy alignment**:
- Unit tests (Vitest) in `chat-frontend` and `workbench-frontend` for responsive hooks/utilities
- E2E tests (Playwright) in `chat-ui` parameterized by viewport class
- CI gate via `chat-ci` reusable workflow

**Documentation impact**:
- User Manual: Update with mobile/tablet screenshots showing responsive layouts
- Technical Onboarding: Document PWA setup, responsive patterns, viewport test authoring
- Release Notes: Include responsive/PWA capability announcement
- Non-Technical Onboarding: Update to mention mobile/installable app access

**Post-deploy smoke checks**:
- Verify chat app loads and core flow completes at phone/tablet/desktop viewports
- Verify workbench app loads and core flow completes at phone/tablet/desktop viewports
- Verify PWA install prompt appears on eligible mobile browsers (Android Chrome)
- Verify manifest and service worker are served correctly on both domains

## Project Structure

### Documentation (this feature)

```text
specs/001-responsive-pwa-e2e/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity definitions (lightweight — UI-only feature)
├── quickstart.md        # Phase 1: Setup and validation guide
├── contracts/           # Phase 1: No new API contracts (UI-only)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (across split repositories)

```text
chat-frontend/
├── public/
│   ├── manifest.json          # Update: add PWA metadata completeness
│   └── icons/                 # Existing: PWA icons
├── src/
│   ├── App.tsx                # Update: responsive shell/navigation
│   ├── index.css              # Update: responsive base styles
│   ├── hooks/
│   │   └── useInstallPrompt.ts    # New: PWA install prompt hook
│   ├── components/
│   │   └── InstallBanner.tsx      # New: PWA install UI
│   └── pwa/
│       └── sw-registration.ts     # New: service worker registration
└── vite.config.ts             # Update: add vite-plugin-pwa

workbench-frontend/
├── public/
│   ├── manifest.webmanifest   # New: PWA manifest
│   └── icons/                 # New: PWA icons
├── src/
│   ├── App.tsx                # Update: responsive shell/navigation
│   ├── hooks/
│   │   └── useInstallPrompt.ts    # New: PWA install prompt hook
│   ├── components/
│   │   └── InstallBanner.tsx      # New: PWA install UI
│   └── pwa/
│       └── sw-registration.ts     # New: service worker registration
└── vite.config.ts             # Update: add vite-plugin-pwa

chat-ui/
├── playwright.config.ts       # Update: add mobile/tablet device projects
└── tests/e2e/
    ├── routing/
    │   └── experience-responsive.spec.ts  # Update: expand viewport coverage
    ├── responsive/                        # New: per-app responsive tests
    │   ├── chat-responsive.spec.ts
    │   └── workbench-responsive.spec.ts
    └── pwa/                               # New: PWA installability tests
        ├── chat-pwa.spec.ts
        └── workbench-pwa.spec.ts

chat-ci/
└── .github/workflows/
    └── test-e2e.yml           # Update: support viewport matrix parameter
```

**Structure Decision**: Micro-frontend architecture with two independent React
apps sharing a common Tailwind preset. E2E tests centralized in `chat-ui` with
separate Playwright projects for each app surface. PWA setup is per-app since
each has its own domain, manifest, and service worker.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
