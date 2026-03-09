# Contracts: Responsive PWA With Cross-Device E2E Testing

This feature introduces no new API endpoints or backend contracts.

All changes are client-side (responsive layouts, PWA configuration, E2E tests).
The existing API surface remains unchanged.

## Static Asset Contracts

The following static assets must be served correctly by the hosting
infrastructure (GCS buckets) for PWA installability:

### Chat Application (`dev.mentalhelp.chat`)

| Asset | Path | Content-Type | Cache |
|-------|------|-------------|-------|
| Manifest | `/manifest.json` | `application/manifest+json` | no-cache |
| Service Worker | `/sw.js` | `application/javascript` | no-cache |
| Icon 192 | `/icons/icon-192x192.png` | `image/png` | immutable |
| Icon 512 | `/icons/icon-512x512.png` | `image/png` | immutable |
| Icon Maskable | `/icons/icon-512x512-maskable.png` | `image/png` | immutable |

### Workbench Application (`workbench.dev.mentalhelp.chat`)

| Asset | Path | Content-Type | Cache |
|-------|------|-------------|-------|
| Manifest | `/manifest.webmanifest` | `application/manifest+json` | no-cache |
| Service Worker | `/sw.js` | `application/javascript` | no-cache |
| Icon 192 | `/icons/icon-192x192.png` | `image/png` | immutable |
| Icon 512 | `/icons/icon-512x512.png` | `image/png` | immutable |
| Icon Maskable | `/icons/icon-512x512-maskable.png` | `image/png` | immutable |

## Notes

- `vite-plugin-pwa` generates `sw.js` at build time and injects the manifest
  link into `index.html` automatically.
- GCS already serves `index.html` with `no-cache` and other assets with
  `immutable` — this matches PWA requirements.
- No changes needed to `deploy-chat-frontend.yml` or
  `deploy-workbench-frontend.yml` cache headers; existing gsutil config is
  compatible.
