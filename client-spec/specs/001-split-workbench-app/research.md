# Research: Split Frontend Into Client and Workbench Applications

**Feature**: 001-split-workbench-app
**Date**: 2026-02-21

## R1 — Shared Package Format

**Decision**: Publish `@mentalhelpglobal/chat-frontend-common` as pre-compiled ESM with TypeScript declaration files (`.d.ts`). Use Vite library mode for the build.

**Rationale**: Raw TypeScript source causes CJS/ESM interop issues in Vite consumers and breaks HMR through symlinks. Pre-compiled ESM with declarations works reliably in both development and production. This mirrors the pattern used by `@mentalhelpglobal/chat-types`.

**Alternatives considered**:
- **Raw TypeScript source**: Simpler build step but Vite does not reliably handle symlinked TS packages for HMR. Causes duplicate React instances when using `npm link`.
- **CJS-only**: Would work but Vite prefers ESM for tree-shaking. ESM-first with CJS fallback adds complexity without clear benefit given both consumers are Vite apps.

**Configuration**:

```json
{
  "name": "@mentalhelpglobal/chat-frontend-common",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./tailwind-preset": "./tailwind-preset.js"
  }
}
```

---

## R2 — Tailwind Design Token Sharing

**Decision**: Use a Tailwind preset exported from `chat-frontend-common`. Both apps extend it via `presets: [require('@mentalhelpglobal/chat-frontend-common/tailwind-preset')]` in their `tailwind.config.js`.

**Rationale**: Tailwind v3 presets are the standard mechanism for sharing theme tokens (colors, fonts, spacing, breakpoints). Keeps a single source of truth for design consistency without requiring runtime CSS variable overhead.

**Alternatives considered**:
- **Tailwind plugin**: Plugins are designed for adding utilities, not for sharing theme values. A preset is semantically correct.
- **CSS custom properties**: More flexible at runtime but adds complexity and doesn't integrate with Tailwind's purge/JIT. Better suited for Tailwind v4 migration.
- **Duplicate `tailwind.config.js`**: Simplest but creates drift risk.

---

## R3 — Zustand Auth Store Sharing

**Decision**: Export the `authStore` (with persist middleware) from `chat-frontend-common`. Each application imports and uses the same store definition.

**Rationale**: The auth store manages authentication state (tokens, user info, permissions) that is identical in both applications. Exporting it from a shared package eliminates duplication and ensures consistent behavior.

**Important caveat**: `localStorage` is origin-scoped. The `authStore` persisted state on `mentalhelp.chat` is NOT visible from `workbench.mentalhelp.chat`. Each app will have its own persisted copy. This is acceptable because the refresh token cookie (scoped to `.mentalhelp.chat`) enables silent re-authentication on the second domain (see R6).

**Alternatives considered**:
- **Duplicate store in each app**: More maintenance overhead, risk of behavioral drift.
- **Shared state via iframe/postMessage bridge**: Over-engineered; silent refresh is simpler.

---

## R4 — i18n Translation Sharing

**Decision**: Use i18next namespaces. The shared package exports a `common` namespace with translations used by both apps (auth screens, shared components, error pages). Each app adds its own namespace (`chat` or `workbench`) for surface-specific translations.

**Rationale**: Namespaces cleanly separate shared vs app-specific translations. Each app initializes its own i18next instance and loads both the `common` namespace (from the shared package) and its own surface namespace.

**Alternatives considered**:
- **Copy translation files**: Duplication, drift risk.
- **Single merged translation file**: Bloats each app with unused keys from the other surface.
- **Shared i18n instance**: Not applicable across separate applications.

---

## R5 — Local Development Experience

**Decision**: Use Vite `resolve.alias` to point at the shared package's source directory during development. For CI and production, consume the published npm package normally.

**Rationale**: Vite's `resolve.alias` pulls the shared package source into the consumer's module graph, enabling full HMR without rebuilds. This is the standard approach for multi-repo Vite development.

**Configuration** (in consumer `vite.config.ts` for local dev):

```typescript
resolve: {
  alias: process.env.LOCAL_COMMON
    ? { '@mentalhelpglobal/chat-frontend-common': path.resolve('../chat-frontend-common/src') }
    : {}
}
```

**Alternatives considered**:
- **npm link**: Causes duplicate dependency issues (React, Zustand). Vite does not watch symlinked packages for HMR.
- **npm workspaces / monorepo**: Would require restructuring all repos into a monorepo, which conflicts with the split-repository architecture (Constitution Principle VII).
- **file: dependency**: Works but requires manual `npm install` after changes. No HMR.

---

## R6 — Cross-Domain Authentication (Cookie Strategy)

**Decision**: Set the refresh token cookie with `Domain=.mentalhelp.chat` and `SameSite=Lax`. When a user navigates to the second application without a local access token, perform a silent refresh using the shared cookie.

**Rationale**: Cookies with `Domain=.mentalhelp.chat` are sent to all hosts under `mentalhelp.chat`, including `api.mentalhelp.chat`, `api.workbench.mentalhelp.chat`, and their dev variants. This means:
1. User signs in on `mentalhelp.chat` → refresh token cookie set for `.mentalhelp.chat`
2. User navigates to `workbench.mentalhelp.chat` → no access token in localStorage (different origin)
3. App calls `/api/auth/refresh` with `credentials: 'include'` → cookie is sent → new access token returned
4. App stores new access token in its own localStorage → user is authenticated seamlessly

This satisfies FR-004 (no re-authentication) with one transparent API call.

**SameSite=Lax justification**: All hosts share the registrable domain `mentalhelp.chat`, so all requests are same-site. `Lax` provides CSRF protection while allowing the cookie on same-site navigations. `None` is unnecessary.

**Alternatives considered**:
- **Move access token to cookie**: More complex cookie management, larger cookie payloads, harder to manage token lifecycle.
- **postMessage iframe bridge**: Complex to implement, fragile across browser security policies, limited benefit over silent refresh.
- **Shared localStorage via common subdomain proxy**: Over-engineered and blocked by modern browser partitioning.

---

## R7 — Sign-Out Propagation

**Decision**: Server-side refresh token revocation + cookie clearing with `Domain=.mentalhelp.chat; Max-Age=0`. The second app detects sign-out when any API call returns 401, at which point it clears local state and redirects to login.

**Rationale**: Clearing the cookie with `Domain=.mentalhelp.chat` removes it for all subdomains in one operation. The server revokes the refresh token so it cannot be reused. The second app discovers the sign-out on its next API call (immediate for active tabs) or on next navigation.

**Optional enhancement**: Periodic auth check (every 30-60 seconds) to detect sign-out sooner in idle tabs. This can be added later if user feedback indicates the 401-on-next-call approach is insufficient.

**Same-origin tabs**: Use `BroadcastChannel` for instant sign-out propagation between multiple tabs of the same application (e.g., two chat tabs). Note: `BroadcastChannel` is same-origin only and cannot propagate across `mentalhelp.chat` ↔ `workbench.mentalhelp.chat`.

**Alternatives considered**:
- **BroadcastChannel cross-domain**: Not possible — same-origin restriction.
- **WebSocket push notification**: Requires always-on WebSocket connection, over-engineered for this use case.
- **Polling with dedicated endpoint**: More reliable than 401-on-next-call for idle tabs but adds server load. Acceptable as a later enhancement.

---

## R8 — Repository Naming and Creation

**Decision**: New repositories follow existing naming conventions:
- `workbench-frontend` — the new workbench application (mirrors `chat-frontend`)
- `chat-frontend-common` — the shared UI package (mirrors `chat-types` naming pattern)

**Rationale**: Consistent with the MentalHelpGlobal GitHub organization's naming conventions. The `chat-` prefix groups related repositories.

**Alternatives considered**:
- `mhg-workbench-frontend`: Shorter prefix but inconsistent with existing repos.
- `chat-workbench`: Ambiguous — could be confused with a workbench for the chat feature.
- `chat-shared-ui`: Less descriptive than `chat-frontend-common`.

---

## R9 — Code Migration Strategy

**Decision**: Create the new repositories from scratch rather than forking or cloning `chat-frontend`. Copy relevant files, preserving git history is not a priority for the split.

**Rationale**: The workbench code is a subset of `chat-frontend`. Creating fresh repositories avoids carrying unnecessary git history, outdated configuration, and chat-specific files into the workbench repo. The shared package is entirely new code extracted from existing files.

**Migration order**:
1. Extract shared code → `chat-frontend-common` (publish first so consumers can depend on it)
2. Create `workbench-frontend` with workbench-specific code + dependency on common package
3. Remove workbench code from `chat-frontend` + add dependency on common package

This order ensures each step produces a working, testable application.

**Alternatives considered**:
- **Fork `chat-frontend`**: Carries all git history and chat-specific code, requiring extensive deletion.
- **Git subtree split**: Preserves history for specific paths but complex and fragile for this use case.
- **Parallel development (keep both in chat-frontend temporarily)**: Delays the split benefit and adds conditional complexity.
