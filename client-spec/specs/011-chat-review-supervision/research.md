# Research: Chat Review Supervision & Group Management Enhancements

**Feature**: `011-chat-review-supervision`  
**Date**: 2026-02-21

## R1: Supervisor Role Integration into Existing RBAC

**Decision**: Add `SUPERVISOR` to the `UserRole` enum in `chat-types/src/rbac.ts`, positioned between `RESEARCHER` (Senior Reviewer) and `MODERATOR` in the hierarchy.

**Rationale**: The existing `UserRole` enum uses domain-specific names: `QA_SPECIALIST` (reviewer), `RESEARCHER` (senior reviewer), `MODERATOR`, `GROUP_ADMIN` (commander), `OWNER` (admin). Adding `SUPERVISOR` as a distinct role preserves the hierarchy and avoids overloading existing roles. The supervisor inherits all `RESEARCHER` permissions and gains new supervision-specific permissions.

**Alternatives Considered**:
- Reuse `RESEARCHER` role with feature flags — rejected because supervisor has fundamentally different workflow responsibilities (second-level review authority, tag creation) that don't belong on the research role.
- Reuse `MODERATOR` role — rejected because moderators handle escalations and risk management, not review quality supervision.

**New Permissions for SUPERVISOR**:
- `REVIEW_SUPERVISE` — access supervision queue and submit supervisor decisions
- `REVIEW_SUPERVISION_CONFIG` — view/edit supervision policies per group
- `TAG_CREATE` — create new tag definitions (distinct from `TAG_MANAGE` which includes edit/delete)

**Permission Mapping**:
- `SUPERVISOR` inherits: all `RESEARCHER` permissions + `REVIEW_SUPERVISE`, `REVIEW_SUPERVISION_CONFIG`, `TAG_CREATE`
- `MODERATOR` and above also get `REVIEW_SUPERVISE` (can act as supervisor if needed)
- `OWNER` gets all permissions (unchanged pattern)
- `TAG_MANAGE` remains on `MODERATOR` and above (full CRUD); `TAG_CREATE` on `SUPERVISOR` and above
- Reviewers (`QA_SPECIALIST`) retain `TAG_ASSIGN_SESSION` and `TAG_ASSIGN_USER` but lose ability to create tags (no `TAG_CREATE`)

## R2: Supervision Policy Storage and Evaluation

**Decision**: Store supervision policy as a JSON column on the existing `review_config` table (global) and as per-group overrides on a new `group_review_config` table.

**Rationale**: The existing `review_config` table holds global settings (min reviews, max reviews, thresholds). Extending it with a `supervision_policy` column keeps global defaults centralized. Per-group overrides follow the same pattern as per-group reviewer counts — a separate `group_review_config` table with a foreign key to `groups`.

**Schema**:
```sql
-- Global defaults (extend existing review_config)
ALTER TABLE review_config ADD COLUMN supervision_policy VARCHAR(20) DEFAULT 'none';
ALTER TABLE review_config ADD COLUMN supervision_sample_percentage INT DEFAULT 100;

-- Per-group overrides (new table)
CREATE TABLE group_review_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  reviewer_count_override INT,
  supervision_policy VARCHAR(20),        -- 'all' | 'sampled' | 'none' | NULL (inherit global)
  supervision_sample_percentage INT,     -- 1-100, used when policy = 'sampled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id)
);
```

**Policy Evaluation Logic**: When a review is submitted, the system determines supervision routing:
1. Look up `group_review_config` for the session's group
2. If `supervision_policy` is non-null, use it; otherwise fall back to `review_config.supervision_policy`
3. If policy = `all`, route to supervision queue
4. If policy = `sampled`, use random selection at the configured percentage
5. If policy = `none`, mark review as complete immediately

**Alternatives Considered**:
- Store policy in the groups table directly — rejected because review configuration is a distinct concern and the groups table shouldn't accumulate review-specific columns.
- Use a feature flag service — rejected because policy needs to be per-group and configurable by admins in the UI, not developer-managed flags.

## R3: Three-Column Supervisor Interface Layout

**Decision**: Use a CSS Grid-based three-column layout with responsive breakpoints: 3 columns on desktop (1024px+), tabbed interface on tablet/mobile (<1024px).

**Rationale**: CSS Grid provides clean column management without complex flexbox nesting. The responsive behavior uses a single grid that collapses to a tab bar with content panels at narrower widths. This follows existing Tailwind patterns in the workbench frontend.

**Layout**:
- Desktop (≥1024px): `grid-cols-3` with column widths `1fr 1fr 1fr` (equal) or configurable via drag handle
- Tablet (<1024px): Tab bar at top with 3 tabs (Chat | Review | Supervisor), content panel below
- Mobile (<640px): Same tab bar, full-width content

**Alternatives Considered**:
- Resizable split panes (react-split) — rejected because it adds a dependency and the equal-width default is sufficient for the read-heavy workflow.
- Accordion/collapsible panels — rejected because supervisors need to cross-reference all three columns simultaneously on desktop.

## R4: Grade Description Tooltip Implementation

**Decision**: Store grade descriptions in a `grade_descriptions` database table (10 rows, one per score level 1-10). Display via a lightweight tooltip component using Tailwind positioning (no tooltip library dependency).

**Rationale**: Descriptions need to be editable by admins/supervisors (FR-021), so they must be database-backed rather than hardcoded. The existing `SCORE_LABELS` constant in `chat-types` provides short labels (e.g., "Outstanding", "Unsafe") — the new table provides the longer explanatory text. A custom Tailwind tooltip avoids adding a tooltip library when the existing codebase uses none.

**Schema**:
```sql
CREATE TABLE grade_descriptions (
  score_level INT PRIMARY KEY CHECK (score_level BETWEEN 1 AND 10),
  description TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternatives Considered**:
- Hardcoded descriptions in the frontend — rejected because admins/supervisors need to edit them.
- Store in `review_config` as JSON — rejected because descriptions are a stable reference entity, not a configuration toggle.
- Use a tooltip library (e.g., Tippy.js) — rejected to minimize dependencies; Tailwind positioning handles the use case.

## R5: Criteria Feedback Checkbox Model

**Decision**: Modify the existing `criteria_feedback` table/type to make individual criteria optional. The review submission validation changes from "all 5 criteria required for low scores" to "at least 1 criterion checked for low scores."

**Rationale**: The existing `CriteriaFeedback` type and `criteria_feedback` table already support per-criterion records. The change is in validation logic only — the backend no longer requires 5 records per low-scoring rating, just 1+. The frontend changes the UI from mandatory text fields to checkboxes with optional comment fields.

**Data Model Change**: None to the table schema. The change is:
- Backend validation: `criteria_feedback.length >= 1` (was implicitly 5)
- Frontend: Each criterion renders as a checkbox. When checked, an optional textarea appears. Unchecked criteria are not submitted.
- The `CriteriaFeedback` type already has `criterionKey` and `feedbackText` — `feedbackText` becomes optional (nullable).

**Alternatives Considered**:
- Add a `checked` boolean to criteria feedback — rejected because the absence of a record for a criterion already means it was not selected.
- Use a bitmask for selected criteria — rejected because the existing per-criterion record model is cleaner and already exists.

## R6: RAG Call Detail Data Source

**Decision**: RAG call details are stored by the AI service alongside each AI response. The backend exposes them through the existing message endpoint by joining RAG metadata when available. No new storage table is created in `chat-backend` — the data comes from the AI response metadata already stored in the `session_messages` or `chat_messages` table.

**Rationale**: The AI service (Dialogflow CX / Vertex AI) already produces retrieval metadata as part of its response payload. The `chat-backend` stores message metadata in a JSON column. The plan is to:
1. Ensure the AI response handler persists RAG metadata (retrieved docs, scores, query) in the existing message metadata field
2. Expose a new field on the message response DTO that includes RAG details when present
3. Gate visibility by user tag (tester) in the chat surface and by review permission in the workbench

**Alternatives Considered**:
- Separate `rag_call_details` table — rejected because RAG metadata is tightly coupled to the AI response and is already storable in the message metadata JSON.
- Fetch RAG details on-demand from the AI service — rejected because it introduces latency and the AI service may not retain historical retrieval data.

## R7: Inline User Creation in Group-Add Flow

**Decision**: Extend the existing `POST /api/group/users` endpoint to accept either a `userId` (existing user) or a `newUser` payload (email, name, role). When `newUser` is provided and no matching email exists, create the user via the existing `user.service.ts` and then add them to the group in a single transaction.

**Rationale**: The existing `group.service.ts` has `addUserToGroup(groupId, userId)`. Extending this to support inline creation keeps the API surface small and uses a single transaction to ensure atomicity. The invitation/onboarding notification is triggered after user creation using the existing notification infrastructure.

**Alternatives Considered**:
- Separate `POST /api/users` then `POST /api/group/users` (two-call flow) — rejected because it's what we're trying to eliminate; the spec explicitly requires a single-step operation.
- New dedicated endpoint `POST /api/group/users/invite` — rejected because it fragments the group user management API unnecessarily.

## R8: Supervisor Test Role for E2E

**Decision**: Add a `supervisor` role to `chat-ui/tests/e2e/fixtures/roles.ts` with email `e2e-supervisor@test.local` and database role `supervisor`. The global-setup script seeds this user.

**Rationale**: E2E tests for the supervision flow require a user with supervisor permissions. The existing role fixture pattern (one test user per role) extends cleanly.

**Alternatives Considered**:
- Use the `owner` role for supervision tests — rejected because it doesn't test permission boundaries; a supervisor should not have admin-level access.
- Use the `researcher` role with elevated permissions — rejected because the supervisor is a distinct role in the hierarchy.
