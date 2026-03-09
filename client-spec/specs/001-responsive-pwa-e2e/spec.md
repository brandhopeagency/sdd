# Feature Specification: Responsive PWA With Cross-Device E2E Testing

**Feature Branch**: `001-responsive-pwa-e2e`  
**Created**: 2026-02-22  
**Status**: Complete  
**Jira Epic**: [MTB-311](https://mentalhelpglobal.atlassian.net/browse/MTB-311)  
**Input**: User description: "make sure that both chat and workbench app are responsive and can be installed as PWA on mobile. e2e tests should include testing of responsiveness on mobile/tablet/desktop applications"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Responsive layouts across all viewports for both apps (Priority: P1)

As a user on any device, I can use both the chat application and the workbench
application with layouts that adapt appropriately to my screen size, whether I
am on a phone, tablet, or desktop.

**Why this priority**: Responsive behavior is the foundation that enables mobile
and tablet access for both applications. Without it, neither PWA installation
nor device-specific testing delivers value.

**Independent Test**: Open both chat and workbench applications at phone, tablet,
and desktop viewport widths and complete primary workflows without horizontal
scrolling, hidden controls, or broken layouts.

**Acceptance Scenarios**:

1. **Given** a phone-sized viewport (≤480px), **When** a user opens the chat
   application, **Then** all chat flows (message input, conversation list,
   settings) are usable without horizontal scrolling.
2. **Given** a phone-sized viewport (≤480px), **When** a user opens the
   workbench application, **Then** all workbench flows (review sessions,
   ratings, navigation) are usable without horizontal scrolling.
3. **Given** a tablet-sized viewport (481px–1024px), **When** a user navigates
   either application, **Then** layouts take advantage of available space while
   remaining touch-friendly.
4. **Given** a desktop-sized viewport (≥1025px), **When** a user uses either
   application, **Then** layouts remain consistent with current desktop
   experience and no regressions are introduced.
5. **Given** a user rotates their device between portrait and landscape, **When**
   a page is open, **Then** the layout adapts without losing state or breaking
   controls.

---

### User Story 2 - Install both apps as PWA on mobile (Priority: P2)

As a mobile user, I can install both the chat application and the workbench
application to my home screen and use them like native apps.

**Why this priority**: PWA installability gives mobile users quick access and a
near-native experience, but depends on responsive layouts being in place first.

**Independent Test**: On a supported mobile browser, trigger the PWA install
flow for each application, verify installation succeeds, and confirm the app
launches correctly from the home screen.

**Acceptance Scenarios**:

1. **Given** a supported mobile browser, **When** install criteria are met for
   the chat application, **Then** the user can install it and launch from the
   home screen.
2. **Given** a supported mobile browser, **When** install criteria are met for
   the workbench application, **Then** the user can install it and launch from
   the home screen.
3. **Given** an installed PWA (either app), **When** the user opens it from the
   home screen, **Then** it launches in standalone mode with the correct start
   URL, theme color, and app name.
4. **Given** a browser/platform that does not support installation, **When** the
   user accesses either application, **Then** the app works fully in regular
   browser mode with no install-related errors or broken prompts.

---

### User Story 3 - E2E tests validate responsiveness across device classes (Priority: P3)

As a development team, we have automated E2E tests that verify both applications
behave correctly on mobile, tablet, and desktop viewports, catching responsive
regressions before they reach users.

**Why this priority**: Automated cross-device E2E testing prevents regressions
and ensures ongoing confidence in responsive behavior as both applications
evolve. It is lower priority than the functional behavior it validates.

**Independent Test**: Run the E2E responsive test suite and confirm it exercises
core flows on phone, tablet, and desktop viewports for both applications,
reporting pass/fail results per viewport class.

**Acceptance Scenarios**:

1. **Given** the E2E test suite, **When** tests run against the chat application,
   **Then** core user flows are exercised at phone, tablet, and desktop viewport
   sizes with per-viewport pass/fail reporting.
2. **Given** the E2E test suite, **When** tests run against the workbench
   application, **Then** core user flows are exercised at phone, tablet, and
   desktop viewport sizes with per-viewport pass/fail reporting.
3. **Given** a responsive regression is introduced, **When** the E2E suite runs
   in CI, **Then** the regression is detected and the build is flagged before
   merge.
4. **Given** a new core flow is added to either application, **When** the
   responsive E2E tests are updated, **Then** the new flow is covered at all
   three viewport classes.

---

### Edge Cases

- Extremely narrow phone widths (≤320px) must still keep primary actions
  accessible even if layout shifts significantly.
- Orientation changes must not corrupt form state, navigation position, or
  in-progress workflows.
- Split-screen or multi-window modes on tablets must degrade gracefully.
- If PWA install is unavailable, no install-related UI artifacts (broken buttons,
  empty prompts) should appear.
- Network loss during PWA launch must show a clear offline indicator rather than
  a blank screen.
- E2E tests must handle viewport resize timing to avoid flaky assertions from
  incomplete layout reflows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both the chat application and the workbench application MUST
  provide responsive layouts that adapt to phone (≤480px), tablet (481–1024px),
  and desktop (≥1025px) viewport classes.
- **FR-002**: Both applications MUST keep primary navigation and primary actions
  reachable and usable at all supported viewport sizes.
- **FR-003**: Both applications MUST handle device orientation changes without
  losing user state or breaking layout.
- **FR-004**: Both applications MUST provide touch-comfortable interaction
  targets on touch-capable devices, meeting minimum tap target sizing standards.
- **FR-005**: Both applications MUST support PWA installability on
  browsers/platforms that support web app installation.
- **FR-006**: Each application MUST include a valid web app manifest with
  appropriate metadata (name, icons, start URL, display mode, theme color).
- **FR-007**: Each application MUST register a service worker to meet PWA
  installability criteria.
- **FR-008**: Both applications MUST provide graceful degradation when PWA
  installation is not supported, remaining fully functional in-browser.
- **FR-009**: An automated E2E test suite MUST validate core user flows on
  phone, tablet, and desktop viewport sizes for both applications.
- **FR-010**: The E2E responsive test suite MUST run in CI and block merges
  when responsive regressions are detected.
- **FR-011**: E2E tests MUST report results per viewport class (phone, tablet,
  desktop) for clear regression attribution.

### Key Entities

- **Application Target**: A distinct deployable web application (chat or
  workbench) that must independently satisfy responsive and PWA requirements.
- **Viewport Class**: A named screen-size category (phone, tablet, desktop)
  with defined width breakpoints used for layout adaptation and E2E test
  parameterization.
- **PWA Manifest**: Per-application metadata file declaring app identity, icons,
  start URL, display mode, and theme color for installability.
- **Responsive E2E Test**: An automated browser test parameterized by viewport
  class that validates layout integrity and workflow completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of defined core user flows in both applications pass
  functional validation at phone, tablet, and desktop viewport classes.
- **SC-002**: PWA installation succeeds on 100% of targeted supported
  browser/platform combinations for both applications.
- **SC-003**: The automated E2E responsive test suite covers at least 80% of
  core user flows across all three viewport classes for both applications.
- **SC-004**: 0 responsive or PWA regressions reach production after the E2E
  gate is enabled in CI.
- **SC-005**: E2E test results clearly attribute failures to specific viewport
  classes, enabling targeted fixes within one development cycle.
- **SC-006**: Both applications remain fully functional in regular browser mode
  on platforms that do not support PWA installation.

## Assumptions

- The chat application and workbench application are deployed as separate web
  applications with independent build pipelines and hosting.
- Core user flows for each application are already identified or will be
  cataloged as part of E2E test authoring.
- The E2E test framework (Playwright) supports viewport emulation and device
  profile configuration.
- PWA installability targets modern mobile browsers (Chrome, Safari, Edge) on
  iOS and Android; desktop PWA installation is desirable but not mandatory.
- Existing CI infrastructure can accommodate additional E2E test jobs
  parameterized by viewport class.
- Touch target sizing follows established accessibility standards (minimum
  44x44px interactive area).
