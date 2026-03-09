# Feature Specification: Chat Review Supervision & Group Management Enhancements

**Feature Branch**: `011-chat-review-supervision`  
**Created**: 2026-02-21  
**Status**: Draft
**Jira Epic**: MTB-229
**Input**: User description: "Group management: add new users (not only existing ones). Chat Moderation: question-mark next to grade with description, criteria — only one is mandatory with checkbox for mentioned criteria, configurable number of reviewers per group + global, supervisor second-level review (3-column interface), approve/disapprove with optional return to reviewer, supervisor response higher priority, tag creation only for supervisor, reviewer uses existing tags, new tab for waiting reviews/supervision, RAG call details in-chat and in-review."

**Related Specs**:
- `002-chat-moderation-review` — Base chat moderation and review system
- `003-chat-moderation-review` — Split-repo implementation of the review system
- `010-chat-review-tagging` — User and chat tagging for review filtering

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Supervisor Second-Level Review (Priority: P1)

After a reviewer submits a chat review (scoring AI responses per the existing review flow), the completed review is routed to a supervisor for second-level evaluation. The supervisor opens a three-column interface showing: (1) the original chat transcript, (2) the reviewer's submitted review with scores and feedback, and (3) a supervisor comment panel. The supervisor reads the chat and the reviewer's assessment, then either approves or disapproves the review with written comments. If the supervisor disapproves, they can optionally return the review to the original reviewer for a second iteration — the reviewer sees the supervisor's feedback and can revise their scores and comments before resubmitting. The supervisor's assessment carries higher authority than the base reviewer's rating when determining the final session quality outcome.

**Why this priority**: Supervision is the central new capability in this spec. It introduces quality assurance over the review process itself — ensuring that reviewers are evaluated and calibrated, not just the AI. Without this, all other supervision-related features (tag management, priority rules, waiting tab) have no foundation.

**Independent Test**: Can be fully tested by having a reviewer submit a review, then a supervisor open the review in the three-column view, approve it, and verify the supervisor's assessment is reflected as the authoritative outcome. A second test path: supervisor disapproves, review returns to the reviewer, reviewer revises and resubmits.

**Acceptance Scenarios**:

1. **Given** a reviewer has submitted a completed review for a chat session, **When** the review is saved, **Then** it appears in the supervisor's review queue for second-level evaluation.
2. **Given** a supervisor opens a pending review, **When** the interface loads, **Then** they see three columns: the original chat transcript on the left, the reviewer's scores and feedback in the center, and a supervisor comment panel on the right.
3. **Given** a supervisor reviewing a submitted review, **When** they click "Approve" and enter a comment, **Then** the review is marked as supervisor-approved and the supervisor's comment is attached to the review record.
4. **Given** a supervisor reviewing a submitted review, **When** they click "Disapprove" with the "Return to reviewer" option selected, **Then** the review is sent back to the original reviewer with the supervisor's feedback visible, and the reviewer can revise their scores and comments.
5. **Given** a supervisor reviewing a submitted review, **When** they click "Disapprove" without the "Return to reviewer" option, **Then** the review is marked as disapproved with the supervisor's comments recorded, and no revision cycle is initiated.
6. **Given** a session with both a reviewer assessment and a supervisor assessment, **When** the final session quality outcome is calculated, **Then** the supervisor's assessment takes precedence over the reviewer's original scores.
7. **Given** a reviewer whose review was returned for revision, **When** they open the review, **Then** they see the supervisor's disapproval comments and can edit their scores and feedback before resubmitting.
8. **Given** a reviewer resubmits a revised review, **When** the revision is saved, **Then** it returns to the supervisor's queue for re-evaluation.

---

### User Story 2 - Grade Help Tooltip & Flexible Criteria Feedback (Priority: P1)

When reviewing an AI response, the reviewer sees a help icon (question mark) next to each grade/score option. Hovering or tapping the icon displays a description of what that grade level means (e.g., what constitutes a 3 vs. a 7 vs. a 10). This replaces the need for reviewers to memorize the grading rubric. Additionally, the criteria feedback system is simplified: instead of requiring feedback on all five criteria for low scores, only one criterion is mandatory. The remaining criteria are presented as checkboxes — the reviewer checks which criteria are relevant to the AI response and can optionally add comments for each checked criterion.

**Why this priority**: Grade clarity directly affects review quality and inter-rater consistency. If reviewers interpret scores differently, the entire moderation system loses reliability. Making criteria flexible reduces reviewer fatigue while still capturing structured feedback.

**Independent Test**: Can be fully tested by having a reviewer rate an AI response, verifying the question-mark tooltip displays the correct description for each score level, and confirming that only one criterion is required while others are optional checkboxes.

**Acceptance Scenarios**:

1. **Given** a reviewer viewing the score selector for an AI response, **When** they hover over or tap the question-mark icon next to a score value, **Then** a tooltip or popover displays a plain-language description of what that score level means.
2. **Given** score descriptions exist for all 10 levels (1-10), **When** a reviewer views descriptions for adjacent scores (e.g., 6 vs. 7), **Then** the descriptions clearly differentiate the quality expectations between levels.
3. **Given** a reviewer selects a score at or below the detailed-feedback threshold, **When** the criteria feedback form appears, **Then** each criterion (relevance, empathy/sensitivity, psychological safety, ethical integrity, clarity/tone) is shown as a checkbox with an optional comment field.
4. **Given** a reviewer is providing criteria feedback, **When** they attempt to submit without checking at least one criterion, **Then** submission is blocked with a message indicating at least one criterion must be selected.
5. **Given** a reviewer has checked one or more criteria, **When** they submit, **Then** only the checked criteria and their associated comments (if any) are saved — unchecked criteria are not required.
6. **Given** the grading scale descriptions, **When** an admin or supervisor updates the description text for a score level, **Then** the updated description is reflected in the tooltip for all reviewers.

---

### User Story 3 - Configurable Reviewer Count per Group and Globally (Priority: P1)

An administrator can configure the number of reviewers required for chat sessions at two levels: globally (system-wide default) and per group. The per-group setting overrides the global default when set. This allows different groups (e.g., clinical vs. general wellness) to have different review coverage requirements based on their risk profile or operational needs. The setting is managed through the existing admin configuration interface.

**Why this priority**: Different groups may have different quality assurance needs. A high-risk clinical group may need 4 reviewers while a general support group needs 2. Without per-group configuration, either all groups are over-resourced or under-covered.

**Independent Test**: Can be tested by setting a global reviewer count of 3 and a group-specific count of 5 for one group, then verifying that sessions from that group require 5 reviews while sessions from other groups require 3.

**Acceptance Scenarios**:

1. **Given** an administrator in the settings interface, **When** they set the global reviewer count to a value (e.g., 3), **Then** all chat sessions default to requiring that number of reviews unless overridden at group level.
2. **Given** an administrator viewing group settings, **When** they set a reviewer count override for a specific group (e.g., 5), **Then** sessions from that group require the group-specific count instead of the global default.
3. **Given** a group with a reviewer count override, **When** an admin removes the override, **Then** the group reverts to the global default reviewer count.
4. **Given** a session already in progress with 3 required reviews, **When** an admin changes the group's reviewer count from 3 to 5, **Then** the in-progress session retains its original requirement of 3 (changes apply only to new sessions entering the queue).
5. **Given** any authorized role viewing session details, **When** they inspect a session's review requirement, **Then** the effective reviewer count and its source (global or group override) are visible.

---

### User Story 4 - Supervisor-Only Tag Creation (Priority: P2)

Tag creation is restricted to supervisors (and admins). Reviewers can browse and apply existing tags to chat sessions and user accounts but cannot create new tags. When a reviewer needs a tag that does not exist, they must request it from a supervisor. This ensures tag taxonomy remains controlled and consistent, preventing tag proliferation from ad-hoc reviewer usage.

**Why this priority**: Uncontrolled tag creation leads to duplicate, inconsistent, or meaningless tags that reduce the value of the tagging system. Restricting creation to supervisors maintains taxonomy quality. This modifies the behavior defined in spec 010 (User Story 5) where moderators could create ad-hoc tags.

**Independent Test**: Can be tested by logging in as a reviewer and verifying the "create new tag" option is unavailable, then logging in as a supervisor and verifying the option is available.

**Acceptance Scenarios**:

1. **Given** a supervisor viewing the tag management interface, **When** they create a new tag with a name and description, **Then** the tag is persisted and immediately available for all reviewers to apply.
2. **Given** a reviewer viewing a chat session, **When** they open the tag selector, **Then** they see a list of existing tags but no option to create a new one.
3. **Given** a reviewer who needs a tag that does not exist, **When** they search for it in the tag selector, **Then** the system displays a message like "Tag not found — contact a supervisor to create it."
4. **Given** an admin, **When** they access tag management, **Then** they can create, edit, and delete tags (admin retains full tag management capability).

---

### User Story 5 - Waiting for Reviews/Supervision Tab (Priority: P2)

The review queue interface gains a new tab: "Awaiting Supervision." This tab shows sessions whose reviews have been submitted by reviewers but are pending supervisor second-level review. Supervisors use this tab to find work. Reviewers can also see a personal "Awaiting Feedback" view showing their submitted reviews that are pending supervisor evaluation or have been returned for revision. This provides visibility into where each session sits in the review pipeline.

**Why this priority**: Without a dedicated waiting tab, supervisors have no clear funnel to find reviews needing their attention, and reviewers cannot track whether their work has been evaluated. This is essential for the supervision workflow to function operationally.

**Independent Test**: Can be tested by submitting several reviews from different reviewers, then verifying they appear in the supervisor's "Awaiting Supervision" tab, and that each reviewer sees their own pending reviews in the "Awaiting Feedback" view.

**Acceptance Scenarios**:

1. **Given** a supervisor accessing the review queue, **When** they select the "Awaiting Supervision" tab, **Then** they see a shared list of all reviews submitted by reviewers that have not yet been supervisor-evaluated, sorted by submission time (oldest first). Supervisors self-select which reviews to evaluate.
2. **Given** a reviewer accessing the review queue, **When** they select the "Awaiting Feedback" tab, **Then** they see their own submitted reviews that are either pending supervisor evaluation or have been returned with supervisor comments for revision.
3. **Given** a supervisor who approves a review, **When** the approval is saved, **Then** the review is removed from the "Awaiting Supervision" tab.
4. **Given** a supervisor who disapproves and returns a review, **When** the action is saved, **Then** the review moves from the supervisor's "Awaiting Supervision" tab to the reviewer's "Awaiting Feedback" tab with a "Revision Requested" status.
5. **Given** a reviewer who resubmits a revised review, **When** the resubmission is saved, **Then** the review reappears in the supervisor's "Awaiting Supervision" tab.

---

### User Story 6 - RAG Call Details in Chat and Review (Priority: P2)

When viewing a chat session — either as a user in the chat interface or as a reviewer in the review interface — participants can inspect the RAG (Retrieval-Augmented Generation) call details associated with each AI response. This includes which documents or knowledge sources were retrieved, relevance scores, and the query used to retrieve them. In the chat interface, this appears as an expandable detail panel on each AI message. In the review interface, the same information is displayed alongside each AI response to help reviewers assess whether the AI retrieved appropriate sources and whether the response accurately reflects the retrieved content.

**Why this priority**: RAG transparency is essential for reviewers to evaluate AI response quality beyond surface-level text. Understanding what sources the AI used (and whether they were appropriate) is critical for clinical safety reviews. In-chat visibility gives end users confidence in the AI's knowledge basis.

**Independent Test**: Can be tested by sending a chat message that triggers a RAG retrieval, then verifying the RAG details are visible in both the chat UI and the review UI for that AI response.

**Acceptance Scenarios**:

1. **Given** a tester-tagged user viewing an AI response in the chat interface, **When** they click or tap an "info" or "sources" control on the AI message, **Then** an expandable panel shows the full RAG call details: retrieved documents/sources, relevance scores, and the retrieval query.
1a. **Given** a regular (non-tester) user viewing an AI response in the chat interface, **When** the response is displayed, **Then** no RAG details control or panel is shown.
2. **Given** a reviewer viewing an AI response in the review interface, **When** the response is displayed, **Then** the RAG call details are visible alongside or within the response view (collapsed by default, expandable).
3. **Given** an AI response that did not involve a RAG call (e.g., a greeting or clarification), **When** displayed in chat or review, **Then** no RAG details panel is shown for that response.
4. **Given** a RAG call that retrieved multiple documents, **When** the details panel is expanded, **Then** each retrieved document shows its title/identifier, a relevance score, and a snippet of the matched content.
5. **Given** a reviewer assessing an AI response with RAG details visible, **When** they rate the response, **Then** they can reference the RAG sources in their criteria feedback to explain their score.

---

### User Story 7 - Add New Users to Groups (Priority: P2)

An administrator or group manager can add entirely new users to a group — not just users who already have an account in the system. When the new user does not exist, the system creates their account as part of the group-add workflow, collecting the minimum required information (name, email, role). The new user receives an invitation or onboarding notification. This eliminates the two-step process of first creating a user account separately and then adding them to a group.

**Why this priority**: Currently, adding someone to a group requires that person to already exist in the system. This creates friction for onboarding new team members — managers must coordinate with admins to create the account first. Streamlining this into a single flow reduces onboarding time and administrative burden.

**Independent Test**: Can be tested by a group manager entering a new user's email and name in the group member addition flow, verifying the account is created, the user is added to the group, and the new user can log in.

**Acceptance Scenarios**:

1. **Given** a group manager adding a member to their group, **When** they enter an email that does not match any existing user, **Then** the system presents a form to capture the new user's name, role, and any required fields.
2. **Given** a group manager completing the new-user form, **When** they submit, **Then** the system creates the user account and adds the new user to the group in a single operation.
3. **Given** a newly created user via the group-add flow, **When** the account is created, **Then** the new user receives an invitation or onboarding notification with instructions to activate their account.
4. **Given** a group manager adding a member whose email matches an existing user, **When** they enter the email, **Then** the system recognizes the existing user and adds them directly to the group without creating a duplicate account.
5. **Given** a group manager attempting to add a user who is already a member of that group, **When** they enter the email, **Then** the system displays a message indicating the user is already a member.

---

### Edge Cases

- What happens when a supervisor is unavailable and reviews pile up in the "Awaiting Supervision" tab? Sessions remain in the queue; if a configurable timeout is reached (default: none — reviews wait indefinitely for supervision), the system can optionally auto-escalate to an admin or senior supervisor.
- What happens when a reviewer resubmits a revised review but the supervisor has been reassigned? The revised review goes to any available supervisor for the group, not necessarily the original supervisor.
- What happens when a supervisor disapproves a review but the reviewer's account has been deactivated? The disapproval is recorded but no revision cycle is initiated; the session is returned to the pending review pool for a new reviewer.
- What happens when a group's reviewer count override is set to a value lower than the number of reviews already submitted? Already-submitted reviews are retained; the session is considered complete once the new threshold is met.
- What happens when a new user is added to a group but the invitation email fails to send? The account is still created and the user is added to the group; the system retries invitation delivery and displays a warning to the group manager indicating the invitation could not be sent yet.
- What happens when RAG call details are unavailable because the AI service did not log retrieval metadata? The RAG details panel shows a "No retrieval data available" message for that response.
- What happens when a reviewer applies a tag and a supervisor simultaneously deletes that tag? The tag application fails gracefully with a notification that the tag no longer exists.
- How does the three-column supervisor interface behave on narrow screens? The columns collapse into a tabbed or stacked layout on tablet and mobile viewports.
- What happens when a reviewer has exhausted both revision attempts and the supervisor still disapproves? The review is closed as disapproved; the session is returned to the pending review pool and reassigned to a different reviewer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route completed reviewer assessments to a supervisor queue for second-level review according to the group's supervision policy (all reviews, sampled percentage, or none). The supervision policy is configurable per group with a global default.
- **FR-002**: System MUST present a three-column supervisor review interface showing the chat transcript, the reviewer's assessment (scores and feedback), and a supervisor comment panel.
- **FR-003**: System MUST allow supervisors to approve or disapprove a review with mandatory written comments.
- **FR-004**: System MUST support an optional "return to reviewer" action on disapproval, sending the review back to the original reviewer with the supervisor's feedback for revision. A maximum of 2 revision cycles is allowed; if the supervisor disapproves after the second revision, the review is closed as disapproved and the session is reassigned to a different reviewer.
- **FR-005**: System MUST treat supervisor assessments as higher authority than base reviewer assessments when calculating final session quality outcomes.
- **FR-006**: System MUST display a help icon (question mark) next to each score level in the grading interface, revealing a description of what that score level represents on hover or tap.
- **FR-007**: System MUST require the reviewer to check at least one evaluation criterion when providing criteria feedback for low-scoring responses; unchecked criteria are not required.
- **FR-008**: System MUST present each evaluation criterion as a checkbox with an optional comment field, replacing any previous requirement for all criteria to be addressed.
- **FR-009**: System MUST support configuring the required number of reviewers at two levels: a global system-wide default and a per-group override.
- **FR-010**: System MUST apply per-group reviewer count overrides when set, falling back to the global default when no group-level override exists.
- **FR-011**: System MUST restrict tag creation to supervisors and admins; reviewers can only apply existing tags.
- **FR-012**: System MUST allow reviewers to browse and apply existing tags to chat sessions from a read-only tag list.
- **FR-013**: System MUST provide a shared "Awaiting Supervision" tab in the review queue from which supervisors self-select reviews to evaluate (no automatic assignment).
- **FR-014**: System MUST provide an "Awaiting Feedback" view for reviewers showing their submitted reviews pending supervisor evaluation or returned for revision.
- **FR-015**: System MUST display full RAG call details (retrieved documents, relevance scores, retrieval query) as an expandable panel on each AI response in the review interface for all reviewers and supervisors.
- **FR-015a**: System MUST display full RAG call details in the end-user chat interface only for users tagged as testers; regular end users do not see RAG details in chat.
- **FR-016**: System MUST hide the RAG details panel for AI responses that did not involve a RAG retrieval call.
- **FR-017**: System MUST allow group managers and admins to create new user accounts directly from the group member addition flow by providing name, email, and role.
- **FR-018**: System MUST send an invitation or onboarding notification to newly created users added through the group-add flow.
- **FR-019**: System MUST detect existing users by email during the group-add flow and add them directly without creating duplicate accounts.
- **FR-020**: System MUST apply reviewer count configuration changes only to new sessions entering the queue; in-progress sessions retain their original requirements.
- **FR-021**: System MUST allow admins and supervisors to edit the description text associated with each score level in the grading rubric.
- **FR-022**: System MUST provide responsive behavior for the three-column supervisor interface, collapsing to a tabbed or stacked layout on narrow viewports.

### Key Entities

- **Supervisor Review**: A second-level evaluation of a reviewer's assessment by a supervisor. Key attributes: supervisor reference, reviewed assessment reference, decision (approved/disapproved), comments, return-to-reviewer flag, decision timestamp, revision iteration number (max 2).
- **Grade Description**: A text description associated with each score level (1-10) in the grading rubric. Key attributes: score level, description text, last-updated-by reference, last-updated timestamp.
- **Reviewer Count Configuration**: Settings governing how many reviewers are required per session and the supervision policy. Key attributes: global default count, per-group overrides (group reference, count), supervision policy per group (all/sampled-percentage/none) with global default, effective-from timestamp.
- **RAG Call Detail**: Metadata from a retrieval-augmented generation call associated with an AI response. Key attributes: parent message reference, retrieval query, list of retrieved documents (title/identifier, relevance score, content snippet), retrieval timestamp.
- **Group Membership Invitation**: A record of a new user invited through the group-add flow. Key attributes: invitee email, invitee name, assigned role, inviting group reference, invitation status (pending/accepted/expired), invitation timestamp.

### Assumptions

- The existing review system (spec 002/003) is implemented, providing the review queue, session transcript view, scoring interface, and criteria feedback form that this feature modifies and extends.
- The tagging system (spec 010) is implemented, providing the tag model and tag application UI that this feature restricts by role.
- "Supervisor" is a new distinct role added to the existing role hierarchy: Reviewer < Senior Reviewer < **Supervisor** < Moderator < Commander < Admin. Supervisors inherit all Senior Reviewer permissions and additionally gain: second-level review authority, tag creation rights, and supervision policy visibility. This role is separate from both Senior Reviewer (who handles tiebreakers and team metrics) and Moderator (who handles escalations and queue management).
- The AI service (chatbot backend) logs RAG retrieval metadata (query, retrieved documents, relevance scores) as part of the AI response generation pipeline, and this metadata is accessible through the Chat Service API.
- The User Service supports creating new user accounts with minimum required fields (name, email, role) through an API call, and can trigger invitation delivery.
- Score level descriptions are centrally managed and apply system-wide (not per-group or per-reviewer).
- The "return to reviewer" option on disapproval is a per-action choice by the supervisor, not a system-wide configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of reviews selected for supervision (per the group's supervision policy) are routed to the supervisor queue and receive a supervisor decision before the session is considered fully evaluated. Reviews not selected for supervision are marked complete after standard reviewer submission.
- **SC-002**: Supervisors can complete a second-level review (read chat, read reviewer assessment, write comment, approve/disapprove) in under 5 minutes on average.
- **SC-003**: 90% of reviewers report that grade description tooltips improve their confidence in consistent scoring (measured via periodic survey or onboarding feedback).
- **SC-004**: Reviewer feedback submission time does not increase after criteria are changed to checkbox-optional format (baseline: under 60 seconds per AI response per SC-012 in spec 002).
- **SC-005**: Per-group reviewer count overrides are applied correctly to 100% of new sessions entering the queue from groups with overrides.
- **SC-006**: New users added through the group-add flow can activate their account and access the group within 24 hours of invitation.
- **SC-007**: RAG call details are available and viewable for 100% of AI responses that involved a RAG retrieval call.
- **SC-008**: The "Awaiting Supervision" tab loads in under 1 second, consistent with existing queue performance targets.
- **SC-009**: Tag creation attempts by reviewers are blocked with 100% accuracy; only supervisors and admins can create tags.
- **SC-010**: The supervisor three-column interface is usable on desktop, tablet, and mobile viewports without loss of core functionality.

## Clarifications

### Session 2026-02-21

- Q: Does every submitted review require supervisor evaluation, or is supervision selective/configurable? → A: Configurable per group — some groups require 100% supervision, others use sampling or no supervision.
- Q: Is "Supervisor" a new role or mapped to an existing role (Senior Reviewer / Moderator)? → A: Supervisor is a new distinct role between Senior Reviewer and Moderator in the hierarchy.
- Q: Is there a maximum number of disapprove-revise-resubmit cycles before escalation? → A: Maximum 2 revisions; after the second disapproval the review is closed and the session is reassigned to a different reviewer.
- Q: How are supervisors matched to reviews — auto-assigned, group-based, or self-selected? → A: Self-selection from a shared "Awaiting Supervision" queue (no automatic assignment).
- Q: Who can see RAG call details — all end users, testers only, or reviewers only? → A: Full details in the review interface for all reviewers/supervisors. Full details in the end-user chat interface only for tester-tagged users; regular users see no RAG details in chat.
