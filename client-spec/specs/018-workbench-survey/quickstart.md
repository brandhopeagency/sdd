# Quickstart: Workbench Survey Module

**Branch**: `018-workbench-survey` | **Date**: 2026-03-03

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 15+ (local or Cloud SQL)
- All target repositories cloned locally:
  - `D:\src\MHG\chat-types`
  - `D:\src\MHG\chat-backend`
  - `D:\src\MHG\workbench-frontend`
  - `D:\src\MHG\chat-frontend`
  - `D:\src\MHG\chat-ui`
- `GITHUB_TOKEN` configured for `@mentalhelpglobal` npm scope

## Setup Order

### 1. Create feature branches

```bash
# In each repository:
cd D:\src\MHG\chat-types && git checkout develop && git pull && git checkout -b 018-workbench-survey
cd D:\src\MHG\chat-backend && git checkout develop && git pull && git checkout -b 018-workbench-survey
cd D:\src\MHG\workbench-frontend && git checkout develop && git pull && git checkout -b 018-workbench-survey
cd D:\src\MHG\chat-frontend && git checkout develop && git pull && git checkout -b 018-workbench-survey
cd D:\src\MHG\chat-ui && git checkout develop && git pull && git checkout -b 018-workbench-survey
```

### 2. chat-types — Add survey types

```bash
cd D:\src\MHG\chat-types
npm install
```

Add survey type definitions to `src/survey.ts` and export from `src/index.ts`. Add new `Permission` enum values for survey operations.

```bash
npm run build
```

### 3. chat-backend — Migration + API

```bash
cd D:\src\MHG\chat-backend
npm install
```

**Apply migration**: Migration is applied via the helper script (requires `DATABASE_URL`):

```bash
node scripts/apply-migration.js 024_create_survey_tables.sql dev
node scripts/apply-migration.js 025_extend_surveys_invalidation_memory.sql dev
```

**Start dev server**:

```bash
npm run dev
```

**Verify migration**:

```sql
-- In psql or any SQL client:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'survey_%';
-- Expected: survey_schemas, survey_instances, survey_responses
```

### 4. workbench-frontend — Survey management UI

```bash
cd D:\src\MHG\workbench-frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173/workbench/surveys/schemas` to see the schema list.

### 5. chat-frontend — Survey gate

```bash
cd D:\src\MHG\chat-frontend
npm install
npm run dev
```

Navigate to `http://localhost:5174/chat`. If active surveys exist for the test user's group, the gate should appear.

### 6. chat-ui — E2E tests

```bash
cd D:\src\MHG\chat-ui
npm install
npx playwright install
```

Set `PLAYWRIGHT_BASE_URL` to the deployed dev environment or local dev server.

```bash
npm run test:e2e -- --grep "survey"
```

## Key Development Flows

### Creating a test survey (dev)

1. Log in to workbench as a Researcher
2. Navigate to Surveys → Schemas
3. Create a schema with a few questions
4. Publish the schema
5. Navigate to Surveys → Instances
6. Create an instance: select the published schema, pick a group, set start date to now, expiration to tomorrow, optionally enable “Add to memory”
7. Wait up to 60 seconds for the instance to auto-activate (note: Cloud Run may scale-to-zero; gate-check also performs idempotent transition checks)
8. Log in to chat as a user in the target group — the gate should appear

### Testing the gate (dev)

1. Ensure an active survey instance targets a group the test user belongs to
2. Open chat as that user — gate blocks
3. Complete the survey — gate dismisses
4. Refresh — chat loads normally

## Environment Variables

### Backend (new)

| Variable | Default | Description |
|----------|---------|-------------|
| `SURVEY_JOB_INTERVAL_SECONDS` | `60` | Polling interval for survey status transitions |

No other new environment variables needed. All new routes use existing auth middleware and database connection.

## Invalidation + Memory (dev sanity)

- In Workbench instance detail, invalidate:
  - instance-wide
  - group-scope
  - individual response
- Expected:
  - invalidated responses excluded from completion counts
  - invalidated completion re-opens gate for affected users while instance is active
  - if “Add to memory” was enabled, memory payload is removed asynchronously and re-added on re-completion

## Rollback

If the migration needs to be rolled back:

```sql
DROP TABLE IF EXISTS survey_responses;
DROP TABLE IF EXISTS survey_instances;
DROP TABLE IF EXISTS survey_schemas;
```

Tables must be dropped in reverse order due to foreign key dependencies.
