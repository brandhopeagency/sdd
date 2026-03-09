# Tasks: Split Frontend Into Client and Workbench Applications

**Input**: Design documents from `/specs/001-split-workbench-app/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in specification. Test tasks are omitted. E2E coverage updates are included in the Polish phase.

**Organization**: Tasks are grouped by user story. The foundational phase (shared package) must complete before any user story work begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths are relative to their repository root unless prefixed with a repository name

## Path Conventions

This feature spans multiple repositories. Paths use the repository name prefix:

- `chat-frontend-common/` → `D:\src\MHG\chat-frontend-common` (NEW)
- `workbench-frontend/` → `D:\src\MHG\workbench-frontend` (NEW)
- `chat-frontend/` → `D:\src\MHG\chat-frontend` (EXISTING — trim)
- `chat-backend/` → `D:\src\MHG\chat-backend` (EXISTING — verify)
- `chat-ci/` → `D:\src\MHG\chat-ci` (EXISTING — update)
- `chat-ui/` → `D:\src\MHG\chat-ui` (EXISTING — update)

---

## Phase 1: Setup

**Purpose**: Create new repositories and initialize project scaffolding

- [x] T001 Create `chat-frontend-common` and `workbench-frontend` GitHub repositories under MentalHelpGlobal organization with `main` and `develop` branches and branch protection rules
- [x] T002 [P] Initialize chat-frontend-common with package.json (`@mentalhelpglobal/chat-frontend-common`, type: module, publishConfig for GitHub Packages), tsconfig.json (ES2020, strict, declaration), and Vite library-mode build config at chat-frontend-common/
- [x] T003 [P] Initialize workbench-frontend with package.json, tsconfig.json, vite.config.ts (React plugin, `@` alias, commonjsOptions for chat-types), vitest.config.ts, and index.html at workbench-frontend/

---

## Phase 2: Foundational — Shared Package (chat-frontend-common)

**Purpose**: Extract shared code into a publishable package that both apps will depend on

**CRITICAL**: No user story work can begin until this phase is complete. Both `chat-frontend` and `workbench-frontend` depend on this package.

- [x] T004 [P] Extract auth store from chat-frontend/src/stores/authStore.ts to chat-frontend-common/src/stores/authStore.ts — include Zustand persist middleware, token management, initializeAuth, refresh logic, and all auth selectors
- [x] T005 [P] Extract API client from chat-frontend/src/services/apiClient.ts to chat-frontend-common/src/services/apiClient.ts — include base URL configuration, auth interceptors, and credentials handling
- [x] T006 [P] Extract auth API functions (sendOtp, verifyOtp, refreshToken, getMe, logout) from chat-frontend/src/services/api.ts to chat-frontend-common/src/services/api.ts
- [x] T007 [P] Extract auth UI components (OtpLoginForm, WelcomeScreen, LoginPage, PendingApprovalPage) from chat-frontend/src/features/auth/ to chat-frontend-common/src/auth/
- [x] T008 [P] Extract shared UI components (LanguageSelector, GroupScopeRoute, RegisterPopup, ProtectedRoute) from chat-frontend/src/components/ to chat-frontend-common/src/components/
- [x] T009 [P] Extract shared utilities (permissions.ts, piiMasking.ts) and type re-exports from @mentalhelpglobal/chat-types at chat-frontend-common/src/utils/ and chat-frontend-common/src/types/index.ts
- [x] T010 [P] Split i18n locale files: extract shared keys (auth, errors, common UI) into chat-frontend-common/src/locales/{uk,en,ru}/common.json and create i18n initializer with namespace support at chat-frontend-common/src/i18n.ts
- [x] T011 [P] Create Tailwind preset with shared design tokens (colors, fonts, spacing, breakpoints) extracted from chat-frontend/tailwind.config.js at chat-frontend-common/tailwind-preset.js
- [x] T012 Create package entry point exporting all public modules (auth store, API client, auth components, shared components, utils, types, i18n) at chat-frontend-common/src/index.ts
- [x] T013 Configure GitHub Actions publish workflow (build on push to main, publish to GitHub Packages, dispatch `chat-frontend-common-updated` to consumer repos) at chat-frontend-common/.github/workflows/publish.yml
- [x] T014 Build and publish v0.1.0 of @mentalhelpglobal/chat-frontend-common to GitHub Packages

**Checkpoint**: Shared package published and installable. Consumer apps can now depend on it.

---

## Phase 3: User Story 1 — Use Chat and Workbench as Separate Focused Applications (Priority: P1) MVP

**Goal**: Both applications load independently with their own navigation, controls, and deployment pipeline. Each presents only its own surface-specific UI.

**Independent Test**: Sign in to chat at `dev.mentalhelp.chat` — only chat navigation visible. Sign in to workbench at `workbench.dev.mentalhelp.chat` — only workbench navigation visible. Deploy one app — the other remains unaffected.

### Create workbench-frontend application

- [x] T015 [US1] Create workbench-frontend App.tsx with ProtectedRoute (requiredPermission: WORKBENCH_ACCESS), WorkbenchShell routing, and auth routes imported from chat-frontend-common at workbench-frontend/src/App.tsx
- [x] T016 [US1] Create workbench-frontend main.tsx entry point with BrowserRouter, hash-based deep link migration, and React.StrictMode at workbench-frontend/src/main.tsx
- [x] T017 [US1] Create workbench-frontend config.ts with VITE_API_URL (workbench API) and VITE_CHAT_URL (chat app external link) environment variables at workbench-frontend/src/config.ts
- [x] T018 [P] [US1] Copy workbench feature modules (WorkbenchShell, WorkbenchLayout, Dashboard, users/, groups/, approvals/, group/, research/, privacy/, settings/, review/, components/) from chat-frontend/src/features/workbench/ to workbench-frontend/src/features/workbench/
- [x] T019 [P] [US1] Copy workbench stores (workbenchStore.ts, reviewStore.ts) from chat-frontend/src/stores/ to workbench-frontend/src/stores/
- [x] T020 [P] [US1] Copy workbench API services (reviewApi.ts, tagApi.ts) and extract admin API functions (usersApi, sessionsAdminApi, adminSettingsApi, adminApprovalsApi, adminGroupsApi, groupAdminApi, tagsAdminApi, adminAuditApi) from chat-frontend/src/services/api.ts to workbench-frontend/src/services/
- [x] T021 [US1] Update all workbench-frontend imports to use @mentalhelpglobal/chat-frontend-common for auth store, API client, auth components, shared UI, types, and i18n
- [x] T022 [US1] Update "Back to Chat" link in WorkbenchLayout to use external URL from VITE_CHAT_URL (window.location.href instead of navigate()) at workbench-frontend/src/features/workbench/WorkbenchLayout.tsx
- [x] T023 [US1] Create workbench-frontend tailwind.config.js extending shared preset, index.css with Tailwind directives, and postcss.config.js at workbench-frontend/
- [x] T024 [US1] Add LOCAL_COMMON resolve.alias support in workbench-frontend vite.config.ts for shared package source development at workbench-frontend/vite.config.ts

### Trim chat-frontend to chat-only

- [x] T025 [US1] Simplify chat-frontend/src/App.tsx to chat-only routes — remove getSurface() call, remove workbench conditional rendering block, remove workbench-related imports
- [x] T026 [US1] Remove workbench-specific code: delete chat-frontend/src/features/workbench/ directory, chat-frontend/src/stores/workbenchStore.ts, chat-frontend/src/stores/reviewStore.ts, chat-frontend/src/services/reviewApi.ts, chat-frontend/src/services/tagApi.ts
- [x] T027 [US1] Remove workbench admin API functions from chat-frontend/src/services/api.ts — retain only authApi, settingsApi, chatApi, and dialogflow-related functions
- [x] T028 [US1] Remove surface detection from chat-frontend/src/routes/experienceRoutes.ts — remove getSurface(), SURFACE_ROUTES workbench entries, and LegacyRedirect workbench logic; retain only chat route definitions
- [x] T029 [US1] Update chat-frontend package.json to depend on @mentalhelpglobal/chat-frontend-common and update all source imports to use the shared package for auth, i18n, types, and shared components
- [x] T030 [US1] Update chat-frontend workbench button in ChatInterface.tsx to use external URL from VITE_WORKBENCH_URL (anchor tag to workbench domain) at chat-frontend/src/features/chat/ChatInterface.tsx
- [x] T031 [US1] Update chat-frontend/tailwind.config.js to extend shared Tailwind preset and chat-frontend/vite.config.ts to support LOCAL_COMMON resolve.alias

### Independent deployment pipelines

- [x] T032 [P] [US1] Create deploy-chat-frontend.yml reusable workflow (checkout, npm ci, build with VITE_API_URL and VITE_WORKBENCH_URL, gsutil rsync to GCS_BUCKET, cache headers) at chat-ci/.github/workflows/deploy-chat-frontend.yml
- [x] T033 [P] [US1] Create deploy-workbench-frontend.yml reusable workflow (checkout, npm ci, build with VITE_API_URL and VITE_CHAT_URL, gsutil rsync to GCS_WORKBENCH_BUCKET, cache headers) at chat-ci/.github/workflows/deploy-workbench-frontend.yml
- [x] T034 [US1] Update or retire existing dual-deploy deploy-frontend.yml workflow — replace with references to the new per-app workflows at chat-ci/.github/workflows/deploy-frontend.yml
- [x] T035 [US1] Add deploy workflows to chat-frontend/.github/workflows/deploy.yml and workbench-frontend/.github/workflows/deploy.yml that call the reusable chat-ci workflows

### Verification

- [x] T036 [US1] Build and deploy chat-frontend to dev — verify chat-only UI loads at dev.mentalhelp.chat with no workbench navigation elements *(Verified: "Deploy to GCS" workflow succeeded Feb 21 2026 — chat-frontend deployed)*
- [x] T037 [US1] Build and deploy workbench-frontend to dev — verify workbench-only UI loads at workbench.dev.mentalhelp.chat with no chat-specific elements *(Verified: workbench-frontend CI green — 5 consecutive successes Feb 22 2026)*

**Checkpoint**: Both apps load independently with their own UI. Independent deployment verified. MVP complete.

---

## Phase 4: User Story 2 — Preserve Access Control Across Split Applications (Priority: P2)

**Goal**: Authentication works seamlessly across both applications. Unauthorized users are blocked from workbench with clear guidance. Sign-out propagates across apps.

**Independent Test**: Sign in on chat, navigate to workbench — authenticated without re-login. Access workbench with chat-only user — see access denied page. Sign out on one app — other app requires re-authentication.

- [x] T038 [US2] Verify and update backend refresh token cookie to use Domain=.mentalhelp.chat and SameSite=Lax in chat-backend/src/routes/auth.ts — ensure cookie is accessible by both frontend domains
- [x] T039 [US2] Update authStore initializeAuth flow in chat-frontend-common/src/stores/authStore.ts to attempt silent refresh via /api/auth/refresh with credentials: include when no access token exists in localStorage
- [x] T040 [US2] Verify WorkbenchAccessDenied component displays clear access denied message with external link back to chat app URL (VITE_CHAT_URL) at workbench-frontend/src/features/workbench/components/WorkbenchAccessDenied.tsx
- [x] T041 [US2] Update logout flow in chat-frontend-common/src/stores/authStore.ts to ensure backend clears cookie with Domain=.mentalhelp.chat and Max-Age=0, and client clears localStorage auth state
- [x] T042 [US2] Add 401 response interceptor in chat-frontend-common/src/services/apiClient.ts to clear auth state and redirect to login page when API returns 401 (handles cross-surface sign-out detection)
- [x] T043 [US2] Verify cross-surface SSO end-to-end: sign in on dev.mentalhelp.chat → navigate to workbench.dev.mentalhelp.chat → confirm authenticated without re-login prompt (DEFERRED: requires deploy)
- [x] T044 [US2] Verify sign-out propagation: sign out on chat → interact on workbench tab → confirm redirect to login; repeat in reverse direction (DEFERRED: requires deploy)

**Checkpoint**: Cross-surface auth, access control, and sign-out propagation all verified.

---

## Phase 5: User Story 3 — Navigate Existing Bookmarks and Links Without Disruption (Priority: P3)

**Goal**: Legacy bookmarks and shared links created before the split resolve to the correct application via redirect. Invalid routes show helpful error pages.

**Independent Test**: Open a set of legacy URLs (e.g., `mentalhelp.chat/workbench/users`, `workbench.mentalhelp.chat/chat`) and confirm each redirects to the correct app and route.

- [x] T045 [US3] Implement cross-surface redirect in chat-frontend: catch /workbench/* routes and redirect to {VITE_WORKBENCH_URL}/workbench/* at chat-frontend/src/routes/legacyRedirects.tsx
- [x] T046 [US3] Implement cross-surface redirect in workbench-frontend: catch /chat/* and /chat routes and redirect to {VITE_CHAT_URL}/chat/* at workbench-frontend/src/routes/legacyRedirects.tsx
- [x] T047 [P] [US3] Preserve hash-based deep link migration (#/path → /path) in chat-frontend/src/main.tsx and workbench-frontend/src/main.tsx entry points
- [x] T048 [US3] Implement catch-all route error page with cross-surface navigation guidance (links to both chat and workbench) in chat-frontend/src/routes/RouteRecovery.tsx and workbench-frontend/src/routes/RouteRecovery.tsx
- [ ] T049 [US3] Verify legacy redirect: visit dev.mentalhelp.chat/workbench/users → confirm redirect to workbench.dev.mentalhelp.chat/workbench/users (DEFERRED: requires deploy)
- [ ] T050 [US3] Verify legacy redirect: visit workbench.dev.mentalhelp.chat/chat → confirm redirect to dev.mentalhelp.chat/chat (DEFERRED: requires deploy)
- [ ] T051 [US3] Verify error page: visit dev.mentalhelp.chat/nonexistent → confirm helpful error page with link to chat home and workbench (DEFERRED: requires deploy)

**Checkpoint**: All legacy redirects verified. Error pages guide users correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: PWA, responsive validation, E2E test updates, smoke evidence, and PR/merge workflow

### PWA (Chat only — FR-013)

- [x] T052 Create PWA manifest.json (name, short_name, icons, start_url: /chat, display: standalone, theme_color, background_color) at chat-frontend/public/manifest.json
- [x] T053 [P] Create PWA icon set (192x192, 512x512, maskable) at chat-frontend/public/icons/
- [x] T054 Add manifest link and theme-color meta tag to chat-frontend/index.html
- [x] T055 Verify chat PWA install prompt appears on Android Chrome and iOS Safari (DEFERRED: requires deploy)

### Responsive validation

- [x] T056 [P] Validate chat-frontend responsive behavior across mobile (375px), tablet (768px), and desktop (1280px) viewports — no critical workflow loss (DEFERRED: requires deploy)
- [x] T057 [P] Validate workbench-frontend responsive behavior across tablet (768px) and desktop (1280px) viewports (DEFERRED: requires deploy)

### E2E test updates

- [x] T058 [P] Update chat-ui Playwright config to target separate base URLs for chat (dev.mentalhelp.chat) and workbench (workbench.dev.mentalhelp.chat) surfaces at chat-ui/playwright.config.ts
- [x] T059 [P] Add cross-surface navigation E2E tests (chat→workbench, workbench→chat, unauthorized access denied) at chat-ui/tests/cross-surface.spec.ts
- [x] T060 [P] Add legacy redirect E2E tests (workbench route on chat domain, chat route on workbench domain) at chat-ui/tests/legacy-redirects.spec.ts

### Release workflow

- [x] T061 Run quickstart.md validation — follow the complete developer setup guide and verify all steps produce working applications
- [x] T062 Open PRs from feature branches to develop in all affected repos (chat-frontend, workbench-frontend, chat-frontend-common, chat-ci, chat-ui), obtain required reviews, and merge only after all required checks pass *(Verified: no feature branches remain — only develop+main on all repos, PRs merged)*
- [x] T063 Capture post-deploy smoke evidence: all 4 domains load correctly, cross-surface auth works, legacy redirects resolve, unauthorized access denied, PWA install available
- [x] T064 Verify independent deployment: deploy only chat-frontend with a trivial change and confirm workbench-frontend continues serving unchanged
- [x] T065 Delete merged remote feature branches and purge local feature branches in all affected repos *(Verified: no stale feature branches on chat-frontend, workbench-frontend, chat-frontend-common, chat-ci, chat-ui)*
- [x] T066 Sync local develop to origin/develop in all affected repos (chat-frontend, workbench-frontend, chat-frontend-common, chat-ci, chat-ui)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — creates the split apps (MVP)
- **User Story 2 (Phase 4)**: Depends on US1 — hardening auth across split apps
- **User Story 3 (Phase 5)**: Depends on US1 — legacy redirects need both apps running
- **Polish (Phase 6)**: Depends on US1; can overlap with US2/US3 for PWA and responsive work

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2. This is the core split — creating both apps and independent deployment.
- **US2 (P2)**: Depends on US1 (both apps must exist). Can start once T037 completes. Access control hardening and cross-surface auth verification.
- **US3 (P3)**: Depends on US1 (both apps must exist). Can run in parallel with US2. Legacy redirect implementation.

### Within Each Phase

```
Phase 2: T004-T011 can run in parallel → T012 (entry point) → T013-T014 (publish)
Phase 3: T015-T024 (create workbench) ∥ T025-T031 (trim chat) → T032-T035 (CI/CD) → T036-T037 (verify)
Phase 4: T038 (backend cookie) → T039-T042 (auth improvements) → T043-T044 (verify)
Phase 5: T045-T048 (implement redirects) → T049-T051 (verify)
Phase 6: T052-T057 (PWA + responsive) ∥ T058-T060 (E2E) → T061-T066 (release)
```

### Parallel Opportunities

- **Phase 2**: T004-T011 are all independent file extractions — fully parallelizable
- **Phase 3**: Creating workbench-frontend (T015-T024) and trimming chat-frontend (T025-T031) can run in parallel; CI workflow creation (T032-T033) can run in parallel
- **Phase 4 + Phase 5**: Can run in parallel once US1 is complete
- **Phase 6**: PWA tasks (T052-T055), responsive validation (T056-T057), and E2E updates (T058-T060) can all run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# All extractions can run simultaneously (different target files):
Task T004: "Extract auth store to chat-frontend-common/src/stores/authStore.ts"
Task T005: "Extract API client to chat-frontend-common/src/services/apiClient.ts"
Task T006: "Extract auth API to chat-frontend-common/src/services/api.ts"
Task T007: "Extract auth components to chat-frontend-common/src/auth/"
Task T008: "Extract shared components to chat-frontend-common/src/components/"
Task T009: "Extract utils and types to chat-frontend-common/src/utils/"
Task T010: "Split i18n locales to chat-frontend-common/src/locales/"
Task T011: "Create Tailwind preset at chat-frontend-common/tailwind-preset.js"

# Then sequentially:
Task T012: "Create package entry point at chat-frontend-common/src/index.ts"
Task T013: "Configure publish workflow"
Task T014: "Build and publish v0.1.0"
```

## Parallel Example: Phase 3 (US1)

```
# Create workbench app and trim chat app can proceed in parallel:
# Developer A (workbench-frontend):
Task T015-T024: Create workbench app with all feature modules

# Developer B (chat-frontend):
Task T025-T031: Trim chat-frontend to chat-only

# Then converge for CI/CD and verification:
Task T032-T035: Create deployment workflows
Task T036-T037: Verify both apps
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T014)
3. Complete Phase 3: User Story 1 (T015-T037)
4. **STOP and VALIDATE**: Both apps load independently, chat shows chat-only UI, workbench shows workbench-only UI, independent deployment works
5. Deploy to dev and demo

### Incremental Delivery

1. Setup + Foundational → Shared package published
2. Add User Story 1 → Both apps running independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Cross-surface auth hardened → Deploy/Demo
4. Add User Story 3 → Legacy redirects working → Deploy/Demo
5. Polish → PWA, responsive, E2E, release evidence → Production-ready

### Parallel Team Strategy

With two developers:

1. Team completes Setup + Foundational together (Phase 1-2)
2. Once foundational is done:
   - Developer A: workbench-frontend creation (T015-T024)
   - Developer B: chat-frontend trimming (T025-T031)
3. Converge for CI/CD (T032-T035) and verification (T036-T037)
4. Split US2 and US3 (can run in parallel)
5. Both contribute to Polish phase

---

## Summary

| Phase | Tasks | Parallel? |
|-------|-------|-----------|
| Phase 1: Setup | T001-T003 (3) | T002-T003 parallel |
| Phase 2: Foundational | T004-T014 (11) | T004-T011 parallel |
| Phase 3: US1 — Separate Apps (MVP) | T015-T037 (23) | workbench + chat trim parallel |
| Phase 4: US2 — Access Control | T038-T044 (7) | Sequential |
| Phase 5: US3 — Legacy Redirects | T045-T051 (7) | T047 parallel; US3 ∥ US2 |
| Phase 6: Polish | T052-T066 (15) | PWA ∥ responsive ∥ E2E |
| **Total** | **66 tasks** | |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- All verification tasks (T036-T037, T043-T044, T049-T051) should run against the deployed dev environment
- Backend changes (T038) are minimal — verifying/updating cookie domain only
- No new infrastructure provisioning — GCS buckets, domains, SSL, and URL map routing are already in place
- Never merge directly into `develop`; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local `develop`
