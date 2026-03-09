# Quickstart: Responsive PWA With Cross-Device E2E Testing

**Feature**: `001-responsive-pwa-e2e`  
**Date**: 2026-02-22

## Prerequisites

- Node.js 20+ with npm
- Access to `MentalHelpGlobal` GitHub org (npm registry for `@mentalhelpglobal/*` packages)
- Local clones of: `chat-frontend`, `workbench-frontend`, `chat-ui`, `chat-ci`
- Playwright browsers installed (`npx playwright install chromium webkit`)

## Local Development Setup

### 1. Chat Frontend (responsive + PWA)

```bash
cd D:\src\MHG\chat-frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

**PWA testing in dev**: `vite-plugin-pwa` has `devOptions.enabled: false` by
default. To test PWA locally, run a production build:

```bash
npm run build
npm run preview
# Opens at http://localhost:4173 — SW active, manifest served
```

### 2. Workbench Frontend (responsive + PWA)

```bash
cd D:\src\MHG\workbench-frontend
npm install
npm run dev
# Opens at http://localhost:5174
```

Same PWA local testing approach applies.

### 3. E2E Tests (responsive viewport matrix)

```bash
cd D:\src\MHG\chat-ui
npm install
npx playwright install chromium

# Run all tests (all viewport projects)
npx playwright test

# Run only responsive tests
npx playwright test tests/e2e/responsive/

# Run only PWA tests
npx playwright test tests/e2e/pwa/

# Run against deployed dev
CHAT_BASE_URL=https://dev.mentalhelp.chat \
WORKBENCH_BASE_URL=https://workbench.dev.mentalhelp.chat \
npx playwright test
```

## Viewport Validation Matrix

| Viewport Class | Device | Resolution | Chat App | Workbench App |
|----------------|--------|------------|----------|---------------|
| Phone | iPhone 14 | 390×844 | Core chat flow | Review queue, user list |
| Tablet | iPad Mini | 768×1024 | Chat + settings | Review + groups |
| Desktop | Chrome | 1280×720 | Full experience | Full experience |

### Manual Validation Checklist

For each app at each viewport class, verify:

- [ ] Page loads without horizontal scrollbar
- [ ] Primary navigation is accessible (may be collapsed on phone)
- [ ] Primary action buttons are visible and tappable
- [ ] Forms submit successfully
- [ ] Text is readable without zooming
- [ ] Orientation change preserves state and layout
- [ ] No overlapping or clipped elements

### PWA Validation Checklist

For each app on a supported mobile browser (Android Chrome):

- [ ] Manifest loads at expected path (`/manifest.json` or `/manifest.webmanifest`)
- [ ] Service worker registers successfully (check DevTools → Application → Service Workers)
- [ ] Install prompt appears (or "Add to Home Screen" is available in browser menu)
- [ ] App installs and adds icon to home screen
- [ ] App launches in standalone mode (no browser chrome)
- [ ] App navigates to correct start URL

### iOS Safari PWA Checklist

- [ ] "Add to Home Screen" option is available in Share menu
- [ ] App icon appears on home screen after adding
- [ ] App launches in standalone mode
- [ ] If install banner is shown, it displays iOS-specific instructions

## Smoke Checks (Post-Deploy)

After deploying to dev environment, verify:

### Chat App (`dev.mentalhelp.chat`)

- [ ] `/chat` loads and shows login/chat interface
- [ ] `/manifest.json` returns valid JSON with correct `start_url`
- [ ] `/sw.js` returns valid JavaScript
- [ ] Chrome DevTools → Application → Manifest shows no errors
- [ ] Chrome DevTools → Application → Service Workers shows "activated"
- [ ] Lighthouse PWA audit passes (minimum: installable)

### Workbench App (`workbench.dev.mentalhelp.chat`)

- [ ] `/workbench` loads and shows login/workbench interface
- [ ] `/manifest.webmanifest` returns valid JSON with correct `start_url`
- [ ] `/sw.js` returns valid JavaScript
- [ ] Chrome DevTools → Application → Manifest shows no errors
- [ ] Chrome DevTools → Application → Service Workers shows "activated"
- [ ] Lighthouse PWA audit passes (minimum: installable)

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| No install prompt | SW not registered or manifest invalid | Check DevTools → Application tab |
| Stale cache after deploy | SW serving old assets | Clear site data or wait for auto-update |
| Layout broken on rotate | Missing orientation-safe CSS | Check for fixed-width elements |
| E2E test flaky on resize | Layout reflow timing | Add `waitForLoadState('networkidle')` after viewport change |
| Manifest 404 | Build config issue | Verify `vite-plugin-pwa` manifest config |
