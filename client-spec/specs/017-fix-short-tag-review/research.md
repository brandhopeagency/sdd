# Research: Fix "Short" Tag Not Selectable in Chat Review

**Branch**: `017-fix-short-tag-review` | **Date**: 2026-02-24 | **Type**: Bugfix

## Root Cause

The `GET /api/review/tags` endpoint at `chat-backend/src/routes/review.queue.ts:95`
uses two SQL queries (primary + legacy fallback), both containing:

```sql
HAVING COUNT(DISTINCT st.session_id) > 0
```

This clause filters out any tag definition that has zero `session_tags`
associations, even if the tag is active. The "short" tag is auto-applied
by `sessionExclusion.service.ts` only when sessions meet the threshold,
so if no qualifying sessions exist (or all were cleaned up), the tag
has zero associations and is excluded from the dropdown.

## Decision: Remove HAVING Clause

**Rationale**: The `LEFT JOIN` already returns tags with zero associations
as `session_count = 0`. The `HAVING` clause artificially excludes them.
Removing it makes all active tags visible in the filter dropdown while
preserving the correct `session_count` for each.

**Alternatives considered**:

1. *Add a special exception for "short"*: Would fix the immediate bug
   but leave the same problem for any future tag with zero associations.
   Rejected — too narrow.

2. *Change HAVING to >= 0*: Functionally equivalent to removing it, but
   less clear. Rejected — just remove the clause.

3. *Remove HAVING from primary query only*: The legacy fallback query
   has the same issue. Both must be fixed for consistency. Selected:
   remove from both queries.

## Scope

- **Files changed**: 1 (`chat-backend/src/routes/review.queue.ts`)
- **Lines changed**: 2 (remove one `HAVING` line from each query)
- **Risk**: Very low — the query already includes the LEFT JOIN and
  session_count; removing HAVING only adds rows with count=0
- **Tests**: Existing unit tests should still pass; no new test needed
  for a clause removal
