# Research: Google OAuth Login with OTP Control

**Feature Branch**: `015-google-oauth-login`  
**Created**: 2026-02-23

## R1. Google OAuth 2.0 Server-Side Flow for Node.js/Express

### Decision

Use the **Authorization Code flow** (server-side) via the `google-auth-library` npm package. The backend handles the token exchange, never exposing the client secret to the browser. The frontend initiates the flow using Google's `Sign In With Google` button (GSI library) which returns an authorization code to the backend.

### Rationale

- The Authorization Code flow is the recommended approach for server-rendered or SPA+API architectures where the backend issues its own session tokens.
- The `google-auth-library` package is Google's official Node.js library, actively maintained and well-documented.
- The existing `googleapis` package (already in `chat-backend` for Gmail) depends on `google-auth-library`, so the core dependency is already present.
- The backend verifies the Google ID token, extracts the user's email, and issues its own JWT access + refresh tokens — exactly the same tokens issued after OTP verification.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Passport.js + passport-google-oauth20 | Adds a middleware framework for a single provider. Overhead not justified when only Google is needed and the auth flow is straightforward. |
| Frontend-only flow (implicit grant) | Exposes token handling to the browser. Cannot securely issue server-side refresh tokens from the frontend. |
| OpenID Connect via third-party library | Over-engineered for a single Google provider. The GSI library + server verification covers the use case. |

---

## R2. Frontend Google Sign-In Integration

### Decision

Use the **Google Identity Services (GIS) JavaScript library** (`accounts.google.com/gsi/client`) with the **One Tap / Sign In With Google button** rendered via the `@react-oauth/google` React wrapper package.

### Rationale

- GIS is Google's current recommended client-side library (the older `gapi.auth2` is deprecated).
- `@react-oauth/google` provides React components (`GoogleLogin`, `GoogleOAuthProvider`) that handle script loading, button rendering, and credential callback.
- The library returns an ID token (credential) directly via the callback, which the backend can verify server-side using `google-auth-library`.
- Follows Google's branding guidelines automatically when using the `GoogleLogin` component.
- Supports popup mode, which works well inside PWA windows.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Raw GSI script tag + manual rendering | More code to maintain; React wrapper handles lifecycle and SSR edge cases. |
| Redirect-based flow (full page redirect to Google) | Disrupts user context; popup flow preserves the login page state. |
| Custom-styled Google button | Violates Google's branding requirements; official component ensures compliance. |

---

## R3. Backend Google ID Token Verification

### Decision

After the frontend obtains the Google ID token (credential), it sends it to a new backend endpoint `POST /api/auth/google`. The backend uses `google-auth-library`'s `OAuth2Client.verifyIdToken()` to verify the token, extract the email and Google user ID (`sub`), and then follows the same `findOrCreateUser` path used by OTP verification.

### Rationale

- `verifyIdToken()` performs cryptographic verification of the Google-signed JWT, checks audience (client ID), issuer, and expiry.
- This approach reuses the existing user creation/lookup logic (`findOrCreateUser` in `auth.service.ts`).
- After verification, the backend issues its own JWT access token + refresh token — identical to the OTP flow. Downstream middleware sees no difference.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Using the authorization code exchange flow | More complex (requires redirect URI handling). ID token verification is simpler and sufficient since we only need the user's email and identity, not access to Google APIs. |
| Trusting the frontend-provided email without verification | Security vulnerability; the backend must independently verify the Google token. |

---

## R4. Account Linking Strategy

### Decision

Link accounts by **email address match**. When a Google-authenticated email matches an existing user record, the system links the Google identity (`google_sub` field) to that user. No separate linking UI is needed.

### Rationale

- The system already identifies users by email (unique constraint on `users.email`).
- Users registering via OTP already provided a verified email. Google OAuth also provides a verified email.
- Storing the `google_sub` (Google's unique user identifier) allows future validation that the same Google account is being used, even if the user changes their display name.
- This is the simplest approach that satisfies the spec requirements.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Separate OAuth identities table (many-to-many) | Over-engineered for a single provider. A column on the users table is sufficient. |
| Require explicit user confirmation for linking | Adds friction; email match is deterministic and both sources provide verified emails. |

---

## R5. Workbench OTP Disable Setting Storage

### Decision

Add an `otp_login_disabled_workbench` boolean column to the existing `settings` singleton table (id=1). Serve it via the existing `GET /api/admin/settings` and update via `PATCH /api/admin/settings`. Also expose it as a public setting (no auth required) so the login page can check whether to show the OTP form before the user is authenticated.

### Rationale

- The settings singleton table pattern is already established (`guest_mode_enabled`, `approval_cooloff_days`).
- The settings service has an in-memory cache (30s TTL) which provides fast reads.
- The login page needs to know whether OTP is disabled _before_ the user authenticates, so the setting must be available via the public settings endpoint (`getPublicSettings()`).
- The backend must also enforce this at the API level — if OTP is disabled for workbench, the `POST /api/auth/otp/send` endpoint should reject requests originating from the workbench surface.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Separate auth_config table | Unnecessary complexity; the existing settings table handles this pattern. |
| Environment variable only | Cannot be changed at runtime by Owners; requires redeployment. |
| Frontend-only toggle (hide UI but don't enforce) | Security gap; users could still call the OTP API directly. Must be enforced server-side. |

---

## R6. Google OAuth Client Credentials Management

### Decision

Create a separate Google OAuth 2.0 client (Web application type) in the GCP project for user authentication. Store `GOOGLE_OAUTH_CLIENT_ID` as a GitHub environment variable (non-secret, needed by frontend). Store `GOOGLE_OAUTH_CLIENT_SECRET` as a Google Secret Manager secret synced to GitHub environment secrets (needed by backend for token verification).

### Rationale

- Separate from the existing Gmail API OAuth client to maintain clean separation of concerns.
- The client ID is not a secret (it's embedded in frontend HTML) — standard practice for OAuth 2.0.
- The client secret is only needed by the backend for verifying ID tokens via the `google-auth-library`.
- Follows the existing infrastructure pattern in `chat-infra` for secret management.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Reuse the Gmail OAuth client | Different scopes and purpose; mixing auth and email risks unintended scope escalation. |
| Store client ID in Secret Manager | Unnecessary; client ID is public by design and needed by the frontend at build time. |

---

## R7. Affected Repositories and Execution Order

### Decision

Implementation spans **7 repositories** with the following execution order:

1. **chat-types** (v1.4.0 → v1.5.0): Add `google_sub` to User type, add settings type updates, add Google auth request/response types
2. **chat-backend**: Add Google OAuth route, update auth service, add migration for `google_sub` column and settings column, update settings service
3. **chat-frontend-common**: Update LoginPage and OtpLoginForm to show Google sign-in, update authStore with Google auth action, update API service
4. **chat-frontend**: Add Google OAuth client ID env var, update i18n translations
5. **workbench-frontend**: Add settings toggle for OTP disable, add Google OAuth client ID env var, update i18n translations
6. **chat-infra**: Add Google OAuth client credentials to Secret Manager config, update GitHub environment configs
7. **chat-ci**: Add `GOOGLE_OAUTH_CLIENT_ID` environment variable to deploy workflows
8. **chat-ui**: E2E tests for Google OAuth flow and OTP disable setting

### Rationale

- Types first (Principle VII: shared type changes go through `chat-types` first).
- Backend before frontend (API must exist before UI consumes it).
- Common package before consumers (chat-frontend-common before chat-frontend/workbench-frontend).
- Infrastructure and CI can be done in parallel with backend/frontend work.

---

## R8. Service Surface Awareness for OTP Disable

### Decision

The backend already has a `SERVICE_SURFACE` environment variable (`chat`/`workbench`/all). However, the OTP disable enforcement cannot rely on this alone because both surfaces share the same backend deployment. Instead, the frontend will send a `surface` parameter in the OTP send request, and the backend will check the setting for that surface.

### Rationale

- A single backend serves both chat and workbench. The `SERVICE_SURFACE` env var is for route filtering, not for per-request surface awareness.
- The OTP disable setting is workbench-only, so the backend needs to know which surface the login request is coming from.
- The `Referer` or `Origin` header could be used, but an explicit parameter is more reliable and testable.
- The backend validates the surface parameter against known values and checks the setting accordingly.

### Alternatives Considered

| Alternative | Why Rejected |
|------------|-------------|
| Check `Origin`/`Referer` header | Unreliable in some proxy/PWA configurations; can be spoofed. |
| Separate backend deployments per surface | Over-engineered; the shared backend is the established pattern. |
| Client-side only enforcement | Security gap; must be enforced server-side. |
