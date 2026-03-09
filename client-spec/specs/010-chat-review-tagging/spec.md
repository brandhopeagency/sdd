# Feature Specification: User & Chat Tagging for Review Filtering

**Feature Branch**: `010-chat-review-tagging`  
**Created**: 2026-02-10  
**Status**: Complete
**Jira Epic**: MTB-228
**Input**: User description: "have an ability to tag users. tag test users with 'functional QA' tag. Don't include chats from those users into chat reviews. don't include chats shorter than 4 messages into chat reviews. tag those chats as 'short' and allow filtering by the tag in chat review interface. update the chat review interface according to the previously defined spec"

**Related Spec**: `002-chat-moderation-review` — This feature extends the Chat Moderation & Review System defined in spec 002 by adding user and chat tagging capabilities with automatic review queue filtering.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tag Users for Review Exclusion (Priority: P1)

An administrator or moderator opens the user management area and assigns tags to user accounts. They tag internal test accounts (e.g., QA engineers, staging bots) with a "functional QA" tag. Once tagged, any chat sessions originating from these users are automatically excluded from the review queue. This ensures reviewers spend their time evaluating real patient-AI interactions rather than test conversations.

**Why this priority**: Without the ability to tag and exclude test users, the review queue is polluted with non-genuine conversations, wasting reviewer time and skewing quality metrics. This is the foundational capability that all other tagging features depend on.

**Independent Test**: Can be fully tested by tagging a user with "functional QA", having that user generate a chat session, and verifying the session does not appear in any reviewer's queue.

**Acceptance Scenarios**:

1. **Given** a moderator or admin viewing a user profile, **When** they add the "functional QA" tag to the user, **Then** the tag is saved and displayed on the user profile.
2. **Given** a user tagged with "functional QA", **When** that user completes a new chat session with the AI, **Then** the session does not appear in the review queue for any reviewer.
3. **Given** a user tagged with "functional QA", **When** the tag is removed by a moderator or admin, **Then** new chat sessions from that user begin appearing in the review queue normally.
4. **Given** a user who was tagged with "functional QA" after some chat sessions already entered the review queue, **When** the tag is applied, **Then** existing sessions already in the review queue remain (only future sessions are excluded).
5. **Given** a moderator viewing the user list, **When** they filter by the "functional QA" tag, **Then** only users with that tag are displayed.

---

### User Story 2 - Automatically Tag and Exclude Short Chats (Priority: P1)

The system automatically identifies chat sessions that contain fewer than 4 messages (total messages from both user and AI combined). These sessions are tagged as "short" and excluded from the review queue. This prevents reviewers from spending time on conversations that lack sufficient content for meaningful quality evaluation — such as sessions where a user sent one message and the AI replied once, or sessions that were abandoned after a brief exchange.

**Why this priority**: Short chats constitute a significant portion of chat volume but provide minimal review value. Automatically excluding them directly improves reviewer productivity and review quality metrics. This is equally critical as user tagging because it addresses a different dimension of queue noise.

**Independent Test**: Can be fully tested by creating chat sessions with varying message counts (1, 2, 3, 4, 5 messages) and verifying that only sessions with 4 or more messages appear in the review queue, and that sessions below the threshold are tagged "short".

**Acceptance Scenarios**:

1. **Given** a completed chat session with fewer than 4 total messages, **When** the session is processed for review queue inclusion, **Then** the session is automatically tagged "short" and excluded from the review queue.
2. **Given** a completed chat session with exactly 4 total messages, **When** the session is processed, **Then** the session is included in the review queue normally and is not tagged "short".
3. **Given** a completed chat session with more than 4 total messages, **When** the session is processed, **Then** the session is included in the review queue normally and is not tagged "short".
4. **Given** the minimum message threshold is configured to a value other than 4 (e.g., 6), **When** a session with 5 messages is processed, **Then** the session is tagged "short" and excluded based on the updated threshold.

---

### User Story 3 - Filter by Tags in Chat Review Interface (Priority: P1)

A reviewer or moderator accessing the chat review queue can filter sessions by their tags. The existing review interface (as defined in spec 002, User Story 4 — Queue Management & Assignment) is updated to include tag-based filtering alongside the existing filters (status, risk level, date range, assignment, language). Users can filter to show or hide sessions with specific tags. They can also view excluded sessions (tagged "short" or from "functional QA" users) using an "Excluded" view or filter, allowing oversight of what was automatically filtered out.

**Why this priority**: Tag filtering is essential for reviewers to manage their queue effectively and for moderators to audit exclusion decisions. Without visibility into excluded sessions, there is no way to verify the system is correctly filtering content.

**Independent Test**: Can be fully tested by populating the queue with sessions having various tags, then applying tag filters and verifying the correct sessions appear or are hidden.

**Acceptance Scenarios**:

1. **Given** a reviewer viewing the review queue, **When** they open the filter panel, **Then** they see a "Tags" filter option listing all tags present on sessions in the system (e.g., "short", "functional QA").
2. **Given** a reviewer who selects the "short" tag in the filter, **When** the filter is applied, **Then** only sessions tagged "short" are displayed (these are normally excluded, so this acts as an override view).
3. **Given** a reviewer viewing the default queue (no tag filters applied), **When** sessions are loaded, **Then** sessions tagged "short" and sessions from "functional QA" users are not shown.
4. **Given** a moderator who wants to audit excluded sessions, **When** they switch to the "Excluded" tab or apply a filter showing excluded sessions, **Then** they see all sessions that were excluded due to tags, with the exclusion reason (tag name) displayed.
5. **Given** a reviewer who applies multiple filters (e.g., tag "short" + risk level "high"), **When** the filters are applied, **Then** only sessions matching all selected filter criteria are displayed.

---

### User Story 4 - Manage User Tags (Priority: P2)

An administrator can create, edit, and delete custom user tags beyond the predefined "functional QA" tag. Each tag has a name and an optional description. Tags can be configured with behaviors — specifically, whether users with a given tag should have their chat sessions excluded from the review queue. This allows the system to accommodate future tagging needs (e.g., "beta tester", "internal staff", "VIP") with configurable review inclusion rules.

**Why this priority**: While the "functional QA" tag addresses the immediate need, a flexible tagging system ensures the feature scales to future requirements without code changes. This is a natural extension once the core tagging infrastructure exists.

**Independent Test**: Can be tested by creating a new custom tag with "exclude from reviews" behavior, assigning it to a user, and verifying the exclusion takes effect.

**Acceptance Scenarios**:

1. **Given** an administrator on the tag management page, **When** they create a new tag with a name and "exclude from reviews" behavior, **Then** the tag is available for assignment to users.
2. **Given** an administrator editing an existing tag, **When** they change the "exclude from reviews" setting from enabled to disabled, **Then** users with that tag are no longer excluded and their future sessions appear in the review queue.
3. **Given** an administrator attempting to create a tag with a duplicate name, **When** they submit the form, **Then** the system rejects the creation and displays an error message.
4. **Given** an administrator attempting to delete a tag that is currently assigned to users, **When** they confirm deletion, **Then** the tag is removed from all assigned users and future sessions are processed according to updated rules.

---

### User Story 5 - Manage Chat Tags (Priority: P2)

Moderators can manually tag chat sessions beyond the automatic "short" tag. They can select from admin-predefined tags or create new ad-hoc tags on the fly. This allows moderators to categorize sessions for organizational purposes (e.g., "escalated", "training-example", "false-positive"). Ad-hoc tags are saved as new Tag Definitions for future reuse. Manually applied tags do not affect review queue inclusion unless specifically configured to do so by an admin. Chat tags are visible in the session detail view and can be used for filtering and reporting.

**Why this priority**: Manual chat tagging supports operational workflows like identifying good training examples or marking sessions for specific follow-up. This extends the automatic tagging with human judgment.

**Independent Test**: Can be tested by a moderator manually adding a tag to a chat session and verifying it appears in the session detail and is filterable in the queue.

**Acceptance Scenarios**:

1. **Given** a moderator viewing a chat session detail, **When** they select an existing tag from the predefined list, **Then** the tag is applied to the session and displayed.
2. **Given** a moderator viewing a chat session detail, **When** they type a new tag name that does not yet exist, **Then** the tag is created as a new Tag Definition (with no exclusion behavior by default), applied to the session, and available for future reuse.
3. **Given** a moderator viewing a chat session, **When** they remove a previously applied tag, **Then** the tag is removed from the session.
4. **Given** a reviewer viewing the review queue, **When** they filter by a manually applied tag, **Then** only sessions with that tag are displayed.
5. **Given** a session with multiple tags (e.g., "training-example" and "escalated"), **When** displayed in the queue or session detail, **Then** all tags are visible.

---

### Edge Cases

- What happens when a "functional QA" tagged user's tag is removed while their session is actively being reviewed? The in-progress review continues normally. Tag changes only affect future queue inclusion decisions.
- What happens when a chat session has exactly 4 messages but one message is a system message (not user or AI)? System messages are not counted toward the minimum message threshold; only user and AI messages count.
- What happens when a session is tagged "short" after already being assigned to a reviewer? If the session was already in the queue and assigned, it remains assigned. The "short" tag is applied at session ingestion time, before queue entry.
- What happens when a tag is renamed? All existing user and session associations update to reflect the new name. Historical audit logs retain the original tag name at the time of the action.
- What happens when an admin applies both "functional QA" user tag and the session happens to also be "short"? Both tags are applied. The session is excluded for either reason. The "Excluded" view shows both exclusion reasons.
- What happens when the minimum message threshold is changed? Only newly processed sessions use the updated threshold. Sessions already tagged "short" or already in the queue are not retroactively re-evaluated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow moderators and admins to assign and remove tags on user accounts.
- **FR-002**: System MUST provide a predefined "functional QA" tag for identifying test/internal users.
- **FR-003**: System MUST automatically exclude chat sessions from the review queue when the originating user has a tag configured with "exclude from reviews" behavior (e.g., "functional QA").
- **FR-004**: System MUST automatically tag chat sessions as "short" when the total number of user and AI messages is below a configurable threshold (default: 4 messages).
- **FR-005**: System MUST automatically exclude "short"-tagged sessions from the review queue.
- **FR-006**: System MUST allow admins to configure the minimum message threshold for the "short" chat determination.
- **FR-007**: System MUST add a "Tags" filter to the chat review queue interface, allowing users to filter sessions by one or more tags.
- **FR-008**: System MUST provide an "Excluded" view or tab in the review queue showing sessions excluded due to tagging rules, with the exclusion reason displayed.
- **FR-009**: System MUST hide excluded sessions (tagged "short" or from users with exclusion-configured tags) from the default review queue view.
- **FR-010**: System MUST allow admins to create, edit, and delete custom user tags with a name, optional description, and configurable "exclude from reviews" behavior.
- **FR-011**: System MUST allow moderators to manually add and remove tags on individual chat sessions by selecting from existing Tag Definitions or creating new ad-hoc tags. Ad-hoc tags created by moderators are persisted as new Tag Definitions (with no exclusion behavior by default) for future reuse.
- **FR-012**: System MUST display all applied tags on the session detail view within the review interface.
- **FR-013**: System MUST apply exclusion rules only to future sessions when a user tag is added or removed; existing in-queue sessions are not affected.
- **FR-014**: System MUST count only user and AI messages (not system messages) when determining the message count for "short" chat evaluation.
- **FR-015**: System MUST allow filtering the user list by assigned tags for user management purposes.
- **FR-016**: System MUST integrate tag filtering with existing review queue filters (status, risk level, date range, assignment, language) as defined in spec 002 (FR-001), using AND logic when multiple filters are applied.
- **FR-017**: System MUST ensure that excluded sessions are still accessible to moderators and admins via the "Excluded" view for audit and oversight purposes.
- **FR-018**: System MUST prevent duplicate tag names (case-insensitive) across a single shared namespace — the same tag name cannot exist as both a user tag and a chat tag simultaneously.

### Key Entities

- **User Tag**: A label assigned to a user account. Key attributes: name, description (optional), "exclude from reviews" behavior flag, created-by reference, creation timestamp.
- **Chat Tag**: A label assigned to a chat session. Key attributes: name, source (system-generated or manually applied), applied-by reference (user or system), application timestamp, associated session reference.
- **Tag Definition**: A reusable tag template created by admins or auto-created when a moderator applies an ad-hoc tag. Key attributes: name (globally unique across all categories, case-insensitive), description, category (user tag or chat tag), behavior flags (exclude from reviews, default off for ad-hoc tags), created-by reference (admin or moderator), active/inactive status.
- **Exclusion Record**: A record documenting why a session was excluded from the review queue. Key attributes: session reference, exclusion reason (tag name), exclusion timestamp, tag source (user tag or chat tag).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chat sessions from users tagged with "functional QA" are excluded from the review queue within 1 second of session completion.
- **SC-002**: 100% of chat sessions with fewer than 4 messages (user + AI only) are automatically tagged "short" and excluded from the review queue.
- **SC-003**: Reviewers report a measurable reduction in non-actionable sessions in their queue (target: 90% of queued sessions contain 4+ messages and originate from real users).
- **SC-004**: Tag filters in the review queue return correct results in under 1 second, consistent with existing queue performance targets (spec 002, SC-007).
- **SC-005**: Moderators can access all excluded sessions through the "Excluded" view for audit purposes, with 100% of exclusion reasons accurately displayed.
- **SC-006**: Admins can create, edit, and delete tags within 3 interactions (clicks/keystrokes per action), providing a streamlined management experience.
- **SC-007**: Tag assignment and removal on user accounts takes effect for new sessions immediately (within the same session processing cycle).
- **SC-008**: The tagging and filtering features do not degrade existing review queue performance — queue load times remain under 1 second with tag filters applied.

## Clarifications

### Session 2026-02-10

- Q: Can moderators only select from admin-predefined chat tags, or also create ad-hoc tags? → A: Both — moderators select from predefined tags or create new ad-hoc tags on the fly.
- Q: Are user tags and chat tags in a shared or separate namespace for uniqueness? → A: Shared namespace — tag names are globally unique across user and chat tag categories.

## Assumptions

- The existing Chat Moderation & Review System (spec 002) is implemented or being implemented concurrently, providing the review queue, session detail views, and filter infrastructure that this feature extends.
- The existing User Service provides user profile data and supports extending user records with tag associations.
- The Chat Service provides message count and message role (user/AI/system) metadata for each session, enabling the "short" chat determination.
- The "functional QA" tag is predefined and seeded during system setup; admins can create additional tags as needed.
- Tag-based exclusion is a soft filter — excluded sessions are not deleted and remain accessible to authorized roles (moderators, admins) through dedicated views.
- The minimum message threshold (default: 4) is a system-wide configuration, not per-tag or per-reviewer.
- Tag changes (assignment, removal, configuration updates) are audit-logged through the existing audit logging infrastructure defined in spec 002 (FR-012).
