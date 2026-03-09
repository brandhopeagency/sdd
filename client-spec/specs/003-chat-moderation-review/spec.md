# Feature Specification: Chat Moderation and Review System

**Feature Branch**: `003-chat-moderation-review`  
**Created**: 2026-02-10  
**Status**: Complete
**Jira Epic**: MTB-196
**Input**: User description: "make sure that Research interface follows the following spec:"

## Target Repositories

This feature is implemented in split repositories only:

- `D:/src/MHG/chat-types` (shared contracts and permissions)
- `D:/src/MHG/chat-backend` (review, escalation, deanonymization APIs/services)
- `D:/src/MHG/chat-frontend` (reviewer and admin UI flows)
- `D:/src/MHG/chat-ui` (end-to-end validation)

No feature implementation is planned for legacy monorepo `chat-client`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review AI Conversations for Safety and Quality (Priority: P1)

As a qualified reviewer, I need to open anonymized chat sessions, rate each AI response, and submit a complete review so unsafe or low-quality responses are identified and acted on quickly.

**Why this priority**: This is the core user value of the system. Without reliable review submission, quality assurance and safety oversight cannot function.

**Independent Test**: Can be fully tested by assigning a reviewer to a pending chat session and validating that all AI responses can be rated, required feedback is enforced for low scores, and the review is accepted as complete.

**Acceptance Scenarios**:

1. **Given** an anonymized session in the pending queue, **When** a reviewer opens it, rates every AI response, and submits, **Then** the system records the review and updates session progress.
2. **Given** a reviewer selects a score at or below the detailed-feedback threshold, **When** they try to submit without criterion feedback, **Then** submission is blocked with a clear requirement message.

---

### User Story 2 - Coordinate Multi-Reviewer Outcomes (Priority: P1)

As a moderation team, we need each session to receive the configured minimum number of independent reviews so final quality decisions are not based on a single opinion.

**Why this priority**: Multi-reviewer coverage is required for consistency, fairness, and confidence in final outcomes.

**Independent Test**: Can be tested by running a session through minimum-review completion, then through a disagreement case that triggers dispute handling and resolution.

**Acceptance Scenarios**:

1. **Given** a session with fewer than the required number of reviews, **When** reviewers submit additional reviews, **Then** the session remains in progress until the minimum is met.
2. **Given** completed reviews exceed the configured disagreement tolerance, **When** the session is evaluated, **Then** the system marks it disputed and routes it for tie-break resolution before final closure.

---

### User Story 3 - Escalate High-Risk Sessions (Priority: P1)

As a reviewer or moderator, I need to flag safety concerns and route urgent cases for rapid response so user harm risk is managed promptly.

**Why this priority**: Risk management is safety-critical and time-sensitive; delayed escalation can cause real-world harm.

**Independent Test**: Can be tested by submitting high and medium severity flags and validating role-based notification and response SLA tracking.

**Acceptance Scenarios**:

1. **Given** a reviewer identifies crisis indicators, **When** they submit a high-severity flag, **Then** moderators and commanders are notified immediately and the case is tracked against the urgent response target.
2. **Given** a medium-severity concern is flagged, **When** it enters escalation review, **Then** it appears in moderation workflows with the standard response timeline.

---

### User Story 4 - Protect Privacy With Controlled Identity Reveal (Priority: P2)

As a reviewer or moderator, I need all sessions to remain anonymized by default and only allow identity reveal through explicit approval for justified high-risk cases.

**Why this priority**: Privacy protection is a foundational requirement for trust, compliance, and ethical operation.

**Independent Test**: Can be tested by confirming default anonymized views and executing approved/denied identity-reveal requests with full audit evidence.

**Acceptance Scenarios**:

1. **Given** a reviewer accesses any session, **When** they view participant data, **Then** only anonymized identifiers are visible by default.
2. **Given** a deanonymization request is submitted with justification, **When** an authorized approver decides, **Then** the system records decision, reason, actor, and access outcome in an immutable audit trail.

---

### Cross-Cutting Acceptance Scenarios (Accessibility and Internationalization)

1. **Given** a reviewer navigates review queue and session screens using keyboard only, **When** they interact with filters, rating controls, and submit actions, **Then** all interactive elements are reachable, operable, and visibly focused.
2. **Given** a screen reader user opens review queue and session views, **When** they traverse primary controls and status badges, **Then** controls expose meaningful labels and status updates are announced.
3. **Given** reviewer locale is set to Ukrainian, English, or Russian, **When** review workflows are opened, **Then** all user-facing static UI text is presented in the selected language.

---

### Edge Cases

- What happens when a review expires before submission due to inactivity or timeout?
- How does the system handle a session with no AI responses eligible for scoring?
- What happens when two reviewers attempt to start the same reserved assignment near expiration?
- How does the system behave when a reviewer loses permission mid-review?
- What happens if a reviewer submits scores with large disagreement after minimum reviews are already met?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present a review queue of anonymized chat sessions with status, risk level, recency, and review completion progress.
- **FR-002**: System MUST allow authorized reviewers to open a session transcript and score each AI response on a standardized 1-10 quality and safety scale.
- **FR-003**: System MUST require criterion-based feedback when a score is at or below the configured detailed-feedback threshold.
- **FR-004**: System MUST prevent review submission until all scorable AI responses in the session are rated.
- **FR-005**: System MUST support configurable minimum and maximum review counts per session and track progress against those limits.
- **FR-006**: System MUST aggregate completed reviews into a session outcome and mark sessions as completed, disputed, or awaiting tie-break according to configured variance rules.
- **FR-007**: System MUST support blinded reviewing so reviewers cannot see other reviewers' individual scores before they submit their own review.
- **FR-008**: System MUST allow reviewers and moderators to submit risk flags with severity, reason, and supporting notes.
- **FR-009**: System MUST route escalations based on severity and track response deadlines for high- and medium-risk cases.
- **FR-010**: System MUST keep user identity anonymized by default in all reviewer-facing workflows.
- **FR-011**: System MUST support role-restricted deanonymization requests and approvals with explicit justification and decision capture.
- **FR-012**: System MUST maintain a complete audit trail of review actions, flagging, escalation handling, and identity-reveal events.
- **FR-013**: System MUST provide reviewers with personal performance metrics and provide expanded team metrics to authorized senior roles.
- **FR-014**: System MUST enforce role-based access controls so each role can only perform actions within approved permissions.
- **FR-015**: System MUST allow administrators to configure review thresholds, escalation timing targets, and queue behavior without changing user workflows.
- **FR-016**: System MUST support assignment balancing so pending sessions are distributed fairly across eligible reviewers.
- **FR-017**: System MUST minimize exposure of personally identifiable information in all reviewer-facing workflows and display anonymized identifiers by default.
- **FR-018**: System MUST enforce retention and deletion behavior for review artifacts as follows: review ratings and criteria feedback retained for 365 days, risk flags and escalation records retained for 730 days, and deanonymization access records retained for 730 days; after retention expiry, records must be deleted or irreversibly anonymized per policy.
- **FR-019**: System MUST log all identity-reveal requests, approvals, denials, and access events with actor, timestamp, and justification.
- **FR-020**: System MUST enforce role-based authorization on all review-domain operations, including queue/session access, score submission, risk flag submission and resolution, deanonymization request and approval actions, reviewer management, and admin configuration updates.

### Key Entities *(include if feature involves data)*

- **Chat Session**: An anonymized conversation unit containing user and AI messages, risk indicators, language, timing, and review lifecycle state.
- **Session Review**: A reviewer's full assessment of one chat session, including per-message scores, completion status, and summary comments.
- **Message Rating**: A score and optional note assigned to a specific AI message within a review.
- **Criterion Feedback**: Structured qualitative feedback tied to a low-scoring message rating across evaluation dimensions such as relevance, empathy, safety, ethics, and clarity.
- **Risk Flag**: A documented safety concern on a session with severity, reason, details, ownership, and resolution status.
- **Deanonymization Request**: A governed request to reveal user identity for justified risk cases, including requester, approver, decision, and access outcome.
- **Reviewer Profile**: Role, qualification state, language eligibility, and workload/performance information used for access and assignment logic.
- **Audit Event**: Immutable record of sensitive system actions with actor, action type, target, timestamp, and outcome.

### Assumptions

- Reviews are performed by trained, qualified professionals with active authorization.
- A complete review requires scoring all AI responses in a selected session.
- High-severity safety concerns require materially faster response than standard moderation work.
- Users prioritize understandable explanations of review status and outcomes over technical detail.
- The system may evolve thresholds and workflows through admin configuration without changing core reviewer goals.
- Retention and deletion windows are governed by platform privacy policy and apply to review metadata, flags, and deanonymization records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of review-eligible chat sessions receive at least the configured minimum number of completed reviews.
- **SC-002**: At least 90% of sessions entering the review queue receive required minimum reviews within 24 hours.
- **SC-003**: 100% of message scores at or below the detailed-feedback threshold include required criterion feedback before review submission.
- **SC-004**: At least 95% of high-severity flags receive first moderation acknowledgment within 2 hours.
- **SC-005**: At least 90% of medium-severity flags receive first moderation acknowledgment within 24 hours.
- **SC-006**: 100% of identity-reveal actions are linked to a formal request, approval decision, and complete audit record.
- **SC-007**: Reviewer agreement quality is maintained so score spread across completed reviews stays within configured tolerance for at least 85% of sessions.
- **SC-008**: At least 90% of reviewers report they can complete a standard session review without external assistance after onboarding.
- **SC-009**: 100% of review-domain records older than their retention window are automatically deleted or irreversibly anonymized within 24 hours of expiry.
