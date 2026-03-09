# Quickstart: Responsive and PWA Validation

## Scope

Use this guide to validate feature `001-add-responsive-pwa` in development and
release candidate flows before production promotion.

## Prerequisites

- Access to target split repositories: `chat-frontend`, `chat-ui`, `chat-ci`.
- Dev deployment URL from the latest frontend/backend deploy cycle.
- Approved test account with required permissions for core journeys.
- Device/browser coverage:
  - Android Chromium-family browser (required)
  - iOS Safari/PWA-capable path where feasible (required by constitution)
  - Desktop browser baseline

## 1) Responsive validation

1. Open core routes in phone, tablet, and desktop viewport classes.
2. Execute core journeys end-to-end in each viewport.
3. Confirm:
   - no horizontal overflow blocking primary actions,
   - key navigation/actions remain reachable,
   - orientation changes do not corrupt layout or state.
4. Capture evidence of pass/fail outcomes per viewport class.

## 2) Touch interaction validation

1. Run core user actions with touch input only on mobile/tablet.
2. Confirm critical controls are reliably tappable and do not require pointer precision.
3. Record any accidental mis-tap risks or blocked action surfaces.

## 3) PWA installability validation

1. On supported platforms, verify install path availability and successful install.
2. Launch the installed app and confirm expected start experience.
3. On unsupported platforms, verify explicit graceful browser fallback.
4. Record per-platform outcomes and fallback behavior.

## 4) Regression and smoke evidence

1. Collect browser console errors/warnings for affected journeys.
2. Collect non-static network anomalies with endpoint + HTTP status.
3. Run post-deploy smoke checks for:
   - critical routes,
   - deep links,
   - key API endpoints.
4. Save evidence under the release/task evidence path per repository policy.

## 5) Integration and release flow

1. Implement on feature branches in affected split repos from `develop`.
2. Open PRs into `develop` with responsive/PWA evidence attached.
3. Merge only after required approvals and required checks pass.
4. Delete merged remote/local feature branches and sync local `develop`.
5. Follow release promotion flow (`release/*` to `main`) with smoke evidence.
