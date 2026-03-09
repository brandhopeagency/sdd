# Quickstart: Chat Moderation & Review System

**Feature Branch**: `002-chat-moderation-review`
**Date**: 2026-02-10

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local or Cloud SQL proxy)
- Git access to `MentalHelpGlobal` GitHub org
- `GITHUB_TOKEN` with `read:packages` scope (for `@mentalhelpglobal/chat-types`)

## Repository Setup

### 1. Clone and branch all affected repositories

```bash
cd D:\src\MHG

# Create feature branches in all repos (from develop)
for repo in chat-types chat-backend chat-frontend chat-ui chat-client; do
  cd $repo
  git checkout develop && git pull
  git checkout -b 002-chat-moderation-review
  cd ..
done
```

### 2. Install dependencies

```bash
# Shared types
cd D:\src\MHG\chat-types
npm install

# Backend
cd D:\src\MHG\chat-backend
npm install

# Frontend
cd D:\src\MHG\chat-frontend
npm install

# E2E tests
cd D:\src\MHG\chat-ui
npm install

# Monorepo
cd D:\src\MHG\chat-client
npm install
```

## Database Setup

### Apply existing review migration

```bash
cd D:\src\MHG\chat-backend
# Ensure DATABASE_URL is set in .env
npm run db:migrate
# This applies 013_add_review_system.sql (creates review tables, seeds config and crisis keywords)
```

### Apply new migration (014)

After creating `014_update_review_defaults_and_notification_status.sql`:

```bash
npm run db:migrate
# Updates deanonymization_access_hours default to 72h
# Adds notification_delivery_status column to risk_flags
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

1. Update `DEFAULT_REVIEW_CONFIG.deanonymizationAccessHours` from 24 to 72
2. Extend `AuditLogEntry.targetType` to include review-specific types
3. Add `notificationDeliveryStatus` field to `RiskFlag` type
4. Bump version, build, and publish

```bash
cd D:\src\MHG\chat-types
npm run build
npm publish  # Publishes to GitHub Packages
```

### Step 2: Backend (chat-backend)

1. Create migration `014_update_review_defaults_and_notification_status.sql`
2. Mount review routes in `src/index.ts` (they exist but are not imported)
3. Complete and verify all service implementations
4. Implement notification retry mechanism (FR-026)
5. Run tests

```bash
cd D:\src\MHG\chat-backend
npm install @mentalhelpglobal/chat-types@latest  # Pick up type updates
npm run db:migrate
npm test
```

### Step 3: Frontend (chat-frontend)

1. Register review i18n namespace in `src/i18n.ts`
2. Verify review routes are registered in React Router
3. Complete component implementations
4. Add WCAG AA accessibility attributes
5. Run tests

```bash
cd D:\src\MHG\chat-frontend
npm install @mentalhelpglobal/chat-types@latest
npm test
```

### Step 4: E2E Tests (chat-ui)

1. Create `tests/e2e/review/` directory
2. Add tests for core review flow, risk flagging, deanonymization
3. Run against dev environment

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

### Backend (.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/mhg_chat
JWT_SECRET=your-jwt-secret
DIALOGFLOW_PROJECT_ID=mental-help-global-25
DIALOGFLOW_AGENT_ID=your-agent-id
PORT=8080
FRONTEND_URL=http://localhost:5173
API_VERSION=1.0.0
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8080/api
```

## Verification Checklist

- [ ] Review migration applied (all 9 tables + session columns)
- [ ] Review routes accessible at `/api/review/*`
- [ ] Queue loads sessions for authenticated reviewer
- [ ] Score submission works with criteria feedback validation
- [ ] Risk flag creates notifications for moderators
- [ ] Deanonymization request → approval → reveal → expiry flow works
- [ ] i18n: review screens render in uk, en, ru
- [ ] All unit tests pass in backend and frontend
- [ ] E2E tests pass for core review flow
- [ ] Monorepo tests pass (dual-target parity)

## API Quick Reference

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/review` | Review queue | REVIEW_ACCESS |
| POST | `/api/review/assign` | Assign session | REVIEW_ASSIGN |
| GET | `/api/review/sessions/:id` | Session detail | REVIEW_ACCESS |
| POST | `/api/review/sessions/:id/start` | Start review | REVIEW_SUBMIT |
| POST | `/api/review/sessions/:id/rate` | Rate message | REVIEW_SUBMIT |
| POST | `/api/review/sessions/:id/submit` | Submit review | REVIEW_SUBMIT |
| GET/POST | `/api/review/sessions/:id/flags` | Flags | REVIEW_FLAG |
| POST | `/api/review/sessions/:id/flags/:fid/resolve` | Resolve flag | REVIEW_ESCALATION |
| GET | `/api/review/deanonymization` | List requests | REVIEW_DEANONYMIZE_* |
| POST | `/api/review/deanonymization/:id/approve` | Approve | REVIEW_DEANONYMIZE_APPROVE |
| POST | `/api/review/deanonymization/:id/deny` | Deny | REVIEW_DEANONYMIZE_APPROVE |
| GET | `/api/review/deanonymization/:id/reveal` | Reveal identity | REVIEW_DEANONYMIZE_REQUEST |
| GET | `/api/review/dashboard/me` | Personal stats | REVIEW_ACCESS |
| GET | `/api/review/dashboard/team` | Team stats | REVIEW_TEAM_DASHBOARD |
| GET | `/api/review/dashboard/banners` | Alert banners | REVIEW_ACCESS |
| GET | `/api/review/notifications` | Notifications | REVIEW_ACCESS |
| POST | `/api/review/notifications/:id/read` | Mark read | REVIEW_ACCESS |
| POST | `/api/review/notifications/read-all` | Mark all read | REVIEW_ACCESS |
| GET | `/api/review/reports` | Report types | REVIEW_REPORTS |
| POST | `/api/review/reports/generate` | Generate report | REVIEW_REPORTS |
| GET | `/api/admin/review/config` | Get config | REVIEW_ACCESS |
| PUT | `/api/admin/review/config` | Update config | REVIEW_CONFIGURE |
