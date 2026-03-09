# Feature Specification: Chat Moderation & Review System

**Feature Branch**: `002-chat-moderation-review`
**Created**: 2026-02-08
**Status**: Complete
**Jira Epic**: MTB-133
**Input**: Technical specification for a Chat Moderation & Review System enabling qualified therapists to evaluate AI chatbot responses for quality, safety, and therapeutic appropriateness.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review AI Chat Responses (Priority: P1)

A reviewer (qualified therapist) opens the review queue, selects a pending chat session, reads through the anonymized conversation between a user and the AI chatbot, and rates each AI response on a 1-10 scale. For scores of 7 or below, they provide detailed feedback across five evaluation criteria: relevance, empathy and sensitivity, psychological safety, ethical integrity, and clarity and tone. After rating all AI responses, they submit the completed review.

**Why this priority**: This is the core function of the entire system. Without the ability to review and grade AI responses, no other feature has value. Every other workflow depends on reviews being submitted.

**Independent Test**: Can be fully tested by having a reviewer log in, view a chat session, rate each AI message, optionally provide criteria feedback, and submit the review. Delivers the fundamental quality assurance value.

**Acceptance Scenarios**:

1. **Given** a reviewer with an active account, **When** they access the review queue, **Then** they see a list of chat sessions awaiting review, each showing an anonymized user ID (USER-XXXX format), message count, review progress, and relative timestamp.
2. **Given** a reviewer viewing a chat session, **When** they select a score of 8-10 for an AI response, **Then** the score is recorded and detailed criteria feedback is optional.
3. **Given** a reviewer viewing a chat session, **When** they select a score of 7 or below for an AI response, **Then** the system requires them to provide feedback on at least one of the five evaluation criteria (minimum 10 characters per comment).
4. **Given** a reviewer who has rated all AI responses in a session, **When** they click "Submit Review", **Then** the review is saved with an average score and the session's review count increments.
5. **Given** a reviewer, **When** they attempt to submit a review without rating all AI responses, **Then** the system prevents submission and displays a prompt to rate all responses.

---

### User Story 2 - Multi-Reviewer Validation & Score Aggregation (Priority: P1)

Multiple reviewers independently evaluate the same chat session without seeing each other's scores (blinded review). The system requires a configurable minimum number of reviews (default: 3) before a session is marked complete. If the score variance across reviewers exceeds a configurable threshold (default: 2.0 points), the session is flagged as disputed and a senior reviewer is assigned as a tiebreaker.

**Why this priority**: Multi-reviewer validation is essential for ensuring review quality and reliability. Without it, the system provides no inter-rater reliability guarantees, which is critical for clinical quality assurance.

**Independent Test**: Can be tested by having three reviewers independently review the same session and verifying blinding, score aggregation, and dispute detection work correctly.

**Acceptance Scenarios**:

1. **Given** a session with 0 completed reviews, **When** a reviewer starts a review, **Then** they cannot see any existing scores or reviews from other reviewers.
2. **Given** a session that requires 3 reviews, **When** the 3rd review is submitted and all scores are within the variance threshold, **Then** the session status changes to "Complete" and the final score is the average of all scores.
3. **Given** a session that requires 3 reviews, **When** the 3rd review is submitted and score variance exceeds the threshold, **Then** the session is flagged as "Disputed" and a senior reviewer is assigned as tiebreaker.
4. **Given** a tiebreaker reviewer assigned to a disputed session, **When** they view the session, **Then** they see the score range but not individual reviewer identities or scores.
5. **Given** a reviewer who has submitted their review, **When** they view the session after submission, **Then** they see the aggregate score only (not individual scores) until the session is fully complete.
6. **Given** a completed session (all required reviews submitted, no dispute), **When** any reviewer views the session, **Then** they can see all individual reviews for learning purposes.

---

### User Story 3 - Risk Flagging & Escalation (Priority: P1)

During a review, a reviewer identifies a safety concern (e.g., crisis indicators, self-harm language, inappropriate AI response, ethical concern). They flag the session with a severity level (high, medium, low), a reason category, and supporting details. High-severity flags immediately notify moderators and commanders. Medium-severity flags are added to the moderator queue. Low-severity flags are logged for pattern tracking.

**Why this priority**: Risk flagging is safety-critical. In a mental health context, delayed identification of crisis situations could have severe consequences. This must be available from day one.

**Independent Test**: Can be tested by having a reviewer flag a session with each severity level and verifying the correct escalation workflow triggers.

**Acceptance Scenarios**:

1. **Given** a reviewer viewing a chat session, **When** they click the flag button, **Then** they see a form with severity options, reason categories (crisis indicators, self-harm language, inappropriate AI response, ethical concern, other safety concern), and a details field.
2. **Given** a reviewer who submits a high-severity flag, **When** the flag is saved, **Then** both the moderator and commander are immediately notified, and the escalation requires response within 2 hours.
3. **Given** a reviewer who submits a medium-severity flag, **When** the flag is saved, **Then** the flag is added to the moderator's escalation queue with a 24-hour response SLA.
4. **Given** a reviewer who submits a low-severity flag, **When** the flag is saved, **Then** the flag is logged for weekly pattern review.
5. **Given** a chat session containing auto-detected crisis keywords, **When** the session enters the review queue, **Then** it is automatically flagged as high-risk and prioritized in all reviewers' queues.
6. **Given** a moderator viewing the escalation queue, **When** they select a flag, **Then** they can acknowledge, resolve (with notes), escalate further, or request deanonymization.

---

### User Story 4 - Queue Management & Assignment (Priority: P2)

Reviewers access a prioritized queue of chat sessions organized into tabs: Pending, Flagged, In Progress, and Completed. The queue supports filtering by status, risk level, date range, assignment, and language. Sessions are automatically distributed to balance reviewer workload, and risk-flagged chats are prioritized. Moderators can manually assign sessions to specific reviewers with a 24-hour reservation.

**Why this priority**: Efficient queue management ensures reviewers can find and prioritize work effectively. While basic queue listing is part of P1, advanced filtering, sorting, and workload balancing optimize reviewer productivity.

**Independent Test**: Can be tested by populating the queue with sessions of varying risk levels and statuses, then verifying correct tab filtering, sorting, and assignment behavior.

**Acceptance Scenarios**:

1. **Given** a reviewer accessing the queue, **When** they select the "Pending" tab, **Then** they see sessions sorted by priority (risk flags first, then oldest first) that still need reviews.
2. **Given** a reviewer, **When** they filter by risk level "High Only", **Then** only sessions with high-risk flags are displayed.
3. **Given** a reviewer qualified only in Ukrainian, **When** they view the queue, **Then** they see only sessions conducted in Ukrainian.
4. **Given** a moderator, **When** they manually assign a session to a reviewer, **Then** the session is reserved for that reviewer for 24 hours, after which unstarted assignments expire and return to the pool.
5. **Given** a reviewer who has already reviewed a session, **When** they view the queue, **Then** that session does not appear in their queue.
6. **Given** a session with a started but incomplete review older than 24 hours, **When** the timeout expires, **Then** the review status changes to "expired" and the session returns to the available pool.

---

### User Story 5 - Anonymization & Controlled Deanonymization (Priority: P2)

All user data is fully anonymized throughout the review process. User IDs appear as USER-XXXX, session IDs as CHAT-XXXX, and real names/emails are never shown. When a safety concern requires identifying a user (e.g., for a welfare check), a reviewer or moderator submits a deanonymization request with a justification. Only commanders or admins can approve these requests. All deanonymization events are fully audited.

**Why this priority**: Privacy protection is foundational for user trust and compliance, and must be enforced from the start. Deanonymization as a controlled exception is critical for safety scenarios but is less frequently used than core review functions.

**Independent Test**: Can be tested by verifying that no real user data is visible in the review interface, and that the full deanonymization request-approve-audit workflow functions correctly.

**Acceptance Scenarios**:

1. **Given** any reviewer viewing any screen, **When** user data is displayed, **Then** only anonymized identifiers (USER-XXXX, CHAT-XXXX) are shown, never real names, emails, or other PII.
2. **Given** a reviewer who has flagged a session for safety concerns, **When** they check "Request user deanonymization" on the flag form, **Then** a deanonymization request is created with their justification and routed to a commander.
3. **Given** a commander viewing pending deanonymization requests, **When** they approve a request, **Then** the requester can see the user's real identity for a time-limited period, and the approval is fully audit-logged.
4. **Given** a commander viewing a deanonymization request, **When** they deny the request, **Then** the denial is logged with the commander's notes, and the requester is notified.
5. **Given** a deanonymization that was approved with a time limit (default 72 hours), **When** the time limit expires, **Then** the revealed data is no longer accessible and the access expiration is logged.

---

### User Story 6 - Reviewer Dashboard & Statistics (Priority: P2)

Each reviewer has a personal dashboard showing their review statistics: total reviews completed, average score given, agreement rate with other reviewers, score distribution, weekly trends, and criteria feedback frequency. Senior reviewers and above can also see team-level statistics including team review volume, inter-rater reliability, pending escalations, and workload balance.

**Why this priority**: Dashboards enable reviewer self-improvement and management oversight. While not required for core review functionality, they are essential for sustainable quality assurance operations.

**Independent Test**: Can be tested by having a reviewer with historical review data access their dashboard and verifying all metrics are correctly calculated and displayed.

**Acceptance Scenarios**:

1. **Given** a reviewer with completed reviews, **When** they access their dashboard, **Then** they see reviews completed, average score given, agreement rate, and score distribution for the selected time period.
2. **Given** a reviewer, **When** they change the time period filter (today, week, month, all), **Then** all displayed metrics recalculate for the selected period.
3. **Given** a senior reviewer, **When** they access the team dashboard, **Then** they see team-level metrics including total reviews, average team score, inter-rater reliability coefficient, and reviewer workload breakdown.
4. **Given** a reviewer with a low agreement rate, **When** they view their dashboard, **Then** the agreement rate is calculated as the percentage of their scores that fall within the variance threshold of the median score for each session.

---

### User Story 7 - Admin Configuration (Priority: P3)

Administrators can configure system-wide settings through a configuration interface: minimum reviews required per session, maximum reviews allowed, score threshold for requiring detailed criteria feedback, auto-flag threshold, score variance limit for dispute detection, review timeout period, and escalation SLA hours. Changes take effect immediately for new reviews.

**Why this priority**: While sensible defaults are provided (3 min reviews, 7 criteria threshold, 2.0 variance limit, 24h timeout, 2h high-risk SLA), admin configurability ensures the system can adapt to changing operational needs without code changes.

**Independent Test**: Can be tested by having an admin change a configuration value (e.g., minimum reviews from 3 to 4) and verifying that new sessions require the updated number of reviews.

**Acceptance Scenarios**:

1. **Given** an admin accessing the configuration page, **When** the page loads, **Then** they see all configurable settings with their current values.
2. **Given** an admin who changes the minimum reviews required from 3 to 4, **When** they save the configuration, **Then** new sessions entering the queue require 4 reviews, while sessions already in progress retain their original requirement.
3. **Given** a non-admin user, **When** they attempt to access the configuration page, **Then** they are denied access.

---

### User Story 8 - Notifications & Alerts (Priority: P3)

The system sends targeted notifications based on events: new review assignments, assignment expiry reminders (4 hours before), high-risk flag alerts (to moderators and commanders), deanonymization request/resolution notifications, disputed score alerts (to senior reviewers), and weekly summary emails. Moderators see banner alerts for pending high-risk escalations. Commanders see banners for pending deanonymization requests.

**Why this priority**: Notifications ensure timely responses to critical events but are enhancement functionality that builds on the core review and escalation workflows.

**Independent Test**: Can be tested by triggering each notification type and verifying the correct recipients receive the notification through the correct channel.

**Acceptance Scenarios**:

1. **Given** a high-risk flag is submitted, **When** the flag is saved, **Then** moderators and commanders receive in-app, push, and email notifications.
2. **Given** a reviewer with an assignment expiring in 4 hours, **When** the reminder triggers, **Then** they receive an in-app notification.
3. **Given** a moderator with pending high-risk escalations, **When** they access any page, **Then** they see a persistent banner showing the count of unresolved high-risk escalations.
4. **Given** a commander with pending deanonymization requests, **When** they access any page, **Then** they see a persistent banner showing the count of pending requests.

---

### User Story 9 - Reporting & Analytics (Priority: P3)

The system generates standard reports: daily summaries for moderators, weekly performance reports for all reviewers, monthly quality reports for admins, and weekly escalation reports for commanders. Reports can be exported as CSV, PDF, or JSON. Dashboards show AI quality indicators including overall score trends, common criteria issues, and risk flag patterns.

**Why this priority**: Reporting enables data-driven decisions and continuous improvement but builds upon accumulated review data, making it a later-phase priority.

**Independent Test**: Can be tested by generating each report type with sample data and verifying correct content, formatting, and export functionality.

**Acceptance Scenarios**:

1. **Given** a moderator, **When** the daily summary is generated, **Then** it includes reviews completed, pending queue depth, and open escalation count.
2. **Given** an admin viewing the monthly quality report, **When** the report loads, **Then** it shows score distributions across all reviewers, inter-rater reliability trends, and the most common criteria issues identified.
3. **Given** any authorized user viewing a report, **When** they click export, **Then** they can download the report in CSV, PDF, or JSON format.

---

### Edge Cases

- What happens when a reviewer starts a review but their session times out (30 min auto-logout) before they submit? The review status is preserved as "in_progress" with partial data saved; the 24-hour review timeout applies independently.
- What happens when the maximum number of reviews (default 5) is reached but the session is still disputed? The system uses the median score and keeps the "Disputed" status; a moderator is alerted for manual resolution.
- What happens when a tiebreaker reviewer's score still doesn't resolve the dispute? The tiebreaker can request a moderation review, escalating to a moderator for final determination.
- What happens when a deanonymization request is submitted but no commander is available? The request remains pending; the system escalates via email and push notification with increasing urgency based on the SLA.
- What happens when auto-detection flags a session as high-risk but the content is a false positive (e.g., discussing a movie plot involving self-harm)? Reviewers can acknowledge and resolve the flag with notes explaining the false positive; this is tracked for pattern analysis to improve auto-detection.
- What happens when a reviewer gives a score of 2 or below? The system immediately escalates to a moderator in addition to requiring detailed criteria feedback.
- What happens when the average session score is 5 or below? The session is flagged for AI team review to improve the underlying AI model's responses.
- What happens when the Notification Service is unavailable during a high-risk flag submission? The flag is saved with an explicit "notification pending" status visible to the reviewer. The system automatically retries delivery. If delivery fails after 15 minutes, escalating alerts are triggered through alternative channels to ensure no high-risk event is silently missed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all chat sessions in a prioritized review queue organized by tabs (Pending, Flagged, In Progress, Completed) with filtering by status, risk level, date range, assignment, and language.
- **FR-002**: System MUST present chat transcripts with user messages and AI messages clearly distinguished, with anonymized user identifiers (USER-XXXX format) throughout.
- **FR-003**: System MUST allow reviewers to rate each AI response on a 1-10 scale with color-coded severity labels (Outstanding through Unsafe).
- **FR-004**: System MUST require detailed criteria feedback (on at least 1 of 5 criteria: relevance, empathy, safety, ethics, clarity) for scores of 7 or below, with minimum 10-character comments.
- **FR-005**: System MUST enforce reviewer blinding during the review process (no visibility of other reviewers' individual scores until the session is fully complete).
- **FR-006**: System MUST support configurable multi-reviewer validation with minimum required reviews (default: 3), maximum allowed reviews (default: 5), and score variance thresholds (default: 2.0).
- **FR-007**: System MUST calculate final session scores using average when within variance threshold, tiebreaker score when a tiebreaker is assigned, or median with "Disputed" status otherwise.
- **FR-008**: System MUST automatically flag sessions containing crisis keywords (suicidal ideation, self-harm, violence) as high-risk and prioritize them in all reviewer queues.
- **FR-009**: System MUST support manual risk flagging with severity levels (high, medium, low), reason categories, and free-text details.
- **FR-010**: System MUST route escalations based on severity: high-risk to immediate moderator/commander notification (2-hour SLA), medium-risk to moderator queue (24-hour SLA), low-risk to logging for weekly review.
- **FR-011**: System MUST enforce full anonymization of user data across all screens, with deanonymization only possible through an approval workflow requiring commander or admin authorization.
- **FR-012**: System MUST audit-log all deanonymization requests, approvals, denials, and data access events with timestamps, actor identities, justifications, and outcomes.
- **FR-013**: System MUST provide personal reviewer dashboards showing reviews completed, average score, agreement rate, score distribution, weekly trends, and criteria feedback counts.
- **FR-014**: System MUST provide team dashboards for senior reviewers and above showing team volume, average team score, inter-rater reliability, pending escalations, and workload balance.
- **FR-015**: System MUST support five user roles with hierarchical permissions: Reviewer, Senior Reviewer, Moderator, Commander, and Admin.
- **FR-016**: System MUST auto-expire unstarted review assignments after 24 hours and return sessions to the available pool.
- **FR-017**: System MUST prevent a reviewer from reviewing the same chat session twice.
- **FR-018**: System MUST automatically escalate to a moderator when any AI response receives a score of 2 or below.
- **FR-019**: System MUST flag sessions for AI team review when the average session score is 5 or below.
- **FR-020**: System MUST allow admins to configure review settings, queue settings, and escalation settings through a dedicated configuration interface.
- **FR-021**: System MUST send in-app notifications for review assignments, assignment reminders, escalation outcomes, and deanonymization resolutions; high-risk events must also trigger push and email notifications.
- **FR-026**: System MUST persist high-risk flags independently of notification delivery, display a "notification pending" status to the submitting reviewer when the Notification Service is unavailable, automatically retry delivery, and trigger escalating alerts through alternative channels if delivery fails after 15 minutes.
- **FR-022**: System MUST distribute chat sessions across reviewers to balance workload and only show sessions in languages the reviewer is qualified to review.
- **FR-023**: System MUST support time-limited deanonymization access with a default duration of 72 hours that automatically expires and logs the expiration event. The duration is configurable by admins.
- **FR-024**: System MUST generate standard reports (daily summary, weekly performance, monthly quality, escalation report) with export options in CSV, PDF, and JSON formats.
- **FR-025**: System MUST auto-flag AI responses scored 4 or below by a reviewer for moderator review.
- **FR-027**: System MUST provide full interface localization in Ukrainian, English, and Russian, including all UI labels, buttons, navigation, notifications, error messages, and report templates. Reviewer language preference is stored per user profile.

### Compliance & Regulatory Requirements

- **CR-001**: System MUST comply with Ukrainian Law on Personal Data Protection for all personal data processing, storage, and transfer operations.
- **CR-002**: System MUST comply with GDPR requirements including lawful basis for processing, data subject rights, data minimization, and breach notification obligations.
- **CR-003**: System MUST ensure data residency and cross-border transfer mechanisms comply with both Ukrainian and EU regulatory frameworks.
- **CR-004**: System MUST maintain processing records and support data subject access requests (DSAR) as required by both frameworks.

### Key Entities

- **Chat Session**: A complete conversation between a user and the AI chatbot, identified by an anonymized session ID (CHAT-XXXX). Key attributes: anonymized user ID, start/end timestamps, message count, risk level, review status, language.
- **Session Message**: An individual message within a chat session. Key attributes: role (user or assistant), content, timestamp, AI metadata (confidence score, detected intent), risk flag indicator.
- **Session Review**: A complete evaluation of all AI responses in a session by a single reviewer. Key attributes: reviewer reference, status (pending/in_progress/completed/expired), start time, completion time, average score, overall comment, tiebreaker flag.
- **Message Rating**: A score and optional comment for a single AI response within a review. Key attributes: score (1-10), comment, parent review reference, parent message reference.
- **Criteria Feedback**: Detailed feedback on a specific evaluation criterion for a rated message. Key attributes: criterion key (relevance/empathy/safety/ethics/clarity), feedback text, parent rating reference.
- **Risk Flag**: A safety concern marker on a chat session. Key attributes: severity (high/medium/low), reason category, details, status (open/acknowledged/resolved/escalated), flagging reviewer, resolver, resolution notes, deanonymization request flag.
- **Deanonymization Request**: A request to reveal a user's real identity. Key attributes: target session, target user, requester, approver, justification category, supporting details, status (pending/approved/denied), time-limited access expiration.
- **Audit Log Entry**: An immutable record of a system action. Key attributes: actor, action type, target type and ID, details, IP address, timestamp.
- **Review Configuration**: System-wide settings governing review behavior. Key attributes: minimum/maximum reviews per session, criteria threshold score, auto-flag threshold, variance limit, tiebreaker requirement, timeout hours, escalation SLA hours.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chat sessions are reviewed by the minimum required number of qualified reviewers.
- **SC-002**: All AI response scores of 7 or below include at least one criterion-specific feedback comment.
- **SC-003**: 90% of pending chat sessions are reviewed within 24 hours of entering the queue.
- **SC-004**: Inter-rater score variance is 2 points or fewer for 85% of completed sessions (indicating consistent reviewer calibration).
- **SC-005**: High-severity risk flags are acknowledged by a moderator within 2 hours of submission.
- **SC-006**: Medium-severity risk flags are acknowledged within 24 hours of submission.
- **SC-007**: The review queue loads in under 1 second; individual session transcripts load in under 2 seconds; review submissions complete in under 500 milliseconds.
- **SC-008**: The system supports 100+ concurrent reviewers without performance degradation.
- **SC-009**: No real user PII (names, emails, identifiers) is ever visible in the review interface without an approved deanonymization request.
- **SC-010**: 100% of deanonymization events (requests, approvals, denials, data access) are captured in the audit log.
- **SC-011**: Reviewer agreement rate (percentage of scores within variance threshold of session median) averages 85% or higher across the reviewer pool.
- **SC-012**: Reviewers can rate an individual AI response (select score + optional criteria feedback) in under 60 seconds on average.
- **SC-013**: System maintains 99.9% uptime (~8.7 hours maximum downtime per year), with no single planned or unplanned outage exceeding the 2-hour high-risk escalation SLA window.

## Clarifications

### Session 2026-02-10

- Q: Which regulatory framework governs this system's handling of mental health data? → A: Both Ukrainian data protection law (Law on Personal Data Protection) and GDPR.
- Q: What is the minimum availability target for this system? → A: 99.9% uptime (~8.7 hours downtime/year).
- Q: What should happen when the Notification Service is unavailable during a high-risk flag submission? → A: Flag saved with explicit "notification pending" status visible to reviewer; automatic retry with escalating alerts if delivery fails after 15 minutes.
- Q: What is the default time-limited duration for approved deanonymization access? → A: 72 hours (accommodates weekend/cross-timezone scenarios).
- Q: Is the review interface itself multilingual, or English-only with multilingual chat content? → A: Full interface localization in all three languages (Ukrainian, English, Russian).

## Assumptions

- The existing Chat Service provides a stable API for retrieving chat sessions and messages, including AI metadata (confidence scores, intent detection).
- The existing User Service handles reviewer authentication; this system adds role-based authorization for review-specific permissions.
- A Notification Service exists or will be available for delivering in-app, push, and email notifications.
- Crisis keyword detection for auto-flagging is based on pattern matching against a curated list of terms and phrases in supported languages (Ukrainian, English, Russian).
- Reviewer qualification (licensed mental health professional, training completion, calibration assessment) is managed outside this system; this system enforces the active/inactive account status.
- The system is deployed in a GCP environment with PostgreSQL for persistence and GCS for archived transcript storage (consistent with existing infrastructure).
- Session anonymization uses a deterministic mapping (same user always maps to the same USER-XXXX within a session context) so reviewers can follow conversation flow, but different anonymous IDs may be used across separate sessions for the same user.
