# Implementation Plan: Google OAuth Login with OTP Control

**Branch**: `015-google-oauth-login` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/015-google-oauth-login/spec.md`

## Summary

Add Google OAuth 2.0 as an alternative login method alongside existing OTP for both the chat and workbench applications. The frontend uses Google Identity Services (GIS) via `@react-oauth/google` to obtain an ID token, which the backend verifies using `google-auth-library` before issuing the same JWT access + refresh tokens used by the OTP flow. Accounts are linked by email match. A workbench admin setting (Owner-only) allows disabling OTP login for the workbench while keeping both methods available for chat.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS backend, Vite + React frontend)  
**Primary Dependencies**:
- Backend: Express.js, `google-auth-library` (new), `jsonwebtoken`, `bcrypt`, `googleapis` (existing)
- Frontend: React 18, `@react-oauth/google` (new), Zustand, React Router v6, i18next
- Shared: `@mentalhelpglobal/chat-types`, `@mentalhelpglobal/chat-frontend-common`

**Storage**: PostgreSQL (Cloud SQL) — add `google_sub` column to `users`, `otp_login_disabled_workbench` column to `settings`  
**Testing**:
- Backend: Vitest (`chat-backend`)
- Frontend: Vitest + React Testing Library (`chat-frontend`, `workbench-frontend`)
- E2E: Playwright (`chat-ui`)

**Target Platform**: Web (Chrome, Firefox, Safari, Edge), PWA (Android Chrome, iOS Safari)  
**Project Type**: Multi-repository web application  
**Performance Goals**: Google OAuth login completes in under 15 seconds end-to-end  
**Constraints**: Must not break existing OTP flow; settings change takes effect within 5 seconds  
**Scale/Scope**: Same user base; no new scaling requirements beyond current capacity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (`spec.md` → `plan.md` → `tasks.md` → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions
- [x] Integration strategy enforces PR-only merges into `develop` from feature/bugfix branches
- [x] Required approvals and required CI checks are identified for each target repo
- [x] Post-merge hygiene is defined: delete merged remote/local feature branches and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are defined (breakpoints, installability, and mobile-browser coverage)
- [x] Post-deploy smoke checks are defined for critical routes, deep links, and API endpoints
- [x] Jira Epic exists for this feature with spec content in description; Jira issue key is recorded in spec.md header
- [x] Documentation impact is identified: which Confluence doc types require updates upon production deployment

### Constitution Compliance Notes

**Principle II (Multi-Repository)**: 7 repositories affected — all explicitly listed below with per-repo file paths.

**Principle III (Test-Aligned)**: Vitest for backend/frontend unit tests, Playwright for E2E in `chat-ui`.

**Principle IV (Branch Discipline)**: Branch `015-google-oauth-login` created in all affected repos from `develop`. PR-only merges.

**Principle V (Privacy/Security)**: Google OAuth tokens verified server-side only. No Google access tokens stored. `google_sub` is not PII (opaque identifier). Authentication audit logging covers both methods.

**Principle VI (Accessibility/i18n)**: Login page updated with i18n keys for all 3 languages (uk, en, ru). Google sign-in button follows Google's accessible guidelines. Keyboard navigation maintained.

**Principle VII (Split-Repo First)**: All work targets split repos. No changes to legacy `chat-client`.

**Principle VIII (GCP CLI)**: Google OAuth client creation documented as `gcloud` commands in quickstart.md. Secret Manager entries scripted.

**Principle IX (Responsive/PWA)**: Login page responsive across mobile/tablet/desktop. Google OAuth popup flow tested in PWA context.

**Principle X (Jira Traceability)**: Epic MTB-376 exists with spec content.

**Principle XI (Documentation)**: User Manual (login flow changes), Technical Onboarding (new env vars, OAuth setup), Release Notes (production only), Non-Technical Onboarding (new login option) — all require updates on production deployment.

## Project Structure

### Documentation (this feature)

```text
specs/015-google-oauth-login/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Setup guide
├── contracts/
│   └── auth-google.yaml # Phase 1: OpenAPI contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-types/                         # Shared TypeScript types
├── src/
│   ├── entities.ts                 # Add googleSub to User, update settings types
│   ├── auth.ts                     # NEW: Google auth request/response types
│   └── index.ts                    # Export new auth types
└── package.json                    # Bump 1.4.0 → 1.5.0

chat-backend/                       # Express.js backend
├── src/
│   ├── routes/
│   │   └── auth.ts                 # Add POST /api/auth/google route
│   ├── services/
│   │   ├── auth.service.ts         # Add authenticateWithGoogle(), update findOrCreateUser()
│   │   ├── google-auth.service.ts  # NEW: Google ID token verification
│   │   └── settings.service.ts     # Add otpLoginDisabledWorkbench field
│   ├── middleware/
│   │   └── auth.ts                 # No changes (same JWT verification)
│   ├── db/
│   │   ├── schema.sql              # Add google_sub column, settings column
│   │   └── migrations/
│   │       └── XXX-google-oauth.sql # NEW: Migration for both columns
│   └── types/
│       └── index.ts                # Update DbUser with google_sub
└── package.json                    # Add google-auth-library, update chat-types

chat-frontend-common/               # Shared frontend package
├── src/
│   ├── auth/
│   │   ├── LoginPage.tsx           # Add GoogleOAuthProvider, layout changes
│   │   ├── OtpLoginForm.tsx        # Conditional OTP form based on settings
│   │   └── GoogleLoginButton.tsx   # NEW: Google sign-in button wrapper
│   ├── stores/
│   │   └── authStore.ts            # Add googleLogin action, load public settings
│   ├── services/
│   │   └── api.ts                  # Add authApi.googleLogin(), surface param
│   └── index.ts                    # Export GoogleLoginButton
└── package.json                    # Add @react-oauth/google

chat-frontend/                      # Chat application
├── src/
│   ├── config.ts                   # Add GOOGLE_OAUTH_CLIENT_ID from env
│   └── locales/
│       ├── en.json                 # Add Google login i18n keys
│       ├── uk.json                 # Add Google login i18n keys
│       └── ru.json                 # Add Google login i18n keys
└── package.json                    # Update chat-frontend-common

workbench-frontend/                 # Workbench application
├── src/
│   ├── config.ts                   # Add GOOGLE_OAUTH_CLIENT_ID from env
│   ├── features/workbench/settings/
│   │   └── SettingsView.tsx        # Add OTP disable toggle in admin section
│   ├── services/
│   │   └── adminApi.ts             # Update AppSettingsDto with new field
│   └── locales/
│       ├── en.json                 # Add Google login + setting i18n keys
│       ├── uk.json                 # Add Google login + setting i18n keys
│       └── ru.json                 # Add Google login + setting i18n keys
└── package.json                    # Update chat-frontend-common

chat-infra/                         # Infrastructure
├── config/
│   ├── secrets.json                # Add google-oauth-client-secret entry
│   └── github-envs/
│       ├── dev.json                # Add GOOGLE_OAUTH_CLIENT_ID variable
│       └── prod.json               # Add GOOGLE_OAUTH_CLIENT_ID variable
└── scripts/
    └── setup-secrets.sh            # Add google-oauth-client-secret setup

chat-ci/                            # CI/CD workflows
└── .github/workflows/
    ├── deploy.yml                  # Add GOOGLE_OAUTH_CLIENT_ID env var
    └── deploy-backend.yml          # Add GOOGLE_OAUTH_CLIENT_ID env var

chat-ui/                            # E2E tests (Playwright)
└── tests/
    ├── google-oauth-login.spec.ts  # NEW: Google OAuth login flow tests
    └── otp-disable-setting.spec.ts # NEW: OTP disable setting tests
```

**Structure Decision**: Multi-repository web application. Changes span 7 active split repositories following Constitution Principle VII. Execution order: `chat-types` → `chat-backend` → `chat-frontend-common` → `chat-frontend` + `workbench-frontend` (parallel) → `chat-infra` + `chat-ci` (parallel) → `chat-ui`.

## Responsive and PWA Checks

| Check | How Verified |
|-------|-------------|
| Login page responsive at 360px (mobile) | Playwright viewport test + manual check |
| Login page responsive at 768px (tablet) | Playwright viewport test |
| Login page responsive at 1024px+ (desktop) | Playwright viewport test |
| Google sign-in button follows branding | Visual inspection (uses official `@react-oauth/google` component) |
| Google OAuth popup works in PWA | Manual test on installed PWA (Android Chrome, iOS Safari) |
| OTP form hidden when disabled (no broken layout) | Playwright test with setting toggled |

## Post-Deploy Smoke Checks

| Route/Endpoint | Method | Expected |
|---------------|--------|----------|
| `/login` (chat) | GET | Login page renders with both Google + OTP options |
| `/login` (workbench) | GET | Login page renders according to OTP disable setting |
| `/api/auth/google` | POST | Returns 400 with invalid token (confirms route exists) |
| `/api/auth/google/config` | GET | Returns client ID or null |
| `/api/auth/otp/send` | POST | Still works for chat surface |
| `/api/admin/settings` | GET | Includes `otpLoginDisabledWorkbench` field |
| `/api/public/settings` | GET | Includes `otpLoginDisabledWorkbench` and `googleOAuthAvailable` |

## Documentation Impact

| Doc Type | Update Needed | Scope |
|----------|--------------|-------|
| User Manual | Yes | Login flow for both chat and workbench — add Google sign-in instructions with screenshots |
| Technical Onboarding | Yes | New env vars (`GOOGLE_OAUTH_CLIENT_ID`), OAuth client setup, new dependencies |
| Release Notes | Yes (production only) | "Google OAuth login now available alongside email OTP" |
| Non-Technical Onboarding | Yes | Updated login flow description, workbench OTP disable setting explanation |

## Complexity Tracking

No constitution violations. All checks pass.
