# Contract: Vite Environment Variable Check Plugin

**Feature**: 008-e2e-test-standards  
**Date**: 2026-02-10

## Overview

A Vite plugin that validates `VITE_API_URL` is set and not a localhost value when building for non-development modes.

## Interface

```typescript
// src/vite-plugins/env-check.ts (or inline in vite.config.ts)
export function envCheck(): Plugin
```

## Behavior

### Hook: `configResolved`

Runs after Vite resolves the full config, including mode.

**Logic**:

```
IF mode !== 'development' AND command === 'build':
  IF VITE_API_URL is undefined or empty:
    THROW "VITE_API_URL is required for non-development builds"
  IF VITE_API_URL contains 'localhost' or '127.0.0.1':
    THROW "VITE_API_URL must not point to localhost for non-development builds"
```

**Does NOT throw** when:
- `mode === 'development'` (local `npm run dev`)
- `command === 'serve'` (dev server, not build)
- `VITE_API_URL` is set to a valid non-localhost URL

### Error message format

```
[vite-plugin-env-check] ERROR: VITE_API_URL is required for non-development builds.

  Current value: (not set)
  Expected: A fully-qualified URL (e.g., https://chat-backend-dev-xxx.run.app)

  To fix:
    export VITE_API_URL="https://your-backend-url"
    npm run build

  For local development, use 'npm run dev' instead (localhost fallback is OK).
```

## Integration

```typescript
// vite.config.ts
import { envCheck } from './src/vite-plugins/env-check'

export default defineConfig({
  plugins: [react(), envCheck()],
  // ...
})
```
