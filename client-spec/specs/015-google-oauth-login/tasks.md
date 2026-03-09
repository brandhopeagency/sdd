# Tasks: Google OAuth Login with OTP Control

**Input**: Design documents from `/specs/015-google-oauth-login/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/auth-google.yaml  
**Jira Epic**: [MTB-376](https://mentalhelpglobal.atlassian.net/browse/MTB-376)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature branches, install dependencies, provision credentials

- [x] T001 Create feature branch `015-google-oauth-login` from `develop` in all affected repos: `chat-types`, `chat-backend`, `chat-frontend-common`, `chat-frontend`, `workbench-frontend`, `chat-infra`, `chat-ci`, `chat-ui` — MTB-381
- [x] T002 Create Google OAuth 2.0 Web Application client in GCP project `mental-help-global-25` with authorized JavaScript origins for dev (`https://dev.mentalhelp.chat`, `https://workbench.dev.mentalhelp.chat`, `http://localhost:5173`, `http://localhost:5174`) per `quickstart.md` — MTB-381
- [x] T003 Store Google OAuth client secret in Google Secret Manager as `google-oauth-client-secret` and grant Cloud Run service account access per `quickstart.md` — MTB-381

---

## Phase 2: Foundational (Types, Migration, Dependencies)

**Purpose**: Shared types and database schema changes that MUST be complete before any user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `googleSub` optional field to `User` interface in `chat-types/src/entities.ts` — MTB-382
- [x] T005 [P] Create new file `chat-types/src/auth.ts` with `GoogleAuthRequest`, `GoogleAuthResponse`, `OtpSendRequest`, and `PublicSettings` interfaces per `data-model.md` — MTB-382
- [x] T006 [P] Add `otpLoginDisabledWorkbench` field to `AppSettings` interface in `chat-types/src/entities.ts` (or `settings.ts` if separate) — MTB-382
- [x] T007 Export new types from `chat-types/src/index.ts` (auth.ts exports, updated entities) — MTB-382
- [x] T008 Bump `chat-types` version from 1.4.0 to 1.5.0, build, and publish to npm — MTB-382
- [x] T009 Create database migration `chat-backend/src/db/migrations/XXX-google-oauth.sql` adding `google_sub VARCHAR(255) UNIQUE` to `users` table and `otp_login_disabled_workbench BOOLEAN NOT NULL DEFAULT FALSE` to `settings` table per `data-model.md` — MTB-382
- [x] T010 [P] Install `google-auth-library` and update `@mentalhelpglobal/chat-types` to 1.5.0 in `chat-backend/package.json` — MTB-382
- [x] T011 [P] Install `@react-oauth/google` in `chat-frontend-common/package.json` — MTB-382
- [x] T012 Update `DbUser` type with `google_sub` field in `chat-backend/src/types/index.ts` — MTB-382

**Checkpoint**: Types published, migration ready, dependencies installed — user story implementation can begin

---

## Phase 3: User Story 1 — Google OAuth Login for Chat and Workbench (Priority: P1) 🎯 MVP

**Goal**: Users can log in to both chat and workbench via Google OAuth. Accounts are linked by email match. New users follow existing approval workflow.

**Independent Test**: Navigate to login page → click "Sign in with Google" → complete Google flow → verify authenticated and redirected to chat/workbench

### Backend (chat-backend)

- [x] T013 [US1] Create `chat-backend/src/services/google-auth.service.ts` implementing `verifyGoogleIdToken(credential: string)` using `OAuth2Client.verifyIdToken()` from `google-auth-library` — returns `{ email, googleSub, name }` or throws on invalid token — MTB-383
- [x] T014 [US1] Add `authenticateWithGoogle(email: string, googleSub: string, displayName: string)` method to `chat-backend/src/services/auth.service.ts` — uses existing `findOrCreateUser()` to find/create user by email, then sets `google_sub` on the user record if not already set — MTB-383
- [x] T015 [US1] Add `POST /api/auth/google` route in `chat-backend/src/routes/auth.ts` — validates request body (`credential`, `surface`), calls `verifyGoogleIdToken`, calls `authenticateWithGoogle`, issues JWT access + refresh tokens (same as OTP verify flow), sets refresh token cookie, returns `{ accessToken, user }` per contract `auth-google.yaml` — MTB-383
- [x] T016 [P] [US1] Add `GET /api/auth/google/config` route in `chat-backend/src/routes/auth.ts` — returns `{ clientId, available }` based on `GOOGLE_OAUTH_CLIENT_ID` env var presence (no auth required) — MTB-383
- [x] T017 [P] [US1] Update `getPublicSettings()` in `chat-backend/src/services/settings.service.ts` to include `googleOAuthAvailable: boolean` based on `GOOGLE_OAUTH_CLIENT_ID` env var presence — MTB-383
- [x] T018 [US1] Add `GOOGLE_OAUTH_CLIENT_ID` to env validation/config in `chat-backend/src/index.ts` or config module (optional env var, Google auth disabled when absent) — MTB-383

### Frontend Common (chat-frontend-common)

- [x] T019 [US1] Create `chat-frontend-common/src/auth/GoogleLoginButton.tsx` wrapping `@react-oauth/google`'s `GoogleLogin` component — accepts `onSuccess(credential)` and `onError()` callbacks, renders Google-branded sign-in button — MTB-384
- [x] T020 [US1] Add `authApi.googleLogin(credential: string, surface: string, invitationCode?: string)` to `chat-frontend-common/src/services/api.ts` — calls `POST /api/auth/google` — MTB-384
- [x] T021 [US1] Add `authApi.getGoogleConfig()` to `chat-frontend-common/src/services/api.ts` — calls `GET /api/auth/google/config`, returns `{ clientId, available }` — MTB-384
- [x] T022 [US1] Add `googleLogin(credential, surface, invitationCode?)` action to `chat-frontend-common/src/stores/authStore.ts` — calls `authApi.googleLogin()`, stores access token, sets user state (same post-login flow as `verifyOtp`) — MTB-384
- [x] T023 [US1] Update `loadPublicSettings()` in `chat-frontend-common/src/stores/authStore.ts` to also load `googleOAuthAvailable` and `otpLoginDisabledWorkbench` from public settings response, store as state — MTB-384
- [x] T024 [US1] Update `chat-frontend-common/src/auth/LoginPage.tsx` — wrap with `GoogleOAuthProvider` (client ID from config/API), add `GoogleLoginButton` above the OTP form with an "or" divider, handle success (call `googleLogin` action) and error callbacks — MTB-384
- [x] T025 [US1] Export `GoogleLoginButton` from `chat-frontend-common/src/index.ts` — MTB-384

### Consumer Apps (chat-frontend, workbench-frontend)

- [x] T026 [P] [US1] Add `GOOGLE_OAUTH_CLIENT_ID` config value reading from `VITE_GOOGLE_OAUTH_CLIENT_ID` env var in `chat-frontend/src/config.ts` — MTB-385
- [x] T027 [P] [US1] Add `GOOGLE_OAUTH_CLIENT_ID` config value reading from `VITE_GOOGLE_OAUTH_CLIENT_ID` env var in `workbench-frontend/src/config.ts` — MTB-385
- [x] T028 [P] [US1] Add Google login i18n keys to `chat-frontend/src/locales/en.json`, `uk.json`, `ru.json` — keys: `login.google.signIn`, `login.google.error`, `login.google.unavailable`, `login.divider` ("or") — MTB-385
- [x] T029 [P] [US1] Add Google login i18n keys to `workbench-frontend/src/locales/en.json`, `uk.json`, `ru.json` — same keys as chat-frontend — MTB-385
- [x] T030 [US1] Update `chat-frontend-common` dependency in `chat-frontend/package.json` and `workbench-frontend/package.json` to pick up LoginPage changes — MTB-385
- [x] T031 [US1] Build and verify `chat-frontend-common` package with all US1 changes — MTB-385

**Checkpoint**: Google OAuth login works end-to-end on both chat and workbench. Accounts link by email. New accounts follow approval flow. This is the MVP.

---

## Phase 4: User Story 3 — Existing OTP Login Remains Functional (Priority: P1)

**Goal**: Existing OTP login continues working exactly as before on both chat and workbench. The Google OAuth addition is purely additive.

**Independent Test**: Log in via existing OTP flow on both chat and workbench → verify experience is unchanged

- [x] T032 [US3] Add optional `surface` parameter to `POST /api/auth/otp/send` request body validation in `chat-backend/src/routes/auth.ts` — accept but do not enforce yet (backward-compatible, defaults to undefined) — MTB-386
- [x] T033 [US3] Update `authApi.sendOtp(email, surface?)` in `chat-frontend-common/src/services/api.ts` to pass optional `surface` parameter — MTB-386
- [x] T034 [US3] Update `OtpLoginForm` in `chat-frontend-common/src/auth/OtpLoginForm.tsx` to accept and pass `surface` prop to `sendOtp()` call — MTB-386
- [x] T035 [US3] Verify OTP login flow works end-to-end on both chat and workbench after all Phase 3 changes — OTP form still visible, codes still delivered, login completes as before — MTB-386

**Checkpoint**: OTP login verified working alongside Google OAuth on both surfaces

---

## Phase 5: User Story 2 — Workbench Setting to Disable OTP Login (Priority: P2)

**Goal**: Owners can toggle OTP login off for the workbench via settings. When disabled, workbench login page shows only Google OAuth. Chat always shows both. Backend enforces the setting.

**Independent Test**: Log in as Owner → Settings → toggle "Disable OTP Login" → verify workbench login shows Google only, chat login still shows both

### Backend Enforcement (chat-backend)

- [x] T036 [US2] Update `getSettings()` and `updateSettings()` in `chat-backend/src/services/settings.service.ts` to include `otp_login_disabled_workbench` field — read from DB, validate boolean, invalidate cache on update — MTB-387
- [x] T037 [US2] Update `PATCH /api/admin/settings` route validation in `chat-backend/src/routes/admin.settings.ts` to accept `otpLoginDisabledWorkbench` boolean field — MTB-387
- [x] T038 [US2] Update `getPublicSettings()` in `chat-backend/src/services/settings.service.ts` to include `otpLoginDisabledWorkbench` in public response — MTB-387
- [x] T039 [US2] Add OTP disable enforcement in `POST /api/auth/otp/send` handler in `chat-backend/src/routes/auth.ts` — when `surface === 'workbench'` and `otpLoginDisabledWorkbench` is `true`, return 403 with error `otp_disabled_workbench` — MTB-387
- [x] T040 [P] [US2] Add `FORCE_ENABLE_OTP` environment variable check in `chat-backend/src/routes/auth.ts` — when set to `true`, bypasses the OTP disable check (recovery mechanism) — MTB-387

### Frontend Enforcement (chat-frontend-common, workbench-frontend)

- [x] T041 [US2] Update `OtpLoginForm` in `chat-frontend-common/src/auth/OtpLoginForm.tsx` to conditionally hide when `otpLoginDisabledWorkbench` is `true` and surface is `workbench` — read from authStore public settings state — MTB-388
- [x] T042 [US2] Update `LoginPage` in `chat-frontend-common/src/auth/LoginPage.tsx` to adapt layout when OTP form is hidden (Google-only layout, no divider, no empty space) — MTB-388
- [x] T043 [US2] Add OTP disable toggle to admin section in `workbench-frontend/src/features/workbench/settings/SettingsView.tsx` — Owner-only toggle labeled "Disable OTP Login for Workbench", calls `adminSettingsApi.update({ otpLoginDisabledWorkbench })` with confirmation — MTB-388
- [x] T044 [US2] Update `AppSettingsDto` interface and `adminSettingsApi.update()` in `workbench-frontend/src/services/adminApi.ts` to include `otpLoginDisabledWorkbench` field — MTB-388
- [x] T045 [P] [US2] Add i18n keys for OTP disable setting to `workbench-frontend/src/locales/en.json`, `uk.json`, `ru.json` — keys: `settings.auth.otpDisableLabel`, `settings.auth.otpDisableDescription`, `settings.auth.otpDisableConfirm` — MTB-388
- [x] T046 [P] [US2] Add i18n key for OTP disabled error to `chat-frontend-common` locales or consumer app locales — key: `login.otp.disabled_workbench` — MTB-388

**Checkpoint**: OTP disable setting works. Workbench login page hides OTP when disabled. Chat unaffected. Backend enforces the restriction.

---

## Phase 6: User Story 4 — Login Page Presents Both Options Clearly (Priority: P2)

**Goal**: Login page has a polished dual-option layout following Google branding, with responsive behavior across mobile/tablet/desktop viewports.

**Independent Test**: View login page on 360px, 768px, and 1024px+ viewports — both options visible, properly laid out, Google button follows branding, accessible via keyboard

- [x] T047 [US4] Refine login page layout in `chat-frontend-common/src/auth/LoginPage.tsx` — Google button at top, "or" divider with horizontal line, OTP form below, visually balanced spacing, no scroll needed on desktop — MTB-389
- [x] T048 [US4] Verify Google sign-in button renders with official Google branding (automatic via `@react-oauth/google` `GoogleLogin` component) — test light and dark themes — MTB-389
- [x] T049 [P] [US4] Validate responsive layout of login page at 360px (mobile), 768px (tablet), and 1024px+ (desktop) in both `chat-frontend` and `workbench-frontend` — both options accessible, no overflow, touch targets meet minimum size — MTB-389
- [x] T050 [US4] Verify keyboard navigation and screen reader accessibility on login page — Google button and OTP form reachable via Tab, Enter activates, focus indicators visible — MTB-389

**Checkpoint**: Login page looks polished across all viewports with both auth options clearly presented

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Infrastructure, CI/CD, E2E tests, documentation, and merge workflow

### Infrastructure & CI/CD

- [x] T051 [P] Add `google-oauth-client-secret` entry to `chat-infra/config/secrets.json` and update `chat-infra/scripts/setup-secrets.sh` with secret creation and IAM grant — MTB-390
- [x] T052 [P] Add `GOOGLE_OAUTH_CLIENT_ID` variable to `chat-infra/config/github-envs/dev.json` and `prod.json` — MTB-390
- [x] T053 [P] Add `GOOGLE_OAUTH_CLIENT_ID` env var to Cloud Run deploy step in `chat-ci/.github/workflows/deploy.yml` and `deploy-backend.yml` — MTB-390

### Security & Logging

- [x] T054 Add authentication audit logging for Google OAuth events (login success, login failure, account linked, account created) in `chat-backend/src/routes/auth.ts` using existing `logAuditEvent()` pattern — MTB-390

### E2E Tests (chat-ui)

- [x] T055 [P] Create Playwright E2E test `chat-ui/tests/google-oauth-login.spec.ts` — verify Google sign-in button appears on login page, verify `/api/auth/google/config` returns expected response, verify `/api/auth/google` returns 400 for invalid credential — MTB-390
- [x] T056 [P] Create Playwright E2E test `chat-ui/tests/otp-disable-setting.spec.ts` — verify OTP disable toggle in workbench settings (Owner), verify workbench login page hides OTP when disabled, verify chat login page always shows both — MTB-390

### Documentation

- [x] T057 [P] Capture screenshots of updated login pages (chat + workbench, with and without OTP disabled) via Playwright MCP against dev environment — MTB-391
- [x] T058 [P] Update Confluence User Manual with Google sign-in instructions and new login page screenshots for both chat and workbench — MTB-391
- [x] T059 [P] Update Confluence Technical Onboarding with new environment variables (`GOOGLE_OAUTH_CLIENT_ID`, `VITE_GOOGLE_OAUTH_CLIENT_ID`), OAuth client setup procedure, and new dependencies — MTB-391
- [x] T060 [P] Update Confluence Non-Technical Onboarding with updated login flow description and workbench OTP disable setting explanation — MTB-391
- [x] T061 [P] Update Confluence Release Notes with production release entry — ONLY when promoting to production via tagged `main` commit; skip when merging to `develop` — MTB-391

### Merge & Cleanup

- [x] T062 Open PR(s) from `015-google-oauth-login` branch to `develop` in all affected repos, obtain required reviews, and merge only after all required checks pass — MTB-392
- [x] T063 Verify unit and UI/E2E test gates passed for merged PR(s) — MTB-392
- [x] T064 Capture post-deploy smoke evidence for critical routes: `/login` (chat), `/login` (workbench), `/api/auth/google`, `/api/auth/google/config`, `/api/auth/otp/send`, `/api/admin/settings`, `/api/public/settings` — MTB-392
- [x] T065 Delete merged remote feature branches and purge local feature branches in all affected repos — MTB-392
- [x] T066 Sync local `develop` to `origin/develop` in each affected repository — MTB-392
- [x] T067 Add completion summary comment to Jira Epic MTB-376 with evidence references and outcome — MTB-392

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — core MVP
- **US3 (Phase 4)**: Depends on US1 — backward compatibility verification
- **US2 (Phase 5)**: Depends on US1 + US3 (surface param) — adds OTP disable
- **US4 (Phase 6)**: Depends on US1 — can run in parallel with US2 and US3
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no other story dependencies — **MVP**
- **US3 (P1)**: Depends on US1 — validates backward compatibility
- **US2 (P2)**: Depends on US3 (surface param) — adds enforcement
- **US4 (P2)**: Depends on US1 — independent of US2/US3

### Within Each User Story

- Backend before frontend (API must exist before UI consumes it)
- Common package before consumer apps
- Parallelizable tasks marked [P] can run concurrently

### Parallel Opportunities

- T004, T005, T006 can run in parallel (different files in chat-types)
- T010, T011 can run in parallel (different repos)
- T016, T017 can run in parallel (different files in chat-backend)
- T026, T027, T028, T029 can run in parallel (different repos/files)
- T040, T045, T046 can run in parallel
- T051, T052, T053 can run in parallel (different repos)
- T055, T056 can run in parallel (different test files)
- T057–T061 can run in parallel (different Confluence pages)
- **US4 can run entirely in parallel with US2** (no dependencies between them)

---

## Parallel Example: User Story 1 (Phase 3)

```text
# After foundational phase, launch backend tasks:
T013: Create google-auth.service.ts (chat-backend)
T016: Add GET /api/auth/google/config route (chat-backend) — parallel with T013
T017: Update getPublicSettings() (chat-backend) — parallel with T013

# After T013 completes, T014 and T015 proceed sequentially:
T014: Add authenticateWithGoogle() to auth.service.ts
T015: Add POST /api/auth/google route

# Frontend tasks can start after T015+T016+T017:
T019, T020, T021: Component + API service (parallel, different files)
T022: authStore update (after T020)
T024: LoginPage update (after T019, T022, T023)

# Consumer apps (parallel after common package built):
T026 + T027 + T028 + T029: Config + i18n (all parallel, different repos)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (branches + GCP credentials)
2. Complete Phase 2: Foundational (types + migration + deps)
3. Complete Phase 3: User Story 1 (Google OAuth login flow)
4. **STOP and VALIDATE**: Test Google OAuth login on both chat and workbench
5. Deploy to dev for early feedback

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test → Deploy/Demo (**MVP — Google login works!**)
3. Add US3 → Verify OTP backward compatibility
4. Add US2 → Test OTP disable setting → Deploy/Demo
5. Add US4 → Test responsive/branding polish → Deploy/Demo
6. Polish → Infra + CI + E2E + Docs → PR and merge

### Parallel Team Strategy

With multiple developers after Foundational phase:
- Developer A: US1 backend (T013–T018) then US2 backend (T036–T040)
- Developer B: US1 frontend (T019–T031) then US4 (T047–T050)
- Developer C: Infra + CI (T051–T053) then E2E tests (T055–T056)

---

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done immediately when the corresponding task is marked `[X]` — do NOT batch transitions at the end. Stories are transitioned when all their tasks are complete.
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never merge directly into `develop`; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local `develop`
- `chat-frontend-common` must be built and published/linked before consumer apps can pick up changes
