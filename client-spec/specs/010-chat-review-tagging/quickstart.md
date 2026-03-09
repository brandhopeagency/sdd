# Quickstart: User & Chat Tagging for Review Filtering

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10
**Prerequisites**: Spec 002 (Chat Moderation & Review System) must be set up first.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local or Cloud SQL proxy) with review system tables (migration 013+014 applied)
- Git access to `MentalHelpGlobal` GitHub org
- `GITHUB_TOKEN` with `read:packages` scope (for `@mentalhelpglobal/chat-types`)
- All spec 002 setup complete (review routes mounted, i18n loaded, etc.)

## Repository Setup

### 1. Create feature branches in all affected repositories

```bash
cd D:\src\MHG

for repo in chat-types chat-backend chat-frontend chat-ui chat-client; do
  cd $repo
  git checkout develop && git pull
  git checkout -b 010-chat-review-tagging
  cd ..
done
```

### 2. Install dependencies

```bash
# No new npm packages needed — this feature uses existing dependencies.
# Just ensure all repos are up to date:
for repo in chat-types chat-backend chat-frontend chat-ui chat-client; do
  cd D:\src\MHG\$repo
  npm install
done
```

## Database Setup

### Apply tagging migration (015)

```bash
cd D:\src\MHG\chat-backend
# Ensure DATABASE_URL is set in .env
npm run db:migrate
# This applies 015_add_tagging_system.sql:
#   - Creates tag_definitions, user_tags, session_tags, session_exclusions tables
#   - Adds min_message_threshold column to review_configuration
#   - Seeds "functional QA" and "short" tag definitions
```

### Verify migration

```bash
# Connect to your database and verify:
psql $DATABASE_URL -c "SELECT name, category, exclude_from_reviews FROM tag_definitions;"
# Expected: 2 rows — "functional QA" (user, true) and "short" (chat, true)

psql $DATABASE_URL -c "SELECT min_message_threshold FROM review_configuration WHERE id = 1;"
# Expected: 4
```

## Development Workflow

### Start backend

```bash
cd D:\src\MHG\chat-backend
npm run dev
# Runs on http://localhost:8080
```

### Start frontend

```bash
cd D:\src\MHG\chat-frontend
npm run dev
# Runs on http://localhost:5173
```

### Run tests

```bash
# Backend unit tests
cd D:\src\MHG\chat-backend
npm test

# Frontend unit tests
cd D:\src\MHG\chat-frontend
npm test

# E2E tests (requires running backend + frontend)
cd D:\src\MHG\chat-ui
npm run test:e2e
```

## Key Implementation Steps

### Step 1: Shared Types (chat-types)

1. Create `src/tags.ts` with `TagDefinition`, `UserTag`, `SessionTag`, `SessionExclusion` interfaces
2. Update `src/reviewConfig.ts` — add `minMessageThreshold` to `ReviewConfiguration` and `DEFAULT_REVIEW_CONFIG`
3. Update `src/rbac.ts` — add `TAG_MANAGE`, `TAG_ASSIGN_USER`, `TAG_ASSIGN_SESSION` permissions
4. Update `src/review.ts` — add `tags` and `excluded` params to `ReviewQueueParams`
5. Bump version, build, and publish

```bash
cd D:\src\MHG\chat-types
npm run build
npm publish  # Publishes to GitHub Packages
```

### Step 2: Backend (chat-backend)

1. Create migration `015_add_tagging_system.sql` (see data-model.md)
2. Create tag services:
   - `src/services/tagDefinition.service.ts` — CRUD for tag definitions
   - `src/services/userTag.service.ts` — user-tag assignment/removal
   - `src/services/sessionTag.service.ts` — session-tag management + ad-hoc creation
   - `src/services/sessionExclusion.service.ts` — exclusion evaluation at session ingestion
3. Create tag routes:
   - `src/routes/admin.tags.ts` — Tag definition CRUD (admin)
   - `src/routes/admin.userTags.ts` — User tag assignment (admin/moderator)
   - `src/routes/review.sessionTags.ts` — Session tag management (moderator)
4. Modify existing:
   - `src/routes/review.queue.ts` — Add `tags` and `excluded` query params
   - `src/services/reviewQueue.service.ts` — Integrate exclusion filtering
   - `src/middleware/reviewAuth.ts` — Add tag permission checks
   - `src/index.ts` — Mount new routes
5. Run migration and tests

```bash
cd D:\src\MHG\chat-backend
npm install @mentalhelpglobal/chat-types@latest
npm run db:migrate
npm test
```

### Step 3: Frontend (chat-frontend)

1. Create tag API client: `src/services/tagApi.ts`
2. Create new components:
   - `src/features/workbench/review/components/TagFilter.tsx` — Queue filter
   - `src/features/workbench/review/components/TagBadge.tsx` — Tag display chip
   - `src/features/workbench/review/components/TagInput.tsx` — Add tag combobox
   - `src/features/workbench/review/components/ExcludedTab.tsx` — Excluded sessions view
   - `src/features/workbench/review/TagManagementPage.tsx` — Admin tag CRUD
   - `src/features/workbench/review/UserTagPanel.tsx` — User profile tag panel
3. Modify existing:
   - `ReviewQueueView.tsx` — Add TagFilter, ExcludedTab
   - `ReviewSessionView.tsx` — Display/manage session tags
   - `SessionCard.tsx` — Show tag badges
   - `reviewStore.ts` — Add tag filter state
4. Update i18n: Add tag keys to `locales/en/review.json`, `locales/uk/review.json`, `locales/ru/review.json`
5. Register new route: `/workbench/review/tags` → `TagManagementPage`
6. Run tests

```bash
cd D:\src\MHG\chat-frontend
npm install @mentalhelpglobal/chat-types@latest
npm test
```

### Step 4: E2E Tests (chat-ui)

1. Create `tests/e2e/review/tagging.spec.ts` with scenarios:
   - Admin creates tag, assigns to user, verifies session exclusion
   - Short chat auto-tagged and excluded
   - Moderator adds/removes session tags
   - Tag filter in review queue works correctly
   - Excluded tab shows excluded sessions with reasons

```bash
cd D:\src\MHG\chat-ui
npm run test:e2e
```

### Step 5: Monorepo Sync (chat-client)

1. Mirror all backend changes to `chat-client/server/`
2. Mirror all frontend changes to `chat-client/src/`
3. Mirror type updates to `chat-client/src/types/`
4. Mirror E2E tests to `chat-client/tests/e2e/`
5. Run all tests in monorepo context

```bash
cd D:\src\MHG\chat-client
npm install
npm test
npm run test:e2e
```

## Environment Variables

No new environment variables required. Uses existing backend and frontend configuration from spec 002.

## API Quick Reference

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/admin/tags` | List tag definitions | TAG_MANAGE or TAG_ASSIGN_* |
| POST | `/api/admin/tags` | Create tag definition | TAG_MANAGE |
| PUT | `/api/admin/tags/:id` | Update tag definition | TAG_MANAGE |
| DELETE | `/api/admin/tags/:id` | Delete tag definition | TAG_MANAGE |
| GET | `/api/admin/users/:id/tags` | List user's tags | TAG_ASSIGN_USER |
| POST | `/api/admin/users/:id/tags` | Assign tag to user | TAG_ASSIGN_USER |
| DELETE | `/api/admin/users/:id/tags/:tagId` | Remove tag from user | TAG_ASSIGN_USER |
| GET | `/api/review/sessions/:id/tags` | List session's tags | REVIEW_ACCESS |
| POST | `/api/review/sessions/:id/tags` | Add tag to session | TAG_ASSIGN_SESSION |
| DELETE | `/api/review/sessions/:id/tags/:tagId` | Remove tag from session | TAG_ASSIGN_SESSION |
| GET | `/api/review/tags` | List tags for filter dropdown | REVIEW_ACCESS |
| GET | `/api/review?tags=...&excluded=...` | Queue with tag filtering | REVIEW_ACCESS |
| PUT | `/api/admin/review/config` | Update min message threshold | REVIEW_CONFIGURE |

## Verification Checklist

- [ ] Migration 015 applied (4 new tables + 1 column + 2 seed rows)
- [ ] Tag definition CRUD works at `/api/admin/tags`
- [ ] "functional QA" tag exists and has `exclude_from_reviews = true`
- [ ] User tagged with "functional QA" → their new sessions excluded from queue
- [ ] Chat with <4 messages auto-tagged "short" and excluded
- [ ] Chat with >=4 messages appears in queue normally
- [ ] Tag filter in review queue returns correct results
- [ ] "Excluded" tab shows excluded sessions with reasons
- [ ] Moderator can add/remove tags on sessions (including ad-hoc creation)
- [ ] Admin can create, edit, delete tag definitions
- [ ] Tag management page accessible at `/workbench/review/tags`
- [ ] i18n: tag UI labels render in uk, en, ru
- [ ] All unit tests pass in backend and frontend
- [ ] E2E tests pass for tagging scenarios
- [ ] Monorepo tests pass (dual-target parity)
