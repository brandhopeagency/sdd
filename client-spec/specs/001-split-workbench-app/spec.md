# Feature Specification: Split Frontend Into Client and Workbench Applications

**Feature Branch**: `001-split-workbench-app`  
**Created**: 2026-02-21  
**Status**: Complete — 3 legacy cross-domain redirect tasks (T049–T051) unverified
**Jira Epic**: MTB-230
**Input**: User description: "the frontend repositories need to be split into client frontend and workbench frontend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Chat and Workbench as Separate Focused Applications (Priority: P1)

As a signed-in user, I can access the chat experience and the workbench experience as two separate applications, each with its own navigation, controls, and entry point, so that each workflow is focused and free of unrelated features.

**Why this priority**: This is the foundational change that enables all follow-on improvements. Without the split, chat and workbench remain entangled in a single application, creating unnecessary complexity for both end users and development teams.

**Independent Test**: Sign in to the chat application and confirm only chat-related navigation and controls are visible. Sign in to the workbench application and confirm only workbench-related navigation and controls are visible. Verify both load independently without requiring the other.

**Acceptance Scenarios**:

1. **Given** a signed-in user navigates to the chat application URL, **When** the application loads, **Then** only chat-related navigation, controls, and content areas are displayed.
2. **Given** a signed-in user navigates to the workbench application URL, **When** the application loads, **Then** only workbench-related navigation, controls, and content areas are displayed.
3. **Given** a user deep-links directly to a specific chat route, **When** the page loads, **Then** the chat application opens at the correct location without workbench UI elements.
4. **Given** a user deep-links directly to a specific workbench route, **When** the page loads, **Then** the workbench application opens at the correct location without chat UI elements.
5. **Given** a deployment of the chat application, **When** the deployment completes, **Then** the workbench application is unaffected and vice versa.

---

### User Story 2 - Preserve Access Control Across Split Applications (Priority: P2)

As an organization administrator, I can rely on the same role-based access control enforcing which users can access the workbench, so that splitting the applications does not weaken or bypass existing permission boundaries.

**Why this priority**: The split must not create new security gaps. Users who lack workbench permissions must not gain access through the new entry point, and authorized users must retain seamless access.

**Independent Test**: Attempt to access the workbench application with a chat-only user account and confirm access is denied. Access the workbench with an authorized account and confirm full functionality.

**Acceptance Scenarios**:

1. **Given** a user without workbench permissions, **When** they navigate to the workbench application URL, **Then** access is denied with a clear message and a path back to the chat application.
2. **Given** a workbench-authorized user, **When** they sign in to the workbench application, **Then** their identity, roles, and organization context are fully preserved.
3. **Given** a user is signed in to one application, **When** they navigate to the other application they are authorized for, **Then** they do not need to re-authenticate within the same browser session.
4. **Given** a user signs out from one application, **When** they navigate to the other, **Then** they are also signed out and must re-authenticate.

---

### User Story 3 - Navigate Existing Bookmarks and Links Without Disruption (Priority: P3)

As a returning user, I can continue using existing bookmarks and shared links that were created before the split, so that the architectural change does not break my established workflows.

**Why this priority**: Transition reliability prevents user confusion, reduces support burden, and maintains trust during the migration period.

**Independent Test**: Collect a representative set of existing bookmarked URLs for both chat and workbench routes. Open each one and confirm the user arrives at the correct application and content, either directly or via redirect.

**Acceptance Scenarios**:

1. **Given** a user opens a legacy URL that now belongs to the workbench application, **When** the request resolves, **Then** the user is redirected to the corresponding workbench application route.
2. **Given** a user opens a legacy URL that remains in the chat application, **When** the request resolves, **Then** the chat application loads normally at the expected route.
3. **Given** a user opens an invalid or removed route, **When** the page loads, **Then** a helpful error page guides the user to the correct application.

---

### Edge Cases

- A user has a valid account but permission for only one of the two applications.
- A user opens a stale bookmark or shared link created before the split that no longer maps to either application.
- A session expires while the user has tabs open in both applications.
- A user attempts direct URL access to restricted workbench paths without the required permissions.
- Concurrent browser tabs are open in both applications and one tab signs out.
- A search engine has indexed legacy routes that now redirect to different application domains.
- A user on a mobile device with only the chat PWA installed attempts to open a workbench link.
- One application is temporarily unavailable due to a deployment while the other remains operational.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide separate, independently accessible entry points for the chat application and the workbench application.
- **FR-002**: Each application MUST present only the navigation, controls, and content relevant to its experience (chat or workbench).
- **FR-003**: System MUST enforce the existing role-based access control independently for each application, ensuring workbench access requires explicit authorization.
- **FR-004**: System MUST preserve authenticated session context so authorized users are not forced to re-authenticate when moving between applications within the same browser session.
- **FR-005**: System MUST invalidate session context across both applications when a user signs out from either one.
- **FR-006**: System MUST redirect legacy routes to the correct application and route, preserving user intent where possible.
- **FR-007**: System MUST provide clear, actionable error pages when a user navigates to an invalid, unavailable, or unauthorized route in either application.
- **FR-008**: Each application MUST be independently deployable without requiring the other application to be redeployed.
- **FR-009**: System MUST preserve existing localization support (uk, en, ru) across both applications.
- **FR-010**: System MUST preserve existing accessibility compliance (WCAG AA) across both applications, including keyboard navigation and screen reader compatibility.
- **FR-011**: The chat application MUST provide responsive behavior across modern mobile, tablet, and desktop viewports with no critical workflow loss.
- **FR-012**: The workbench application MUST provide responsive behavior across modern tablet and desktop viewports.
- **FR-013**: The chat application MUST remain installable as a PWA where the platform and browser support installation, with appropriate fallback behavior where installation is unsupported.
- **FR-014**: The workbench application MUST serve on a dedicated domain separate from the chat application domain in both production and development environments.
- **FR-015**: System MUST include release verification evidence for split routing behavior, permission boundaries, and critical journey continuity prior to production release.

### Key Entities

- **Application Surface**: A user-facing application (`chat` or `workbench`) with its own entry point, navigation, routing, and domain.
- **Entry Point**: The URL or launcher action that opens a specific application surface.
- **Access Policy**: Rules defining which user roles are authorized to access each application surface.
- **Route Mapping Rule**: A transition rule that maps legacy routes to canonical routes in the correct application surface.
- **Session Context**: The active user identity, roles, and organization scope that must remain valid and synchronized across both application surfaces.
- **Domain Topology**: The environment-specific hostnames for each application surface, covering both production and development environments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of defined critical chat and workbench user journeys complete successfully in release validation after the split.
- **SC-002**: 100% of workbench access attempts by unauthorized users are blocked with clear user-facing guidance.
- **SC-003**: At least 95% of tested legacy bookmarks and shared links resolve to the correct application and route without manual user intervention.
- **SC-004**: Each application can be deployed independently, verified by at least one release cycle where only one application is updated while the other remains unchanged and fully operational.
- **SC-005**: No increase in user-reported navigation confusion incidents related to application switching in the first release cycle after launch, compared to the immediately preceding release baseline using the same support-ticket category.

## Assumptions

- Existing identity management and role assignments remain the source of truth for access decisions across both applications.
- A defined list of critical chat and workbench user journeys exists or will be established for release validation.
- Some legacy routes will remain in circulation during transition and require redirect-based compatibility handling.
- The chat application retains its current production and development domains; the workbench application uses new dedicated domains.
- Shared type definitions continue to be managed through the existing shared types package.
- The split is scoped to the frontend applications; backend API changes required to support the split will be addressed as part of implementation planning.
- Both applications share the same authentication provider and session mechanism.
