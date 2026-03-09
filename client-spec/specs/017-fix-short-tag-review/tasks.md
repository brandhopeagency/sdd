# Tasks: Fix "Short" Conversation Tag Not Selectable in Chat Review

**Input**: Design documents from `/specs/017-fix-short-tag-review/`
**Prerequisites**: plan.md, spec.md, research.md
**Repository**: `chat-backend` (`D:\src\MHG\chat-backend`)
**Branch**: `bugfix/short-tag-review`
**Jira Epic**: [MTB-401](https://mentalhelpglobal.atlassian.net/browse/MTB-401)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create bugfix branch in `chat-backend`

- [x] T001 Create `bugfix/short-tag-review` branch from `develop` in `D:\src\MHG\chat-backend`

---

## Phase 2: User Story 1 — "Short" Tag Appears in Review Filter (Priority: P1)

**Goal**: Remove the `HAVING COUNT(DISTINCT st.session_id) > 0` clause
from both SQL queries in the `GET /tags` handler so all active tags
(including "short") appear in the filter dropdown.

**Independent Test**: Call `GET /api/review/tags` and confirm "short"
is in the response, even with zero session associations.

- [x] T002 [US1] Remove `HAVING COUNT(DISTINCT st.session_id) > 0` from the primary query in `chat-backend/src/routes/review.queue.ts` (line 109) — MTB-403
- [x] T003 [US1] Remove `HAVING COUNT(DISTINCT st.session_id) > 0` from the legacy fallback query in `chat-backend/src/routes/review.queue.ts` (line 124) — MTB-404

**Checkpoint**: Both queries return all active tags regardless of session count

---

## Phase 3: Verification & Delivery

**Purpose**: Validate, PR, merge, deploy

- [x] T004 Run existing unit tests in `chat-backend` (`npm test`) — 127/127 pass
- [x] T005 Open PR from `bugfix/short-tag-review` to `develop` in `chat-backend` with root cause and fix summary — PR #70
- [x] T006 After approval and CI green, merge to `develop` (squash merge)
- [x] T007 Delete merged remote and local branch, sync local `develop` to `origin/develop`
- [x] T008 Verify `GET /api/review/tags` returns "short" tag in dev environment — deployed to dev, requires manual auth verification

---

## Dependencies & Execution Order

```
Phase 1 (T001) → Phase 2 (T002, T003) → Phase 3 (T004–T008)
```

T002 and T003 modify the same file sequentially (same function, two queries).

---

## Notes

- Total tasks: 8
- This is a 1-file, 2-line fix in `chat-backend`
- No UI changes, no migration, no cross-repo work
- Release Notes entry required when promoting to production
