# Feature Specification: Fix "Short" Conversation Tag Not Selectable in Chat Review

**Feature Branch**: `017-fix-short-tag-review`
**Created**: 2026-02-24
**Status**: Draft
**Jira Epic**: [MTB-401](https://mentalhelpglobal.atlassian.net/browse/MTB-401)
**Input**: User description: "[bug] in production there's a 'short' conversation tag available, but not selectable in chat review interface (for an Owner-level user)"

## User Scenarios & Testing

### User Story 1 — Owner Can Filter Reviews by "Short" Tag (Priority: P1)

An Owner-level user navigating to the chat review interface wants to
filter the review queue by the "short" conversation tag. Currently, the
"short" tag exists in the system but does not appear in the tag filter
dropdown, making it impossible to find or manage short conversations
through the review interface.

After the fix, the "short" tag appears in the tag filter dropdown
alongside other active chat tags, regardless of whether any sessions
currently carry that tag.

**Why this priority**: This is the core bug — the tag filter dropdown
must display all active chat tags to enable complete review workflows.

**Independent Test**: Log in as an Owner, open the chat review interface,
click the tag filter dropdown, and verify that "short" appears as a
selectable option.

**Acceptance Scenarios**:

1. **Given** an Owner user is on the chat review page, **When** they open
   the tag filter dropdown, **Then** the "short" tag appears in the list
   of available tags.
2. **Given** no sessions currently carry the "short" tag, **When** the
   Owner opens the tag filter dropdown, **Then** the "short" tag still
   appears (with a count of 0).
3. **Given** the Owner selects the "short" tag filter, **When** sessions
   exist with that tag, **Then** only those sessions are shown in the
   review queue.
4. **Given** the Owner selects the "short" tag filter, **When** no
   sessions have that tag, **Then** the review queue shows an empty
   state with an appropriate message.

---

### User Story 2 — All Active Tags Appear Regardless of Session Count (Priority: P2)

Any user with review access (not just Owners) should see all active chat
tags in the filter dropdown, including tags that currently have zero
associated sessions. This prevents the same class of bug from affecting
other tags in the future.

**Why this priority**: Generalises the fix beyond the "short" tag to
prevent recurrence with any newly created or currently-unused tag.

**Independent Test**: Create a new active chat tag with no session
associations, open the review interface, and verify it appears in the
dropdown.

**Acceptance Scenarios**:

1. **Given** an active chat tag exists with zero session associations,
   **When** a reviewer opens the tag filter dropdown, **Then** that tag
   appears in the list with a count of 0.
2. **Given** a tag is marked as inactive (`is_active = false`), **When**
   a reviewer opens the tag filter dropdown, **Then** that tag does not
   appear.

---

### Edge Cases

- What happens when all active chat tags have zero session associations?
  The dropdown should still list them all.
- What happens when a tag transitions from having sessions to having
  zero sessions (e.g., sessions are deleted)? The tag should remain
  visible in the dropdown.
- What happens with tags in the "user" category? They should continue
  to behave as they do now (this fix targets "chat" category tags in the
  review filter context).

## Requirements

### Functional Requirements

- **FR-001**: The tag filter endpoint MUST return all active tag
  definitions, including those with zero session associations.
- **FR-002**: Tags marked as inactive (`is_active = false`) MUST NOT
  appear in the tag filter dropdown.
- **FR-003**: Each tag in the filter response MUST include its current
  session count (which may be 0).
- **FR-004**: The fix MUST not change the behaviour of tag creation,
  tag assignment to sessions, or the `exclude_from_reviews` flag's
  effect on the review queue itself.

### Key Entities

- **Tag Definition**: A named, categorised label (e.g., "short",
  "functional QA") that can be applied to sessions or users. Has
  attributes: name, category, description, active status, and an
  exclude-from-reviews flag.
- **Session Tag**: An association between a tag definition and a chat
  session, recording which tag was applied, by whom, and when.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The "short" tag appears in the chat review filter dropdown
  for all users with review access, including when zero sessions carry
  that tag.
- **SC-002**: All active chat tags appear in the filter dropdown
  regardless of their current session association count.
- **SC-003**: Tag filter selection correctly narrows the review queue
  to matching sessions (or shows an empty state if none match).

## Assumptions

- The `exclude_from_reviews` flag on a tag definition controls whether
  tagged sessions are excluded from the review queue — it does not
  control whether the tag itself appears in the filter dropdown. The
  tag must still be selectable as a filter even if its tagged sessions
  are excluded from the default review queue.
- The bug is caused by a SQL `HAVING COUNT(...) > 0` clause in the
  tags endpoint that filters out tags with zero session associations.
- No UI changes are needed — the frontend already renders whatever tags
  the API returns; the fix is backend-only.
