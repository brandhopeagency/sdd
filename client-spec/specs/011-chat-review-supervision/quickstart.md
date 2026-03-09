# Quickstart: Chat Review Supervision & Group Management Enhancements

**Feature**: `011-chat-review-supervision`  
**Branch**: `011-chat-review-supervision`

## Prerequisites

- Node.js 24.x
- PostgreSQL 15+ (or Cloud SQL proxy for dev)
- Access to all target repositories cloned under `D:\src\MHG\`

## Repository Setup

### 1. Create feature branches in all affected repos

```bash
# From each repo directory, create the feature branch from develop
cd D:/src/MHG/chat-types && git checkout develop && git pull && git checkout -b 011-chat-review-supervision
cd D:/src/MHG/chat-backend && git checkout develop && git pull && git checkout -b 011-chat-review-supervision
cd D:/src/MHG/workbench-frontend && git checkout develop && git pull && git checkout -b 011-chat-review-supervision
cd D:/src/MHG/chat-frontend && git checkout develop && git pull && git checkout -b 011-chat-review-supervision
cd D:/src/MHG/chat-ui && git checkout develop && git pull && git checkout -b 011-chat-review-supervision
```

### 2. Start with chat-types

```bash
cd D:/src/MHG/chat-types
npm install

# Add new types, enums, permissions (see data-model.md and research.md)
# Files to modify:
#   src/rbac.ts          - Add SUPERVISOR role + new permissions
#   src/review.ts        - Add SupervisorReview, RAGCallDetail, SupervisionQueueItem types
#   src/reviewConfig.ts  - Add SupervisionPolicy, SupervisionStatus, GroupReviewConfig types
#   src/tags.ts          - Add TAG_CREATE permission type
#   src/index.ts         - Export new types

npm run build
npm test
```

### 3. Update chat-backend

```bash
cd D:/src/MHG/chat-backend
npm install

# Run database migrations (see data-model.md for migration order)
# Files to create:
#   src/db/migrations/xxx_add_supervisor_role.sql
#   src/db/migrations/xxx_add_grade_descriptions.sql
#   src/db/migrations/xxx_add_group_review_config.sql
#   src/db/migrations/xxx_extend_review_config_supervision.sql
#   src/db/migrations/xxx_extend_session_reviews_supervision.sql
#   src/db/migrations/xxx_add_supervisor_reviews.sql

# New services:
#   src/services/supervision.service.ts
#   src/services/gradeDescription.service.ts
#   src/services/ragDetail.service.ts

# New routes:
#   src/routes/review.supervision.ts
#   src/routes/review.gradeDescriptions.ts

# Modified files (see plan.md for full list)

npm test
npm run dev
```

### 4. Update workbench-frontend

```bash
cd D:/src/MHG/workbench-frontend
npm install

# New components (see plan.md for full file list):
#   src/features/workbench/review/SupervisorReviewView.tsx
#   src/features/workbench/review/SupervisorQueueTab.tsx
#   src/features/workbench/review/AwaitingFeedbackTab.tsx
#   src/features/workbench/review/components/SupervisorCommentPanel.tsx
#   src/features/workbench/review/components/ReviewerAssessmentColumn.tsx
#   src/features/workbench/review/components/GradeTooltip.tsx
#   src/features/workbench/review/components/RAGDetailPanel.tsx

# Modified components (see plan.md)

npm test
npm run dev
```

### 5. Update chat-frontend

```bash
cd D:/src/MHG/chat-frontend
npm install

# New/modified:
#   src/features/chat/MessageBubble.tsx     - Add RAG toggle for testers
#   src/features/chat/components/RAGDetailPanel.tsx  - New component

npm test
npm run dev
```

### 6. Run E2E tests

```bash
cd D:/src/MHG/chat-ui
npm install

# Add supervisor test role to fixtures/roles.ts
# Create new test files (see plan.md)

# Run against deployed dev environment
CHAT_BASE_URL=https://dev.mentalhelp.chat \
WORKBENCH_BASE_URL=https://workbench.dev.mentalhelp.chat \
npx playwright test
```

## Dev Environment Verification

After implementing, verify these critical paths:

1. **Supervision flow**: Log in as reviewer → submit review → log in as supervisor → open Awaiting Supervision tab → open review → see 3-column view → approve → verify review status changes
2. **Grade tooltip**: Log in as reviewer → open review session → hover/tap question mark next to score → verify description appears
3. **Criteria checkboxes**: Select score ≤ 7 → verify criteria appear as checkboxes → check 1 → submit → verify only checked criterion saved
4. **Per-group config**: Log in as admin → settings → set group reviewer count override → verify new sessions from group use override
5. **Tag creation restriction**: Log in as reviewer → open tag selector → verify no "create" option. Log in as supervisor → verify "create" is available
6. **RAG details (review)**: Open a session with RAG-enabled responses → expand RAG panel → verify sources shown
7. **RAG details (chat, tester)**: Log in as tester-tagged user → chat → get AI response → verify RAG toggle visible
8. **New user in group**: Log in as group admin → add user → enter new email → fill form → submit → verify account created and user in group

## Localization

All new UI text must have translation keys in all three languages:

- `uk` (Ukrainian) — primary
- `en` (English)
- `ru` (Russian)

Translation files location: `workbench-frontend/src/locales/` and `chat-frontend/src/locales/`

## Key Reference Files

| Artifact | Path |
|----------|------|
| Spec | `client-spec/specs/011-chat-review-supervision/spec.md` |
| Plan | `client-spec/specs/011-chat-review-supervision/plan.md` |
| Research | `client-spec/specs/011-chat-review-supervision/research.md` |
| Data Model | `client-spec/specs/011-chat-review-supervision/data-model.md` |
| Supervision API | `client-spec/specs/011-chat-review-supervision/contracts/supervision-api.yaml` |
| Grade Description API | `client-spec/specs/011-chat-review-supervision/contracts/grade-description-api.yaml` |
| Reviewer Config API | `client-spec/specs/011-chat-review-supervision/contracts/reviewer-config-api.yaml` |
| RAG Detail API | `client-spec/specs/011-chat-review-supervision/contracts/rag-detail-api.yaml` |
| Group User Creation API | `client-spec/specs/011-chat-review-supervision/contracts/group-user-creation-api.yaml` |
