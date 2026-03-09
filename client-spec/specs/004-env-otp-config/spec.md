# Feature Specification: Environment-Aware OTP Provider Configuration

**Feature Branch**: `004-env-otp-config`
**Created**: 2026-02-08
**Status**: Complete — implemented directly without task breakdown
**Jira Epic**: MTB-197
**Input**: User description: "let's make sure that in dev environment the console otp is being used and in production - email"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dev Environment Uses Console OTP (Priority: P1)

When a user attempts to log in on the dev environment, the system uses the console OTP provider instead of sending a real email. The OTP code is logged to the server console and returned in the API response so developers and testers can authenticate without access to a real email inbox.

**Why this priority**: This is the core requirement. Without console OTP in dev, developers cannot test login flows because the Gmail OAuth credentials are either absent or intentionally omitted in non-production environments.

**Independent Test**: Can be fully tested by attempting a login on the dev-deployed application and confirming that no email is sent, the OTP code appears in Cloud Run logs, and the API response includes the code for client-side display.

**Acceptance Scenarios**:

1. **Given** the application is running in the dev environment, **When** a user requests an OTP for login, **Then** the system uses the console provider, logs the code to the server output, and returns the code in the API response body.
2. **Given** the application is running in the dev environment, **When** the console OTP is returned in the API response, **Then** the frontend automatically populates or displays the code so the user can proceed without manual lookup.
3. **Given** the application is running in the dev environment, **When** a developer inspects the server logs after an OTP request, **Then** the OTP code and recipient email are visible in a clearly formatted log entry.

---

### User Story 2 - Production Environment Uses Email OTP (Priority: P1)

When a user attempts to log in on the production environment, the system sends the OTP code via email using the Gmail provider. The OTP code is never exposed in the API response or server logs in a way that would compromise security.

**Why this priority**: Equal priority to US1 — production must always use secure email delivery. Exposing OTP codes in responses or logs in production would be a security vulnerability.

**Independent Test**: Can be fully tested by attempting a login on the production-deployed application and confirming that an email is received, the OTP code is not present in the API response body, and the code is not logged in plain text to production server output.

**Acceptance Scenarios**:

1. **Given** the application is running in the production environment, **When** a user requests an OTP for login, **Then** the system sends the code via email to the user's address using the Gmail provider.
2. **Given** the application is running in the production environment, **When** the OTP is sent, **Then** the API response does not include the OTP code.
3. **Given** the application is running in the production environment, **When** the OTP is sent, **Then** the server logs record that an OTP was sent but do not include the actual code in plain text.

---

### User Story 3 - CI/CD Enforces Correct Provider Per Environment (Priority: P2)

The deployment pipeline automatically sets the correct OTP email provider for each environment without manual intervention. Dev deployments always use "console" and production deployments always use "gmail".

**Why this priority**: Automation prevents human error. Without this, a misconfigured deploy could expose OTP codes in production or block logins in dev.

**Independent Test**: Can be verified by inspecting the CI/CD workflow configuration and confirming that environment-specific variables are set correctly, then triggering a deploy to each environment and validating the provider in use.

**Acceptance Scenarios**:

1. **Given** a deploy is triggered to the dev environment, **When** the CI/CD pipeline runs, **Then** the `EMAIL_PROVIDER` configuration is set to "console".
2. **Given** a deploy is triggered to the production environment, **When** the CI/CD pipeline runs, **Then** the `EMAIL_PROVIDER` configuration is set to "gmail".
3. **Given** no manual override is applied, **When** comparing dev and production deployments, **Then** each environment uses its designated provider without any shared or incorrect configuration.

---

### User Story 4 - Frontend Handles Console OTP Auto-Fill (Priority: P3)

When the backend returns the OTP code in the API response (dev environment only), the frontend detects it and auto-fills the OTP input field, streamlining the developer login experience.

**Why this priority**: Quality-of-life improvement for developers. Login works without this (developers can copy from logs), but auto-fill significantly improves the dev experience.

**Independent Test**: Can be tested by logging in on the dev environment and confirming the OTP field is automatically populated after requesting a code.

**Acceptance Scenarios**:

1. **Given** the user is on the dev frontend and has requested an OTP, **When** the API response includes the OTP code, **Then** the OTP input field is auto-filled with the received code.
2. **Given** the user is on the production frontend and has requested an OTP, **When** the API response does not include the OTP code, **Then** the OTP input field remains empty and the user must enter the code manually from their email.

---

### Edge Cases

- What happens if `EMAIL_PROVIDER` is not set at all? The system should default to "console" to avoid blocking access, matching the existing fallback behavior.
- What happens if the Gmail OAuth credentials are invalid in production? The system should return a user-friendly error indicating the email could not be sent, without exposing internal details.
- What happens if a developer manually overrides `EMAIL_PROVIDER` to "gmail" in dev? The system should respect the override but the CI/CD pipeline should always reset it on the next deploy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use the "console" email provider when the environment is configured as dev.
- **FR-002**: The system MUST use the "gmail" email provider when the environment is configured as production.
- **FR-003**: The console provider MUST log the OTP code and recipient email to the server output in a clearly formatted entry.
- **FR-004**: The console provider MUST return the OTP code in the API response body so the frontend can display or auto-fill it.
- **FR-005**: The gmail provider MUST NOT return the OTP code in the API response body.
- **FR-006**: The deployment pipeline MUST set `EMAIL_PROVIDER=console` for dev environment deploys.
- **FR-007**: The deployment pipeline MUST set `EMAIL_PROVIDER=gmail` for production environment deploys.
- **FR-008**: The system MUST default to the "console" provider when `EMAIL_PROVIDER` is not explicitly set.
- **FR-009**: The frontend MUST auto-fill the OTP input field when the API response includes the code (dev environment).
- **FR-010**: The frontend MUST NOT display or auto-fill any OTP code when the API response does not include one (production environment).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can log in to the dev environment without needing access to an email inbox — 100% of dev login attempts succeed using the console-provided OTP code.
- **SC-002**: Production users receive OTP codes exclusively via email — 0% of production API responses contain the OTP code.
- **SC-003**: Deployment pipeline correctly configures the email provider for each environment — 100% of automated deploys set the correct `EMAIL_PROVIDER` value without manual intervention.
- **SC-004**: Developer login friction is reduced — OTP auto-fill in dev means login completes in under 10 seconds without copying codes from server logs.
- **SC-005**: No security regression — production server logs never contain plain-text OTP codes in the log output.

## Assumptions

- The existing `console` and `gmail` email providers in the codebase are functional and require no changes to their core logic.
- The `EMAIL_PROVIDER` environment variable is the sole mechanism for selecting the OTP provider at runtime.
- The GitHub Actions deploy workflow (`deploy.yml`) is the authoritative CI/CD pipeline for both dev and production deployments.
- The backend already returns the OTP code in the API response when using the console provider (existing behavior in `otp.service.ts`).
- Both the monorepo (`chat-client`) and split repos (`chat-backend`, `chat-frontend`) need this configuration applied per the Dual-Target Implementation Discipline.

## Scope Boundaries

**In scope**:
- CI/CD pipeline configuration for `EMAIL_PROVIDER` per environment
- GitHub environment variable setup for dev and production
- Frontend OTP auto-fill when code is present in API response
- Verification that existing backend provider selection logic works correctly

**Out of scope**:
- Changes to the console or Gmail provider implementations
- Adding new email providers (e.g., SendGrid, SES)
- OTP flow redesign or new authentication methods
- Email template customization
