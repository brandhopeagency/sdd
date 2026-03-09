# Quickstart: Chat Moderation and Review System

**Feature Branch**: `003-chat-moderation-review`  
**Date**: 2026-02-10

## Purpose

Validate the end-to-end moderation workflow in split repositories: queue intake, per-message review submission, multi-review aggregation, risk escalation, deanonymization governance, and reviewer/admin dashboards.

## Prerequisites

- Node.js 20+ and npm available in all target repositories.
- Local PostgreSQL or Cloud SQL access for backend migrations.
- Access to split repositories:
  - `D:\src\MHG\chat-types`
  - `D:\src\MHG\chat-backend`
  - `D:\src\MHG\chat-frontend`
  - `D:\src\MHG\chat-ui`
- Test accounts covering roles: reviewer, senior reviewer, moderator, commander, admin.

## 1) Prepare Branches in Split Repositories

```bash
cd D:\src\MHG
for repo in chat-types chat-backend chat-frontend chat-ui; do
  cd $repo
  git checkout develop && git pull
  git checkout -b 003-chat-moderation-review
  cd ..
done
```

## 2) Install Dependencies

```bash
cd D:\src\MHG\chat-types && npm install
cd D:\src\MHG\chat-backend && npm install
cd D:\src\MHG\chat-frontend && npm install
cd D:\src\MHG\chat-ui && npm install
```

## 3) Apply Database Migrations

```bash
cd D:\src\MHG\chat-backend
npm run db:migrate
```

Expected outcomes:
- Review tables are available.
- Escalation and deanonymization tables are available.
- Configuration defaults are seeded.

## 4) Start Services

```bash
cd D:\src\MHG\chat-backend && npm run dev
cd D:\src\MHG\chat-frontend && npm run dev
```

## 5) Execute Core Functional Validation

### A. Reviewer flow

1. Open review queue as reviewer.
2. Filter by status/risk and open a pending session.
3. Score all assistant messages.
4. Submit one low score and verify criterion feedback requirement is enforced.
5. Submit review and verify queue progress increments.

### B. Multi-reviewer flow

1. Complete additional reviews on the same session with other reviewer accounts.
2. Verify session stays in progress until minimum count is reached.
3. Create intentionally divergent scores and verify disputed/tiebreaker flow.

### C. Escalation flow

1. Submit high severity flag with details.
2. Verify escalation visibility for moderator/commander.
3. Acknowledge and resolve with resolution notes.

### D. Deanonymization flow

1. Submit deanonymization request from moderator workflow.
2. Approve/deny as commander.
3. Verify approval/denial event is auditable and time-bounded when approved.

### E. Dashboard flow

1. Review personal statistics as reviewer.
2. Verify team dashboard visibility is restricted to senior+ roles.

## 6) Run Test Suites

```bash
cd D:\src\MHG\chat-backend && npm test
cd D:\src\MHG\chat-frontend && npm test
cd D:\src\MHG\chat-ui && npm run test:e2e
```

## 7) Evidence Checklist

- Queue filters, review submission validation, and status transitions work.
- Dispute and tiebreaker path is verifiable.
- High/medium escalation queues and SLA timestamps are visible.
- Deanonymization request lifecycle enforces role restrictions.
- Audit records are produced for sensitive actions.
- Reviewer and team metrics endpoints return role-appropriate data.
