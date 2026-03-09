# Feature Specification: Baseline Feature Documentation

**Feature Branch**: `005-baseline-features`
**Created**: 2026-02-08
**Status**: Complete — retroactive baseline reference document
**Jira Epic**: MTB-198
**Input**: Retroactive baseline spec documenting all existing implemented capabilities as a reference point for future change tracking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - OTP Authentication & Account Lifecycle (Priority: P1)

Users authenticate via a passwordless one-time-password flow. A user enters their email, receives a 6-digit OTP code (valid for 5 minutes, max 3 attempts), and is authenticated upon successful verification. New users are auto-created on first OTP verification. Accounts progress through statuses: pending → approval → active (or disapproved). Owners and moderators can block/unblock accounts.

**Why this priority**: Authentication is the gateway to all functionality. Every other feature depends on a working auth flow.

**Independent Test**: Can be tested by visiting the welcome screen, entering an email, verifying the OTP, and confirming the user is redirected to the chat interface with a valid session.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they enter their email and submit, **Then** a 6-digit OTP is sent and the UI transitions to the verification step.
2. **Given** a valid OTP, **When** the user enters it within 5 minutes, **Then** they are authenticated, a JWT access token (15 min) and refresh token (7 days) are issued, and they are redirected to the chat.
3. **Given** an expired or invalid OTP, **When** the user enters it, **Then** a clear error message is shown with remaining attempts.
4. **Given** a first-time user, **When** OTP verification succeeds, **Then** a new user account is auto-created with "pending" or "approval" status depending on system settings.
5. **Given** a blocked account, **When** the user tries to authenticate, **Then** access is denied with an appropriate message.

---

### User Story 2 - Guest Access & Session Binding (Priority: P1)

Users can start chatting without creating an account. The welcome screen offers a "Start Conversation" button for guest entry. Guests see a "Guest" label with a "Register" link in the header. When a guest registers via OTP, their existing chat session is bound to the new account and chat history is preserved.

**Why this priority**: Guest access removes the friction barrier for users in distress who need immediate support.

**Independent Test**: Can be tested by clicking "Start Conversation" as a guest, chatting, then registering via the popup OTP form and confirming session continuity.

**Acceptance Scenarios**:

1. **Given** the welcome screen, **When** a user clicks "Start Conversation", **Then** they enter the chat interface as a guest with an ephemeral guest ID.
2. **Given** a guest session, **When** the guest clicks "Register" and completes OTP, **Then** the session is bound to the new user account and all messages are preserved.
3. **Given** guest mode is disabled in settings, **When** a user visits the welcome screen, **Then** the "Start Conversation" button is hidden and only "Sign In" is available.

---

### User Story 3 - Chat Interface & AI Conversation (Priority: P1)

Authenticated and guest users interact with a Dialogflow CX-powered AI assistant through a chat interface. Messages support markdown rendering. Each AI response includes optional technical details (intent, confidence, response time) visible to QA+ roles. Users can provide feedback (thumbs up/down) on each AI message. Sessions can be ended and new ones started.

**Why this priority**: The chat interface is the core product — it's what users come to use.

**Independent Test**: Can be tested by starting a session, sending messages, receiving AI responses, toggling technical details, submitting feedback, and ending the session.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they send a message, **Then** the message is forwarded to Dialogflow CX and the AI response is displayed with markdown rendering.
2. **Given** an AI response, **When** a QA+ role user clicks the gear icon, **Then** technical details (intent name, confidence score, response time, parameters) are shown inline.
3. **Given** an AI response, **When** the user clicks thumbs up/down, **Then** feedback is persisted to the backend and the UI reflects the selected state.
4. **Given** an active session, **When** the user clicks "End Chat", **Then** the session is terminated and the conversation is archived to cloud storage.
5. **Given** a completed session, **When** the user clicks "New Session", **Then** a fresh session is started with a new session ID.

---

### User Story 4 - Agent Memory System (Priority: P2)

The system maintains persistent long-term memory across chat sessions. When a session ends, the system aggregates key facts, preferences, and context from the conversation using an LLM. This memory is injected into future sessions to provide continuity.

**Why this priority**: Memory makes the AI feel personal and reduces repetitive conversations, but the core chat works without it.

**Independent Test**: Can be tested by having a conversation mentioning specific facts, ending the session, starting a new session, and verifying the AI references the previously mentioned facts.

**Acceptance Scenarios**:

1. **Given** a completed chat session, **When** the session ends, **Then** the system generates a memory summary using the LLM and stores it in cloud storage.
2. **Given** a user with existing memory, **When** they start a new session, **Then** the memory is injected into the conversation context and the AI's first message reflects awareness of the user's history.

---

### User Story 5 - Workbench Dashboard & Navigation (Priority: P2)

Authorized users (Researcher, Moderator, Group Admin, Owner) access a full-screen administrative workbench via the "Workbench" button in the chat header. The workbench has a persistent sidebar with role-based navigation sections: Dashboard, Users, Groups, Research, Approvals, Privacy, Settings, and Review.

**Why this priority**: The workbench is the administrative backbone. All management features are accessed through it.

**Independent Test**: Can be tested by logging in as a user with workbench access, clicking the Workbench button, and verifying the sidebar shows the correct sections for the user's role.

**Acceptance Scenarios**:

1. **Given** a user with `WORKBENCH_ACCESS` permission, **When** they click the Workbench button, **Then** the full-screen workbench layout is displayed with a sidebar and content area.
2. **Given** different user roles, **When** they access the workbench, **Then** the sidebar shows only the sections their permissions allow.
3. **Given** the workbench, **When** the user clicks a sidebar item, **Then** the main content area loads the corresponding view.

---

### User Story 6 - User Management (Priority: P2)

Moderators and Owners manage user accounts through the workbench. They can search, filter, and sort the user list. Individual user profiles show account details and enable administrative actions: block/unblock, change role (Owner only), approve/disapprove, and GDPR operations (data export, data erasure).

**Why this priority**: User management is essential for moderation and compliance but depends on the workbench.

**Independent Test**: Can be tested by searching for a user, opening their profile, performing an action (e.g., block), and verifying the change.

**Acceptance Scenarios**:

1. **Given** the user list view, **When** a moderator searches by name or email, **Then** the list filters with debounced input showing matching results.
2. **Given** a user profile, **When** an Owner clicks "Block", **Then** the user's status changes to blocked and they can no longer authenticate.
3. **Given** a user profile, **When** an Owner clicks "Download Archive", **Then** a GDPR data export is initiated and the user is notified when ready.
4. **Given** a user profile, **When** an Owner clicks "Execute Erasure", **Then** after confirmation, PII is anonymized, sessions are dissociated, and credentials are deleted.

---

### User Story 7 - Research & Moderation (Three-Column View) (Priority: P2)

Researchers and Moderators access a global chat history list showing all sessions. Clicking a session opens the three-column moderation view: transcript (read-only), golden reference (editable by Researcher), and annotation panel (quality ratings, notes, tags). Sessions can be tagged at session-level and turn-level. Sessions are marked as "Moderated" when review is complete.

**Why this priority**: Core research and quality improvement feature, but operational rather than user-facing.

**Independent Test**: Can be tested by opening a session in the moderation view, adding annotations, editing the golden reference, adding tags, and marking the session as moderated.

**Acceptance Scenarios**:

1. **Given** the chat history list, **When** a researcher clicks a session, **Then** the three-column moderation view opens with synchronized scrolling.
2. **Given** the annotation panel, **When** a researcher rates a session (1-5) and adds notes, **Then** the annotation is saved without page reload.
3. **Given** the tagging system, **When** a user adds a tag, **Then** autocomplete suggests from the predefined tag library and custom tags are allowed.

---

### User Story 8 - Group Management & Group-Scoped Administration (Priority: P2)

Owners and Moderators create and manage groups. Groups have members with roles (member, admin). Group Admins access a group-scoped workbench showing their group's dashboard, users, and sessions (anonymized). Users join groups via invite codes or membership requests that require approval.

**Why this priority**: Groups enable multi-tenant administration but aren't needed for basic platform operation.

**Independent Test**: Can be tested by creating a group, generating an invite code, having a user join via the code, and verifying the Group Admin sees the member in the group dashboard.

**Acceptance Scenarios**:

1. **Given** an Owner, **When** they create a group with a name, **Then** the group appears in the group list and can be configured.
2. **Given** a group, **When** an invite code is generated, **Then** users can enter the code during registration to request group membership.
3. **Given** a Group Admin, **When** they access the group workbench, **Then** they see group dashboard, group users, and anonymized group sessions.
4. **Given** a membership request, **When** the Group Admin approves it, **Then** the user is added to the group as a member.

---

### User Story 9 - Approvals System (Priority: P2)

New user registrations and group membership requests flow through an approvals queue. Moderators and Owners see pending approvals in the workbench. They can approve (with optional comment) or disapprove (with required comment). Disapproved users enter a cooloff period before they can re-register.

**Why this priority**: Gatekeeping for quality and safety, but depends on auth and groups.

**Independent Test**: Can be tested by registering a new user, checking the approvals queue, approving the user, and verifying their status changes to active.

**Acceptance Scenarios**:

1. **Given** a new user registration with approval required, **When** the user completes OTP, **Then** their account enters "approval" status and appears in the approvals queue.
2. **Given** a pending approval, **When** a moderator approves it, **Then** the user's status changes to "active" and they can access the platform.
3. **Given** a pending approval, **When** a moderator disapproves it with a comment, **Then** the user enters a cooloff period.

---

### User Story 10 - Privacy & GDPR Compliance (Priority: P1)

Owners control PII visibility through a global masking toggle in the workbench header. When PII masking is enabled, names, emails, IDs, and phone numbers are masked using standard formats. Data portability (JSON/CSV export) and right to erasure (irreversible anonymization) are available through user profiles. All privacy operations are audit-logged.

**Why this priority**: Legal compliance requirement — GDPR is non-negotiable for a mental health application handling sensitive data.

**Independent Test**: Can be tested by toggling PII masking and verifying names/emails are masked, requesting a data export and downloading it, and performing an erasure and confirming PII is removed.

**Acceptance Scenarios**:

1. **Given** PII masking is enabled, **When** a user views the workbench, **Then** all names, emails, and IDs are displayed in masked format.
2. **Given** a user profile, **When** an Owner requests a data export, **Then** a JSON/CSV archive is generated asynchronously and a download link is provided (expires in 24 hours).
3. **Given** a user profile, **When** an Owner executes erasure, **Then** PII is replaced with anonymized placeholders, sessions are dissociated, and an audit entry is created.

---

### User Story 11 - Internationalization (Priority: P2)

The application supports three languages: Ukrainian (default), English, and Russian. A language selector appears on the welcome screen and in settings. The user's preference is persisted in localStorage. All user-visible text, dates, and numbers are locale-aware.

**Why this priority**: Core product requirement for the Ukrainian user base, but the app functions in any single language.

**Independent Test**: Can be tested by switching languages on the welcome screen and verifying all UI text changes, then navigating through the app confirming consistent translation.

**Acceptance Scenarios**:

1. **Given** the welcome screen, **When** a user selects a language, **Then** all UI text switches to the selected language immediately.
2. **Given** a saved language preference, **When** the user returns to the app, **Then** the app loads in their previously selected language.
3. **Given** a date or number, **When** displayed in the UI, **Then** it is formatted according to the active locale.

---

### Edge Cases

- What happens when a refresh token expires? The user is redirected to login with a return URL to resume where they left off.
- What happens when Dialogflow CX is unreachable? The chat displays a user-friendly error and offers a retry option.
- What happens when cloud storage is unavailable for session archiving? The session data is retained in the database and archiving is retried.
- What happens when a user with active sessions is blocked? Active sessions are terminated and the user is logged out.
- What happens when an erasure is requested for a user with active group memberships? Memberships are removed as part of the erasure process.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**
- **FR-001**: System MUST support passwordless OTP authentication with 6-digit codes, 5-minute expiry, and 3 max attempts.
- **FR-002**: System MUST auto-create user accounts on first successful OTP verification.
- **FR-003**: System MUST support guest access allowing chat without authentication.
- **FR-004**: System MUST bind guest sessions to user accounts upon registration.
- **FR-005**: System MUST issue JWT access tokens (15 min) and refresh tokens (7 days) with rotation.

**Chat**
- **FR-006**: System MUST integrate with Dialogflow CX for AI conversation.
- **FR-007**: System MUST render AI responses with full markdown support (headings, lists, code blocks, links).
- **FR-008**: System MUST display per-message technical details (intent, confidence, response time) for QA+ roles.
- **FR-009**: System MUST support message feedback (thumbs up/down with optional detailed comments).
- **FR-010**: System MUST archive completed sessions to cloud storage.
- **FR-011**: System MUST maintain persistent agent memory across sessions using LLM-based summarization.

**Workbench**
- **FR-012**: System MUST provide a full-screen administrative workbench with role-based sidebar navigation.
- **FR-013**: System MUST display a dashboard with role-appropriate statistics.
- **FR-014**: System MUST provide user management with search, filter, sort, pagination, and administrative actions.
- **FR-015**: System MUST provide a three-column moderation view (transcript, golden reference, annotations).
- **FR-016**: System MUST support session-level and turn-level tagging with autocomplete.

**Groups**
- **FR-017**: System MUST support group creation, archiving, member management, and invite codes.
- **FR-018**: System MUST provide group-scoped workbench views (dashboard, users, anonymized sessions).
- **FR-019**: System MUST support group membership request and approval workflow.

**Privacy & GDPR**
- **FR-020**: System MUST provide a global PII masking toggle (Owner only) with standard masking formats.
- **FR-021**: System MUST support data portability via JSON/CSV export with 24-hour download links.
- **FR-022**: System MUST support right to erasure with irreversible anonymization.
- **FR-023**: System MUST audit-log all privacy operations.

**Approvals**
- **FR-024**: System MUST provide an approvals queue for user registrations and group memberships.
- **FR-025**: System MUST enforce disapproval cooloff periods.

**Internationalization**
- **FR-026**: System MUST support Ukrainian (default), English, and Russian languages.
- **FR-027**: System MUST persist language preference and provide locale-aware formatting.

**Security**
- **FR-028**: System MUST enforce RBAC with 6 roles (user, qa_specialist, researcher, moderator, group_admin, owner).
- **FR-029**: System MUST protect all routes with authentication and permission checks (frontend guards + backend middleware).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 29 functional requirements are implemented and verified in both monorepo and split repositories — 100% parity.
- **SC-002**: All authentication flows (OTP, guest, registration, session binding) complete successfully without errors.
- **SC-003**: Chat conversations function with AI responses rendered correctly and feedback persisted.
- **SC-004**: Workbench is accessible to authorized roles with all sections functioning (users, research, groups, approvals, privacy, settings).
- **SC-005**: GDPR operations (masking, export, erasure) produce correct results with complete audit trails.
- **SC-006**: All three languages display correctly with no untranslated strings visible in the UI.
- **SC-007**: Code parity between monorepo and split repos is maintained at 100% for routes, services, and frontend features.

## Assumptions

- This spec documents existing implemented functionality as a baseline reference point.
- No new development is required — this spec captures what is already built and deployed.
- Future changes to any of these features should reference this spec and create incremental feature specs.
- The review system (spec 002) and infrastructure setup (spec 003) are documented separately and excluded from this baseline.
