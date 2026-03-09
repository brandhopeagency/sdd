# Research: Responsive PWA With Cross-Device E2E Testing

**Feature**: `001-responsive-pwa-e2e`  
**Date**: 2026-02-22  
**Status**: Complete

## Research Questions

### R1: PWA Service Worker Strategy

**Decision**: Use `vite-plugin-pwa` with `generateSW` (Workbox) mode for both
apps.

**Rationale**: Both apps use Vite 5.4. `vite-plugin-pwa` integrates directly
with the Vite build pipeline, auto-generates the service worker from Workbox
configuration, handles manifest injection, and provides a virtual module for
install prompt handling. This eliminates manual service worker authoring and
ensures the SW stays synchronized with the build output.

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Manual service worker (`sw.js`) | Requires manual cache management, prone to stale-cache bugs, no build integration |
| `injectManifest` mode | Overkill — no custom SW logic needed (no offline-first, no background sync); `generateSW` is sufficient for installability |
| Workbox CLI standalone | Extra build step outside Vite; `vite-plugin-pwa` wraps Workbox natively |

**Configuration approach**:
- `registerType: 'autoUpdate'` — SW updates silently on new deploy
- `workbox.globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` — cache
  static assets for fast repeat loads
- `manifest` section in plugin config replaces static manifest.json
- `devOptions.enabled: false` — no SW in dev (avoids caching during development)

### R2: PWA Manifest Per-App Configuration

**Decision**: Each app gets its own manifest with distinct identity.

**Rationale**: The apps are deployed on separate domains
(`dev.mentalhelp.chat` / `workbench.dev.mentalhelp.chat`). PWA manifests are
scoped to origin, so each needs its own name, start URL, and icons.

**Chat app manifest** (update existing `manifest.json`):
- `name`: "Mental Help Chat"
- `short_name`: "MHG Chat"
- `start_url`: "/chat"
- `display`: "standalone"
- `theme_color`: "#7c8db0"
- `background_color`: "#ffffff"
- Icons: existing set (192, 512, maskable)

**Workbench app manifest** (new `manifest.webmanifest`):
- `name`: "Mental Help Workbench"
- `short_name`: "MHG Workbench"
- `start_url`: "/workbench"
- `display`: "standalone"
- `theme_color`: "#7c8db0"
- `background_color`: "#ffffff"
- Icons: new set matching workbench branding (can reuse chat icons initially)

### R3: Responsive Breakpoint Strategy

**Decision**: Use Tailwind's default breakpoints with a mobile-first approach.

**Rationale**: Both apps already use Tailwind CSS 3.4 with a shared preset
from `@mentalhelpglobal/chat-frontend-common`. Tailwind's default breakpoints
align with the spec's viewport classes:

| Spec Viewport Class | Tailwind Breakpoint | Width |
|---------------------|---------------------|-------|
| Phone (≤480px) | Default (no prefix) | <640px |
| Tablet (481–1024px) | `sm:` (640px), `md:` (768px) | 640–1024px |
| Desktop (≥1025px) | `lg:` (1024px), `xl:` (1280px) | ≥1024px |

**Approach**:
- Mobile-first: base styles target phone, then layer tablet (`md:`) and
  desktop (`lg:`) overrides
- No custom breakpoint definitions needed — Tailwind defaults are sufficient
- The shared preset in `chat-frontend-common` already includes these defaults
- Key responsive patterns: collapsible sidebar navigation, stacked→grid
  layout transitions, touch-friendly spacing at mobile sizes

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Custom breakpoints matching spec exactly (480/1024) | Non-standard; Tailwind defaults are close enough and well-documented |
| CSS Container Queries | Browser support is sufficient but adds complexity; standard media queries via Tailwind are simpler and team-familiar |
| Separate mobile stylesheets | Defeats the purpose of utility-first CSS; Tailwind responsive prefixes handle this natively |

### R4: E2E Viewport Testing Strategy

**Decision**: Add Playwright device projects for mobile and tablet alongside
existing Desktop Chrome, parameterized per viewport class.

**Rationale**: Playwright supports device emulation natively. Adding device
projects to `playwright.config.ts` means all tests automatically run at
multiple viewport sizes without per-test viewport overrides. The existing
responsive test (`experience-responsive.spec.ts`) manually sets viewports;
new tests should use project-level device emulation for consistency.

**Device matrix**:

| Viewport Class | Playwright Device | Resolution |
|----------------|-------------------|------------|
| Phone | `iPhone 14` | 390×844 |
| Tablet | `iPad Mini` | 768×1024 |
| Desktop | `Desktop Chrome` (existing) | 1280×720 |

**Test organization**:
- New directory `tests/e2e/responsive/` for dedicated responsive tests
- New directory `tests/e2e/pwa/` for PWA installability tests
- Responsive tests validate layout integrity and navigation usability per
  viewport
- Each responsive test file covers one app surface (chat or workbench)
- PWA tests verify manifest loading, SW registration, and install prompt
  behavior

**CI integration**:
- The `test-e2e.yml` reusable workflow runs all Playwright projects
- No workflow changes needed if Playwright config adds new projects — they
  run automatically
- If viewport matrix adds too much runtime, add a `viewport-classes` input
  to allow selective runs

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Per-test `test.use({ viewport })` | Inconsistent; easy to forget; doesn't scale across test files |
| Visual regression (Percy/Chromatic) | High cost; snapshot-based; doesn't validate functional usability |
| Real device testing (BrowserStack) | Adds external dependency and cost; Playwright emulation is sufficient for layout validation |

### R5: Install Prompt UX Pattern

**Decision**: Use the `beforeinstallprompt` event with a dismissible banner
component.

**Rationale**: The `beforeinstallprompt` event is the standard browser API
for prompting PWA installation. `vite-plugin-pwa` provides a virtual module
(`virtual:pwa-register`) that handles SW registration and update lifecycle.
The install prompt logic is separate and needs a custom hook.

**Pattern**:
1. `useInstallPrompt` hook captures the `beforeinstallprompt` event
2. Stores the deferred prompt in state
3. Exposes `canInstall` boolean and `promptInstall()` function
4. `InstallBanner` component renders a dismissible banner when
   `canInstall === true`
5. Banner is suppressed for 30 days after dismissal (localStorage flag)
6. On iOS Safari (no `beforeinstallprompt`), show a hint for manual
   Add to Home Screen

### R6: Existing Responsive Test Assessment

**Decision**: Preserve and extend `experience-responsive.spec.ts`; add
dedicated per-app responsive test suites.

**Rationale**: The existing test at
`tests/e2e/routing/experience-responsive.spec.ts` already validates basic
viewport behavior at 375×812, 768×1024, and 1440×900. It should remain as a
routing-focused responsive check. New dedicated responsive test files will
cover core user flows per app surface with deeper assertions (navigation
usability, form completion, action reachability).

## Summary of Decisions

| # | Topic | Decision |
|---|-------|----------|
| R1 | SW strategy | `vite-plugin-pwa` with `generateSW` mode |
| R2 | Manifests | Per-app manifest with distinct identity |
| R3 | Breakpoints | Tailwind defaults, mobile-first approach |
| R4 | E2E viewports | Playwright device projects (iPhone 14, iPad Mini, Desktop Chrome) |
| R5 | Install UX | `beforeinstallprompt` event + dismissible banner |
| R6 | Existing tests | Preserve and extend; add dedicated per-app suites |
