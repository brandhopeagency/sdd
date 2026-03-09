# Data Model: Split Frontend Into Client and Workbench Applications

**Feature**: 001-split-workbench-app
**Date**: 2026-02-21

This feature is primarily an architectural split — no new database entities are introduced. The data model documents the logical entities that govern the split behavior: which code belongs where, how routing decisions are made, and how session state flows across applications.

## Entity: Application Surface

Represents one of the two frontend applications after the split.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `'chat' \| 'workbench'` | Surface identifier |
| `frontendDomain` | `string` | Environment-specific frontend hostname |
| `apiDomain` | `string` | Environment-specific API hostname |
| `requiredPermission` | `Permission \| null` | Permission required to access this surface (`null` for chat — open to all authenticated/guest users; `WORKBENCH_ACCESS` for workbench) |
| `routes` | `RouteDefinition[]` | Routes owned by this surface |
| `pwaEnabled` | `boolean` | Whether this surface supports PWA installation |

**Validation rules**:
- Each route belongs to exactly one surface
- `frontendDomain` and `apiDomain` are unique per environment
- Workbench surface requires `WORKBENCH_ACCESS` permission

**Relationships**:
- Surface → many Routes (ownership)
- Surface → one Domain Topology entry per environment
- Surface → one GCS Bucket per environment

## Entity: Domain Topology Entry

Maps a surface + environment to concrete hostnames. Source of truth: `chat-infra/config/domain-topology.json`.

| Field | Type | Description |
|-------|------|-------------|
| `surface` | `'chat' \| 'workbench'` | Which application surface |
| `environment` | `'production' \| 'development'` | Target environment |
| `frontendHost` | `string` | Frontend hostname (e.g., `mentalhelp.chat`) |
| `apiHost` | `string` | API hostname (e.g., `api.mentalhelp.chat`) |

**Instances** (from existing `domain-topology.json`):

| Surface | Environment | Frontend | API |
|---------|-------------|----------|-----|
| chat | production | `mentalhelp.chat` | `api.mentalhelp.chat` |
| chat | development | `dev.mentalhelp.chat` | `api.dev.mentalhelp.chat` |
| workbench | production | `workbench.mentalhelp.chat` | `api.workbench.mentalhelp.chat` |
| workbench | development | `workbench.dev.mentalhelp.chat` | `api.workbench.dev.mentalhelp.chat` |

## Entity: Route Mapping Rule

Governs legacy redirect behavior. When a user visits a route that belongs to the other surface, they are redirected.

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `string` | URL path pattern to match (e.g., `/workbench/*`) |
| `sourceSurface` | `Surface` | The surface where this pattern is encountered |
| `targetSurface` | `Surface` | The surface that owns this route |
| `action` | `'redirect'` | Always redirect (301 for SEO, 302 for temporary) |

**Instances**:

| Pattern | Source | Target | Example |
|---------|--------|--------|---------|
| `/workbench/*` | chat | workbench | User visits `mentalhelp.chat/workbench/users` → redirect to `workbench.mentalhelp.chat/workbench/users` |
| `/chat/*` | workbench | chat | User visits `workbench.mentalhelp.chat/chat` → redirect to `mentalhelp.chat/chat` |
| `#/*` | either | same | Hash-based deep link → replace with path-based route on same surface |

## Entity: Session Context (Cross-Surface)

Describes how authentication state flows between the two applications.

| Field | Type | Scope | Description |
|-------|------|-------|-------------|
| `refreshToken` | `string` | Cookie: `Domain=.mentalhelp.chat` | Shared across both surfaces via parent-domain cookie |
| `accessToken` | `string` | `localStorage` (per-origin) | Stored independently by each app; obtained via silent refresh if missing |
| `user` | `AuthenticatedUser` | Memory (per-app) | Hydrated from `/api/auth/me` response |
| `permissions` | `Permission[]` | Memory (per-app) | Derived from user role via `ROLE_PERMISSIONS` |
| `activeGroupId` | `string \| null` | `localStorage` (per-origin) | Selected group context; independent per app |

**State transitions**:

```
[No session] 
  → User signs in on chat → refreshToken cookie set (.mentalhelp.chat) + accessToken in chat localStorage
  → User navigates to workbench → no accessToken in workbench localStorage
  → App calls /api/auth/refresh (cookie sent automatically) → new accessToken stored in workbench localStorage
  → [Authenticated on both surfaces]

[Authenticated on both]
  → User signs out on chat → refreshToken revoked, cookie cleared (.mentalhelp.chat), chat localStorage cleared
  → User interacts on workbench → API returns 401 → workbench clears state, redirects to login
  → [No session on either surface]
```

## Entity: Package Dependency Graph

Documents the dependency relationships between repositories after the split.

```
@mentalhelpglobal/chat-types (v1.3.0)
  ↑ consumed by
  ├── @mentalhelpglobal/chat-frontend-common
  ├── chat-frontend
  ├── workbench-frontend
  └── chat-backend

@mentalhelpglobal/chat-frontend-common (new)
  ↑ consumed by
  ├── chat-frontend
  └── workbench-frontend
```

**Publishing order** (when shared types change):
1. `chat-types` publishes new version
2. `chat-frontend-common` updates dependency, publishes new version
3. `chat-frontend` and `workbench-frontend` update dependencies independently

## Entity: GCS Deployment Bucket

Maps each application surface + environment to a GCS bucket for static hosting.

| Surface | Environment | GCS Bucket | Backend Bucket (LB) |
|---------|-------------|------------|---------------------|
| chat | production | `mental-help-global-25-frontend` | `bes-frontend-prod` |
| chat | development | `mental-help-global-25-dev-frontend` | `bes-frontend-dev` |
| workbench | production | `mental-help-global-25-workbench-frontend` | `bes-frontend-workbench-prod` |
| workbench | development | `mental-help-global-25-dev-workbench-frontend` | `bes-frontend-workbench-dev` |

All buckets are already provisioned with CDN enabled.
