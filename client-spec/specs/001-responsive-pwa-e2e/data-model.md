# Data Model: Responsive PWA With Cross-Device E2E Testing

**Feature**: `001-responsive-pwa-e2e`  
**Date**: 2026-02-22

This feature is primarily a UI/UX and testing concern. There are no new
database entities, API models, or persistent data structures. The entities
below describe client-side configuration and runtime state used by the
responsive and PWA implementation.

## Entities

### ViewportClass

Defines the named screen-size categories used for layout adaptation and E2E
test parameterization.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `'phone' \| 'tablet' \| 'desktop'` | Human-readable viewport category |
| `minWidth` | `number \| null` | Minimum width in px (null for phone = default) |
| `maxWidth` | `number \| null` | Maximum width in px (null for desktop = unbounded) |
| `tailwindPrefix` | `string` | Tailwind breakpoint prefix used for this class |
| `playwrightDevice` | `string` | Playwright device name for E2E emulation |

**Instances**:

| name | minWidth | maxWidth | tailwindPrefix | playwrightDevice |
|------|----------|----------|----------------|------------------|
| phone | null | 639 | (default) | iPhone 14 |
| tablet | 640 | 1023 | `md:` | iPad Mini |
| desktop | 1024 | null | `lg:` | Desktop Chrome |

### PWAManifest

Per-application web app manifest configuration. Not a runtime entity — defined
statically in build config.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Full application name |
| `short_name` | `string` | Short name for home screen |
| `start_url` | `string` | URL opened on PWA launch |
| `display` | `'standalone'` | Display mode |
| `theme_color` | `string` | Browser chrome color |
| `background_color` | `string` | Splash screen background |
| `icons` | `Icon[]` | Array of icon definitions |

### InstallPromptState

Client-side runtime state for the PWA install prompt UX.

| Field | Type | Description |
|-------|------|-------------|
| `canInstall` | `boolean` | Whether install prompt is available |
| `deferredPrompt` | `BeforeInstallPromptEvent \| null` | Captured browser event |
| `isDismissed` | `boolean` | User has dismissed the banner |
| `dismissedUntil` | `number \| null` | Unix timestamp after which banner can reappear |

**State transitions**:

```
[Initial] ──beforeinstallprompt──► [CanInstall]
[CanInstall] ──user dismisses──► [Dismissed (30 days)]
[CanInstall] ──user installs──► [Installed]
[Dismissed] ──30 days elapsed──► [CanInstall]
```

## Relationships

- Each **Application Target** (chat, workbench) has exactly one **PWAManifest**.
- Each **Application Target** has one **InstallPromptState** at runtime.
- **ViewportClass** instances are shared across both apps and E2E tests.
- E2E tests reference **ViewportClass** to select Playwright device projects.
