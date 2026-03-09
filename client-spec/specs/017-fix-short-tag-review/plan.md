# Implementation Plan: Fix "Short" Tag Not Selectable in Chat Review

**Branch**: `017-fix-short-tag-review` | **Date**: 2026-02-24 | **Spec**: [spec.md](spec.md)
**Jira Epic**: [MTB-401](https://mentalhelpglobal.atlassian.net/browse/MTB-401)

## Summary

The `GET /api/review/tags` endpoint excludes tags with zero session
associations due to a `HAVING COUNT(...) > 0` clause. Removing this
clause from both the primary and legacy fallback queries makes all
active tags (including "short") visible in the filter dropdown.

## Technical Context

**Language/Version**: TypeScript / Node.js (Express.js)
**Primary Dependencies**: Express.js, `pg` (PostgreSQL driver)
**Storage**: PostgreSQL (Cloud SQL)
**Testing**: Vitest
**Target Platform**: GCP Cloud Run
**Project Type**: Web application (split repositories)
**Constraints**: Single-file, two-line fix

## Constitution Check

- [x] Spec-first workflow preserved
- [x] Affected split repositories listed: `chat-backend` only
- [x] Test strategy: Vitest unit tests in chat-backend
- [x] PR-only merges into `develop` from bugfix branch
- [x] Post-merge hygiene defined
- [x] User-facing changes: N/A (backend-only, no UI changes)
- [x] Post-deploy smoke checks: verify `GET /api/review/tags` returns
      the "short" tag
- [x] Jira Epic: MTB-401
- [x] Documentation impact: Release Notes entry when promoting to production;
      no User Manual or Technical Onboarding changes needed
- [x] Release readiness: chat-backend has deploy workflows for dev and prod

## Project Structure

### Source Code (affected)

```text
chat-backend/
└── src/
    └── routes/
        └── review.queue.ts   # GET /tags endpoint (lines 102-110, 117-126)
```

## Fix

Remove the `HAVING COUNT(DISTINCT st.session_id) > 0` line from both
SQL queries in the `GET /tags` handler:

**Primary query** (line 109):
```sql
-- REMOVE THIS LINE:
HAVING COUNT(DISTINCT st.session_id) > 0
```

**Legacy fallback query** (line 124):
```sql
-- REMOVE THIS LINE:
HAVING COUNT(DISTINCT st.session_id) > 0
```

The `WHERE td.is_active = true` clause already ensures only active tags
are returned. The `LEFT JOIN` + `COUNT` already produces `session_count = 0`
for tags without associations. No other changes needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tags with zero sessions clutter the dropdown | Low | Low | Acceptable — users benefit from seeing all available filter options |

## Rollback Plan

Revert the single file change — re-add the `HAVING` clause to both queries.

## Verification

1. Run `npm test` in chat-backend — all tests pass
2. Deploy to dev — call `GET /api/review/tags` and confirm "short" appears
3. Open workbench review interface — confirm "short" is in the tag dropdown
