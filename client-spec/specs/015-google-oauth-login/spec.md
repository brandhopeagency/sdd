# Feature Specification: Google OAuth Login with OTP Control

**Feature Branch**: `015-google-oauth-login`  
**Created**: 2026-02-23  
**Status**: Complete  
**Jira Epic**: [MTB-376](https://mentalhelpglobal.atlassian.net/browse/MTB-376)  
**Input**: User description: "allow OAuth using google workspace identity along with existing OTP in both chat and workbench. Have a workbench setting to disable the OTP login for workbench"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Google OAuth Login for Chat and Workbench (Priority: P1)

A user visits the chat or workbench login page and sees a "Sign in with Google" button alongside the existing email/OTP login form. The user clicks the Google button, completes the standard Google sign-in flow (account selection, consent), and is authenticated. If the user's Google email matches an existing account, they are logged into that account. If no account exists, a new account is created following the existing approval workflow.

**Why this priority**: This is the core value delivery — users gain an alternative, faster login method that eliminates the need to wait for OTP codes via email. Google Workspace users can leverage their organizational identity for seamless access.

**Independent Test**: Can be fully tested by navigating to the login page, clicking "Sign in with Google", completing the Google OAuth flow, and confirming the user is authenticated and lands on the appropriate post-login page.

**Acceptance Scenarios**:

1. **Given** a user is on the chat login page, **When** they click "Sign in with Google" and complete the Google OAuth flow with a valid Google account, **Then** they are authenticated and redirected to the chat interface.
2. **Given** a user is on the workbench login page, **When** they click "Sign in with Google" and complete the Google OAuth flow with a valid Google account that has workbench access, **Then** they are authenticated and redirected to the workbench dashboard.
3. **Given** a user authenticates via Google OAuth with an email that matches an existing account, **When** the authentication completes, **Then** the system links the Google identity to the existing account and preserves all existing roles, permissions, and data.
4. **Given** a user authenticates via Google OAuth with an email that does not match any existing account, **When** the authentication completes, **Then** a new account is created following the existing approval workflow (pending/approval status).

---

### User Story 2 - Workbench Setting to Disable OTP Login (Priority: P2)

An Owner-level administrator accesses the workbench settings page and finds a toggle to enable or disable OTP-based login for the workbench application. When OTP login is disabled, the workbench login page shows only the Google OAuth option. This setting does not affect the chat application, which always supports both login methods.

**Why this priority**: This provides organizational control over authentication methods. Organizations using Google Workspace may prefer to enforce Google-only login for the workbench to align with their identity management policies. However, the core OAuth functionality (US1) must work first.

**Independent Test**: Can be tested by logging into the workbench as an Owner, navigating to Settings, toggling the "Disable OTP Login" setting, and confirming that the workbench login page subsequently shows only Google OAuth.

**Acceptance Scenarios**:

1. **Given** an Owner is on the workbench settings page, **When** they view the authentication settings, **Then** they see a toggle to disable OTP login for the workbench.
2. **Given** an Owner has disabled OTP login for the workbench, **When** a user visits the workbench login page, **Then** only the "Sign in with Google" option is displayed and the email/OTP form is hidden.
3. **Given** an Owner has re-enabled OTP login for the workbench, **When** a user visits the workbench login page, **Then** both the "Sign in with Google" button and the email/OTP form are displayed.
4. **Given** OTP login is disabled for the workbench, **When** a user visits the chat login page, **Then** both login methods (Google OAuth and OTP) remain available.

---

### User Story 3 - Existing OTP Login Remains Functional (Priority: P1)

The existing OTP-based login flow continues to work exactly as before for both chat and workbench (unless OTP is explicitly disabled for workbench via the admin setting). Users who prefer or need to use email-based OTP can continue doing so without any changes to their experience.

**Why this priority**: Equal to P1 because breaking existing authentication would lock out all current users. The Google OAuth feature must be purely additive.

**Independent Test**: Can be tested by logging in via the existing OTP flow on both chat and workbench, confirming the experience is unchanged from the current behavior.

**Acceptance Scenarios**:

1. **Given** a user is on the chat login page, **When** they enter their email and request an OTP, **Then** the OTP is delivered via the existing provider (console in dev, email in production) and login completes as before.
2. **Given** a user is on the workbench login page and OTP login is enabled, **When** they enter their email and request an OTP, **Then** the OTP is delivered and login completes as before.
3. **Given** Google OAuth is configured, **When** a user chooses to log in via OTP instead, **Then** the OTP flow completes without any interference from the OAuth configuration.

---

### User Story 4 - Login Page Presents Both Options Clearly (Priority: P2)

The login page for both chat and workbench presents both authentication options (Google OAuth and email OTP) in a clear, non-confusing layout. The Google sign-in button follows Google's branding guidelines. The two options are visually separated with a clear divider.

**Why this priority**: Important for user experience but not critical for functionality. The login methods work regardless of visual presentation, but a confusing layout would increase support burden.

**Independent Test**: Can be tested by viewing the login page on mobile, tablet, and desktop viewports and confirming both options are visible, clearly labeled, and accessible.

**Acceptance Scenarios**:

1. **Given** a user visits the login page, **When** the page renders, **Then** both "Sign in with Google" and the email/OTP form are visible without scrolling on desktop viewports.
2. **Given** a user is on a mobile device, **When** they view the login page, **Then** both authentication options are accessible and properly laid out for the smaller viewport.
3. **Given** OTP login is disabled for the workbench, **When** a user views the workbench login page, **Then** only the Google sign-in option is displayed with no confusing empty space or broken layout.

---

### Edge Cases

- What happens if a user's Google account is suspended or deactivated by their Google Workspace admin? The system rejects the authentication attempt and displays a user-friendly error message.
- What happens if the Google OAuth service is temporarily unavailable? The system displays a clear error and the OTP option (if enabled) remains functional as a fallback.
- What happens if a user authenticates via Google with one email and previously logged in via OTP with a different email? These are treated as separate accounts — no automatic linking across different email addresses.
- What happens if an Owner disables OTP for the workbench while users have active OTP-based sessions? Existing sessions remain valid until their tokens expire naturally. Only new login attempts are affected by the setting change.
- What happens if all Owners disable OTP and then lose access to their Google accounts? A backend environment variable override exists to force-enable OTP, ensuring recovery is always possible.
- How does the login flow behave across mobile/tablet/desktop breakpoints? Both login options are responsive and accessible across all standard viewports. The Google sign-in button follows Google's responsive guidelines.
- For PWA-installed chat clients: the Google OAuth flow works within the PWA window, opening the Google consent screen in a popup or in-app browser as appropriate for the platform.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support Google OAuth 2.0 as an authentication method for both the chat and workbench applications.
- **FR-002**: System MUST continue to support email-based OTP as an authentication method for both applications (subject to the workbench OTP disable setting).
- **FR-003**: The login page for both chat and workbench MUST display the Google sign-in option alongside the existing OTP form when both methods are enabled.
- **FR-004**: When a user authenticates via Google OAuth, the system MUST match the Google account's email against existing user accounts. If a match is found, the user MUST be logged into the existing account with all existing roles and permissions intact.
- **FR-005**: When a user authenticates via Google OAuth with an email that does not match any existing account, the system MUST create a new account following the existing account approval workflow.
- **FR-006**: The system MUST issue the same session tokens (access token, refresh token) regardless of whether the user authenticated via Google OAuth or OTP.
- **FR-007**: The workbench MUST provide an Owner-accessible setting to disable OTP-based login for the workbench application.
- **FR-008**: When OTP login is disabled for the workbench, the workbench login page MUST hide the email/OTP form and show only the Google sign-in option.
- **FR-009**: The workbench OTP disable setting MUST NOT affect the chat application — chat MUST always offer both login methods.
- **FR-010**: Existing authenticated sessions MUST remain valid when the OTP disable setting is changed — only new login attempts are affected.
- **FR-011**: The Google sign-in button MUST follow Google's official branding and design guidelines.
- **FR-012**: The system MUST handle Google OAuth errors gracefully, displaying user-friendly error messages when authentication fails.
- **FR-013**: The login page MUST provide responsive behavior across modern mobile, tablet, and desktop viewports.
- **FR-014**: For the PWA-installed chat client, the Google OAuth flow MUST function correctly, using an appropriate mechanism (popup or in-app browser) for the consent screen.
- **FR-015**: The system MUST log authentication events (login method used, success/failure) for security auditing purposes.

### Key Entities

- **Authentication Method**: Represents a supported login mechanism (Google OAuth, Email OTP). Has properties: type, enabled status, and per-application availability.
- **OAuth Identity**: Links a user account to a Google identity. Contains the Google account email and unique Google user identifier. A user may have both an OTP-verified email and a linked Google identity.
- **Workbench Auth Settings**: Configuration record storing the OTP-enabled/disabled state for the workbench. Managed by Owner-role users. Affects the workbench login page presentation and accepted authentication methods.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete login via Google OAuth in under 15 seconds (from clicking the button to reaching the authenticated page), matching or exceeding the speed of the existing OTP flow.
- **SC-002**: 100% of existing OTP-based logins continue to function without changes when Google OAuth is also available.
- **SC-003**: When OTP is disabled for the workbench, 100% of workbench login attempts use Google OAuth — no OTP bypass is possible through the login interface.
- **SC-004**: The workbench auth setting change takes effect immediately — within 5 seconds of saving, the login page reflects the new configuration.
- **SC-005**: Account linking by email is 100% accurate — Google OAuth logins with emails matching existing accounts always resolve to the correct account with all existing permissions intact.
- **SC-006**: The login page is fully functional and properly laid out across mobile (360px+), tablet (768px+), and desktop (1024px+) viewports.

## Assumptions

- Google OAuth 2.0 client credentials (client ID, client secret) will be provisioned and stored in Google Secret Manager, following the same pattern as existing Gmail OAuth credentials for email delivery.
- The Google Workspace identity requirement means users authenticate with any Google account (personal or Workspace-managed). The existing approval workflow provides access control regardless of account type. Domain restriction can be added as a future enhancement.
- Account matching between OTP and Google OAuth is based on email address — if a user's Google account email matches an existing OTP-registered account, they are the same user.
- The workbench settings page and API already support admin configuration (established in spec 002 for review settings). The OTP disable toggle follows the same pattern.
- Dev environment behavior: Google OAuth will use a test/dev OAuth client. If Google OAuth credentials are not configured in dev, the system falls back to showing only the OTP option.
- The session token format and lifecycle (JWT access token, refresh token as HTTP-only cookie) remain unchanged — Google OAuth is an alternative authentication method, not a replacement for the token strategy.

## Scope Boundaries

**In scope**:
- Google OAuth 2.0 login flow for chat and workbench
- Login page UI updates showing both authentication options
- Account linking by email for existing users
- New account creation via Google OAuth through existing approval workflow
- Workbench admin setting to disable OTP login
- Responsive login page layout for mobile/tablet/desktop
- PWA compatibility for Google OAuth flow
- Security audit logging for authentication events

**Out of scope**:
- Removing or replacing the OTP authentication method entirely
- Google Workspace domain restriction or allowlisting (can be added as a future enhancement)
- Multi-factor authentication (MFA) combining Google OAuth with OTP
- Social login providers other than Google (e.g., Microsoft, Apple)
- Changes to the existing session token strategy or lifecycle
- Google Workspace admin console integration or SCIM provisioning
- Changes to existing user roles, permissions, or approval workflow
