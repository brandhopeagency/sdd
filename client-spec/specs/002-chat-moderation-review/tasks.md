# Tasks: Chat Moderation & Review System

**Input**: Design documents from `/specs/002-chat-moderation-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/review-api.yaml

**Tests**: Tests are OPTIONAL per constitution (III). E2E tests are included in the Polish phase as they require full integration.

**Organization**: Tasks are grouped by user story. Most code already exists as scaffold — tasks focus on completing, wiring, verifying, and hardening.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Shared types**: `chat-types/src/`
- **Backend (split)**: `chat-backend/src/`
- **Frontend (split)**: `chat-frontend/src/`
- **E2E tests**: `chat-ui/tests/e2e/`
- **Monorepo backend**: `chat-client/server/src/`
- **Monorepo frontend**: `chat-client/src/`
- **Monorepo E2E**: `chat-client/tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update shared types, create migration, prepare all repos for feature work

- [x] T001 [P] Extend `AuditLogEntry.targetType` union to include `'deanonymization' | 'review' | 'risk_flag' | 'review_config'` in chat-types/src/entities.ts (per research R4)
- [x] T002 [P] Add `notificationDeliveryStatus` field (`'delivered' | 'pending' | 'failed'`) to `RiskFlag` interface in chat-types/src/review.ts (per research R3)
- [x] T003 [P] Update `DEFAULT_REVIEW_CONFIG.deanonymizationAccessHours` from 24 to 72 in chat-types/src/reviewConfig.ts (per research R2)
- [x] T004 Bump version to 1.2.0, build, and publish `@mentalhelpglobal/chat-types` package in chat-types/package.json (depends on T001-T003)
- [x] T005 [P] Create migration `014_update_review_defaults_and_notification_status.sql` in chat-backend/src/db/migrations/ with deanonymization hours update and notification_delivery_status column (per data-model.md Migration 014)
- [x] T006 [P] Update `@mentalhelpglobal/chat-types` dependency to ^1.2.0 in chat-backend/package.json
- [x] T007 [P] Update `@mentalhelpglobal/chat-types` dependency to ^1.2.0 in chat-frontend/package.json
- [x] T008 Mirror type changes from T001-T003 to chat-client/src/types/ (dual-target per Constitution VII)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire up routes, i18n, and frontend routing — MUST complete before ANY user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Import and mount all 8 review route modules in chat-backend/src/index.ts under `/api/review/*` and `/api/admin/review/*` prefixes (per research R1 — routes exist but are NOT mounted)
- [x] T010 [P] Register `review` i18n namespace by importing locales/en/review.json, locales/uk/review.json, locales/ru/review.json as namespace resources in chat-frontend/src/i18n.ts (per research R5)
- [x] T011 [P] Verify and complete review route registration at `/workbench/review/*` in chat-frontend/src/App.tsx (per research R7 — 7 routes with permission guards)
- [x] T012 [P] Verify reviewApi.ts service endpoints match the OpenAPI contract (review-api.yaml) — confirm all 23 endpoints are covered in chat-frontend/src/services/reviewApi.ts
- [x] T013 [P] Verify reviewStore.ts Zustand store has actions for all review workflows (queue, rate, submit, flag, deanonymize) in chat-frontend/src/stores/reviewStore.ts
- [x] T014 Mirror route mounting from T009 to chat-client/server/src/index.ts (dual-target)
- [x] T015 Mirror i18n and route registration from T010-T011 to chat-client/src/ (dual-target)

**Checkpoint**: All review API endpoints accessible, frontend routes navigable, i18n namespaces loaded

---

## Phase 3: User Story 1 — Review AI Chat Responses (Priority: P1) MVP

**Goal**: A reviewer can open the queue, select a session, view the anonymized chat transcript, rate each AI response on a 1-10 scale with optional/required criteria feedback, and submit a completed review.

**Independent Test**: Log in as a QA_SPECIALIST, navigate to `/workbench/review`, select a pending session, rate all AI messages (testing both ≤7 and >7 scores), submit the review, and verify the session's review count increments.

### Implementation for User Story 1

- [x] T016 [US1] Verify and complete `reviewQueue.service.ts` — ensure `getQueueSessions()` returns `QueueSession[]` with anonymized IDs, message count, review status, and language filtering for the authenticated reviewer in chat-backend/src/services/reviewQueue.service.ts
- [x] T017 [US1] Verify and complete `review.queue.ts` route — ensure GET `/api/review` returns paginated queue with basic filtering (status tab) in chat-backend/src/routes/review.queue.ts
- [x] T018 [P] [US1] Verify and complete `anonymization.service.ts` — ensure `getAnonymizedSession()` returns session with USER-XXXX/CHAT-XXXX identifiers and `getAnonymizedMessages()` returns messages with `isReviewable` flag for assistant messages only in chat-backend/src/services/anonymization.service.ts
- [x] T019 [US1] Verify and complete `review.service.ts` — ensure `startReview()` creates a review record with config snapshot and `expires_at`, `rateMessage()` saves score with criteria feedback validation (score ≤ config.criteriaThreshold requires ≥1 criteria with ≥10 chars), and `submitReview()` validates all AI messages rated, computes average score, and increments session review count in chat-backend/src/services/review.service.ts
- [x] T020 [US1] Verify and complete `review.sessions.ts` route — ensure GET `/:sessionId` returns anonymized session+messages+myReview, POST `/:sessionId/start` creates review, POST `/:sessionId/rate` saves rating, POST `/:sessionId/submit` finalizes review in chat-backend/src/routes/review.sessions.ts
- [x] T021 [P] [US1] Verify and complete `ReviewQueueView.tsx` — ensure it fetches and displays queue sessions as SessionCard items with anonymized USER-XXXX, message count, review progress, relative timestamp, and basic tab navigation (Pending/Completed) in chat-frontend/src/features/workbench/review/ReviewQueueView.tsx
- [x] T022 [P] [US1] Verify and complete `SessionCard.tsx` — ensure it displays anonymized session ID (CHAT-XXXX), user ID (USER-XXXX), message count, review status, risk level badge, and relative timestamp in chat-frontend/src/features/workbench/review/components/SessionCard.tsx
- [x] T023 [US1] Verify and complete `ReviewSessionView.tsx` — ensure it loads the anonymized transcript, distinguishes user/assistant messages visually, shows ReviewRatingPanel for each assistant message, tracks rating progress, and enables Submit Review button only when all AI messages are rated in chat-frontend/src/features/workbench/review/ReviewSessionView.tsx
- [x] T024 [P] [US1] Verify and complete `ScoreSelector.tsx` — ensure 1-10 score picker with color-coded labels from SCORE_LABELS, keyboard navigable (arrow keys), ARIA `role="radiogroup"`, visible focus indicator in chat-frontend/src/features/workbench/review/components/ScoreSelector.tsx
- [x] T025 [P] [US1] Verify and complete `CriteriaFeedbackForm.tsx` — ensure it shows 5 criteria fields (relevance, empathy, safety, ethics, clarity) with descriptions from CRITERIA_DEFINITIONS, enforces ≥10 character minimum, conditionally required when score ≤ criteriaThreshold in chat-frontend/src/features/workbench/review/components/CriteriaFeedbackForm.tsx
- [x] T026 [P] [US1] Verify and complete `ReviewRatingPanel.tsx` — ensure it combines ScoreSelector + CriteriaFeedbackForm + optional comment for each AI message, auto-saves on score selection, shows save confirmation in chat-frontend/src/features/workbench/review/ReviewRatingPanel.tsx
- [x] T027 [P] [US1] Verify and complete `ReviewProgress.tsx` — ensure it shows "X of Y messages rated" progress bar and prevents submission until all AI messages are scored in chat-frontend/src/features/workbench/review/components/ReviewProgress.tsx
- [x] T028 [US1] Mirror backend changes from T016-T020 to chat-client/server/src/ (dual-target)
- [x] T029 [US1] Mirror frontend changes from T021-T027 to chat-client/src/ (dual-target)

**Checkpoint**: A reviewer can log in, view the queue, open a session, rate all AI responses with criteria feedback, and submit a review. This is the MVP — stop and validate independently.

---

## Phase 4: User Story 2 — Multi-Reviewer Validation & Score Aggregation (Priority: P1)

**Goal**: Multiple reviewers independently review the same session with blinding enforced. After the minimum required reviews, the system calculates a final score or flags the session as disputed with tiebreaker assignment.

**Independent Test**: Have 3 test reviewers independently review the same session. Verify: reviewers cannot see each other's scores, final score computed on 3rd submission, dispute triggered if variance > 2.0, tiebreaker assigned, individual reviews visible after completion.

### Implementation for User Story 2

- [x] T030 [US2] Verify and complete `reviewScoring.service.ts` — ensure `aggregateScores()` computes final score as average when variance (max-min of reviewer averages) ≤ varianceLimit, flags session as "disputed" when exceeded, assigns tiebreaker reviewer (senior reviewer) when disputed, handles max reviews reached with median fallback per edge cases in chat-backend/src/services/reviewScoring.service.ts
- [x] T031 [US2] Verify blinding enforcement in `review.service.ts` — ensure `getSessionForReview()` returns no other reviewers' individual scores/identities for in-progress sessions, returns only aggregate score after own submission, returns all individual reviews only after session is fully complete in chat-backend/src/services/review.service.ts
- [x] T032 [US2] Verify tiebreaker flow in `review.sessions.ts` — ensure GET `/:sessionId` returns score range (not individual scores) for tiebreaker reviewers viewing disputed sessions, and `submitReview()` re-runs scoring after tiebreaker submission in chat-backend/src/routes/review.sessions.ts
- [x] T033 [US2] Verify and complete `ReviewSessionView.tsx` blinding — ensure reviewer cannot see other reviewers' scores during review, shows only aggregate after own submission, shows all reviews (with ReviewSummary) after session fully complete, shows score range for tiebreaker view in chat-frontend/src/features/workbench/review/ReviewSessionView.tsx
- [x] T034 [US2] Mirror backend changes from T030-T032 to chat-client/server/src/ (dual-target)
- [x] T035 [US2] Mirror frontend changes from T033 to chat-client/src/ (dual-target)

**Checkpoint**: Multi-reviewer blinding, score aggregation, dispute detection, and tiebreaker flow all work. Sessions transition through pending_review → in_review → complete/disputed correctly.

---

## Phase 5: User Story 3 — Risk Flagging & Escalation (Priority: P1)

**Goal**: Reviewers can flag sessions with severity levels; high-risk flags immediately notify moderators/commanders; auto-detection flags crisis keywords; moderators manage the escalation queue. Notification resilience ensures flags are never silently lost.

**Independent Test**: Flag a session at each severity level. Verify: high-risk creates immediate notification with SLA deadline, medium-risk queued for moderator, low-risk logged. Test auto-detection by creating a session with crisis keywords. Verify moderator can acknowledge/resolve flags.

### Implementation for User Story 3

- [x] T036 [P] [US3] Verify and complete `riskFlag.service.ts` — ensure `createFlag()` sets SLA deadline based on severity and config, `createFlag()` with high severity triggers notification delivery with FR-026 resilience pattern (attempt delivery, mark pending if unavailable, track status), auto-flag triggers escalation for scores ≤ 2 (FR-018) and ≤ autoFlagThreshold (FR-025) in chat-backend/src/services/riskFlag.service.ts
- [x] T037 [P] [US3] Verify and complete `crisisDetection.service.ts` — ensure `scanForCrisisKeywords()` checks session messages against active crisis_keywords in all 3 languages (en/uk/ru), returns matched keywords, auto-flags session as high-risk with `is_auto_detected=true` in chat-backend/src/services/crisisDetection.service.ts
- [x] T038 [US3] Implement notification resilience retry mechanism per research R3 — add scheduled retry polling for `notification_delivery_status='pending'` every 60 seconds, escalate to email fallback after 15 minutes in chat-backend/src/services/reviewNotification.service.ts
- [x] T039 [US3] Verify and complete `review.flags.ts` route — ensure GET `/:sessionId/flags` returns flags for session, POST `/:sessionId/flags` creates flag with severity-based SLA and optional deanonymization request, POST `/:sessionId/flags/:flagId/resolve` supports acknowledge/resolve/escalate actions in chat-backend/src/routes/review.flags.ts
- [x] T040 [P] [US3] Verify and complete `RiskFlagDialog.tsx` — ensure severity selector (high/medium/low), reason category dropdown, details textarea, optional "Request user deanonymization" checkbox with justification field, notification delivery status indicator in chat-frontend/src/features/workbench/review/RiskFlagDialog.tsx
- [x] T041 [P] [US3] Verify and complete `EscalationQueue.tsx` — ensure moderator view shows open/acknowledged flags sorted by SLA urgency, supports acknowledge/resolve (with notes)/escalate/request deanonymization actions, shows SLA countdown for each flag in chat-frontend/src/features/workbench/review/EscalationQueue.tsx
- [x] T042 [US3] Mirror backend changes from T036-T039 to chat-client/server/src/ (dual-target)
- [x] T043 [US3] Mirror frontend changes from T040-T041 to chat-client/src/ (dual-target)

**Checkpoint**: Risk flagging works at all severity levels, crisis auto-detection functional, escalation queue operational for moderators, notification resilience ensures no silent failures.

---

## Phase 6: User Story 4 — Queue Management & Assignment (Priority: P2)

**Goal**: Advanced queue features — tab navigation (Pending/Flagged/In Progress/Completed), filtering by risk level/date/language/assignment, priority sorting (risk flags first), manual assignment with 24h reservation, automatic timeout expiry.

**Independent Test**: Populate queue with diverse sessions. Verify tab filtering, risk-level filter, language filter, priority sort order, manual assignment with expiry, timeout behavior for stale reviews.

### Implementation for User Story 4

- [x] T044 [US4] Verify and complete advanced queue logic in `reviewQueue.service.ts` — ensure filtering by tab/riskLevel/dateRange/language/assignedToMe, priority sorting (flagged first, then oldest), language-based filtering using reviewer's qualified languages, workload balancing for auto-distribution, duplicate prevention (FR-017), session hiding for already-reviewed sessions in chat-backend/src/services/reviewQueue.service.ts
- [x] T045 [US4] Verify and complete assignment logic in `reviewQueue.service.ts` — ensure `assignSession()` creates 24h reservation, `expireAssignments()` job runs to expire stale pending/in_progress reviews after timeout_hours, expired reviews return sessions to pool in chat-backend/src/services/reviewQueue.service.ts
- [x] T046 [US4] Verify and complete `review.queue.ts` route — ensure GET `/api/review` supports all filter params (tab, riskLevel, language, dateFrom, dateTo, assignedToMe, sort, page, limit), POST `/api/review/assign` creates manual assignment with REVIEW_ASSIGN permission in chat-backend/src/routes/review.queue.ts
- [x] T047 [US4] Verify and complete `ReviewQueueView.tsx` — ensure all 4 tabs (Pending/Flagged/In Progress/Completed) work, filter bar with risk level, date range, language dropdowns, sort toggle, pagination, assignment button (moderator+ only), accessible table markup with `aria-sort` in chat-frontend/src/features/workbench/review/ReviewQueueView.tsx
- [x] T048 [US4] Mirror backend changes from T044-T046 to chat-client/server/src/ (dual-target)
- [x] T049 [US4] Mirror frontend changes from T047 to chat-client/src/ (dual-target)

**Checkpoint**: Queue shows filtered/sorted sessions across all tabs, manual assignment works with 24h expiry, stale reviews auto-expire.

---

## Phase 7: User Story 5 — Anonymization & Controlled Deanonymization (Priority: P2)

**Goal**: Full anonymization enforced across all review screens. Controlled deanonymization workflow: request → commander approval → time-limited access (72h) → automatic expiry. All events audit-logged for GDPR/Ukrainian DPL compliance.

**Independent Test**: Verify no PII visible anywhere in review UI. Submit a deanonymization request, approve as commander, verify 72h time-limited access, verify audit log entries for every event.

### Implementation for User Story 5

- [x] T050 [US5] Verify and complete `anonymization.service.ts` — ensure deterministic USER-XXXX/CHAT-XXXX mapping via anonymous_mappings table, PII scrubbing from all API responses, no real names/emails leak in any review endpoint in chat-backend/src/services/anonymization.service.ts
- [x] T051 [US5] Verify and complete `deanonymization.service.ts` — ensure `createRequest()` links to risk flag, `approveRequest()` sets access_expires_at to NOW()+72h (configurable), `denyRequest()` records denial notes, `getRevealedIdentity()` checks expiry and returns real identity, `expireAccess()` job revokes expired access, all state transitions create AuditLogEntry with extended target types in chat-backend/src/services/deanonymization.service.ts
- [x] T052 [US5] Verify and complete `review.deanonymization.ts` route — ensure GET lists requests (filtered by status/role), POST `/:requestId/approve` and `/:requestId/deny` with permission guards (REVIEW_DEANONYMIZE_APPROVE), GET `/:requestId/reveal` returns identity only for approved non-expired requests by original requester in chat-backend/src/routes/review.deanonymization.ts
- [x] T053 [US5] Verify and complete `DeanonymizationPanel.tsx` — ensure commander view shows pending requests with justification, approve/deny actions with confirmation dialogs, requester view shows request status and revealed identity (when approved), 72h countdown timer, access expiry indicator in chat-frontend/src/features/workbench/review/DeanonymizationPanel.tsx
- [x] T054 [US5] Mirror backend changes from T050-T052 to chat-client/server/src/ (dual-target)
- [x] T055 [US5] Mirror frontend changes from T053 to chat-client/src/ (dual-target)

**Checkpoint**: Full anonymization enforced, deanonymization request-approve-reveal-expire flow works, all events in audit log.

---

## Phase 8: User Story 6 — Reviewer Dashboard & Statistics (Priority: P2)

**Goal**: Personal reviewer dashboard showing reviews completed, average score, agreement rate, score distribution, weekly trends, criteria feedback counts. Team dashboard for senior reviewers+ showing team metrics and workload balance.

**Independent Test**: Create reviewer with historical review data. Verify personal dashboard shows correct stats for each time period. Verify team dashboard shows inter-rater reliability and workload.

### Implementation for User Story 6

- [x] T056 [US6] Verify and complete `reviewDashboard.service.ts` — ensure `getReviewerStats()` calculates reviews completed, average score given, agreement rate (% of scores within varianceLimit of session median), score distribution buckets, criteria feedback counts, weekly trend data for selected period (today/week/month/all) in chat-backend/src/services/reviewDashboard.service.ts
- [x] T057 [US6] Verify and complete `reviewDashboard.service.ts` team stats — ensure `getTeamStats()` calculates total reviews, average team score, inter-rater reliability coefficient, pending escalations count, pending deanonymizations count, per-reviewer workload breakdown, queue depth breakdown for senior reviewer+ in chat-backend/src/services/reviewDashboard.service.ts
- [x] T058 [US6] Verify and complete `review.dashboard.ts` route — ensure GET `/me` returns ReviewerDashboardStats with period param, GET `/team` returns TeamDashboardStats with REVIEW_TEAM_DASHBOARD permission, GET `/banners` returns BannerAlerts counts in chat-backend/src/routes/review.dashboard.ts
- [x] T059 [P] [US6] Verify and complete `ReviewDashboard.tsx` — ensure personal stats display with period filter (today/week/month/all), ScoreDistribution chart, agreement rate metric, weekly trends, criteria feedback breakdown in chat-frontend/src/features/workbench/review/ReviewDashboard.tsx
- [x] T060 [P] [US6] Verify and complete `TeamDashboard.tsx` — ensure team metrics display with reviewer workload table, inter-rater reliability, queue depth breakdown, pending escalation/deanonymization counts in chat-frontend/src/features/workbench/review/TeamDashboard.tsx
- [x] T061 [P] [US6] Verify and complete `ScoreDistribution.tsx` — ensure visual chart of score distribution buckets (outstanding/good/adequate/poor/unsafe) with accessible color+text labels in chat-frontend/src/features/workbench/review/components/ScoreDistribution.tsx
- [x] T062 [US6] Mirror backend changes from T056-T058 to chat-client/server/src/ (dual-target)
- [x] T063 [US6] Mirror frontend changes from T059-T061 to chat-client/src/ (dual-target)

**Checkpoint**: Personal and team dashboards display correct statistics with period filtering.

---

## Phase 9: User Story 7 — Admin Configuration (Priority: P3)

**Goal**: Admins can view and update all review system configuration values through a dedicated interface. Changes apply to new reviews only.

**Independent Test**: Log in as OWNER, navigate to config page, change minReviews from 3 to 4, verify new sessions require 4 reviews while in-progress sessions retain 3. Verify non-admin users denied access.

### Implementation for User Story 7

- [x] T064 [US7] Verify and complete `reviewConfig.service.ts` — ensure `getConfig()` returns current singleton row, `updateConfig()` partially updates specified fields only, records `updated_by` actor and `updated_at` timestamp, creates audit log entry for config changes in chat-backend/src/services/reviewConfig.service.ts
- [x] T065 [US7] Verify and complete `admin.reviewConfig.ts` route — ensure GET `/api/admin/review/config` returns config (REVIEW_ACCESS permission), PUT `/api/admin/review/config` updates config (REVIEW_CONFIGURE permission, Owner only), validates input ranges in chat-backend/src/routes/admin.reviewConfig.ts
- [x] T066 [US7] Verify and complete `ReviewConfigPage.tsx` — ensure form displays all configurable fields with current values, input validation (min/max ranges), save button, success/error feedback, permission-gated (REVIEW_CONFIGURE only) in chat-frontend/src/features/workbench/review/ReviewConfigPage.tsx
- [x] T067 [US7] Mirror backend changes from T064-T065 to chat-client/server/src/ (dual-target)
- [x] T068 [US7] Mirror frontend changes from T066 to chat-client/src/ (dual-target)

**Checkpoint**: Admin config page functional with proper permission gating and audit logging.

---

## Phase 10: User Story 8 — Notifications & Alerts (Priority: P3)

**Goal**: In-app notifications for review events (assignments, expiry reminders, flag alerts, deanonymization updates, dispute alerts). Persistent banner alerts for moderators (high-risk escalations) and commanders (deanonymization requests). Email delivery for high-risk events.

**Independent Test**: Trigger each notification type and verify correct recipients receive in-app notifications. Verify banners appear for moderators/commanders with correct counts. Verify email sent for high-risk flags.

### Implementation for User Story 8

- [x] T069 [US8] Verify and complete `reviewNotification.service.ts` — ensure notification creation for all event types (review_assigned, assignment_expiring, high_risk_flag, medium_risk_flag, deanonymization_requested/resolved, dispute_detected, review_complete), email integration for high-risk events using existing email service in chat-backend/src/services/reviewNotification.service.ts
- [x] T070 [US8] Implement assignment expiry reminder job — schedule check for reviews expiring within 4 hours, create `assignment_expiring` notification for affected reviewers in chat-backend/src/services/reviewNotification.service.ts
- [x] T071 [US8] Verify and complete `review.notifications.ts` route — ensure GET returns paginated notifications (unreadOnly filter), POST `/:notificationId/read` marks single as read, POST `/read-all` marks all as read in chat-backend/src/routes/review.notifications.ts
- [x] T072 [P] [US8] Verify and complete `NotificationBell.tsx` — ensure unread count badge, dropdown list of recent notifications, mark-read on click, mark-all-read action, real-time or polling refresh in chat-frontend/src/features/workbench/review/components/NotificationBell.tsx
- [x] T073 [P] [US8] Verify and complete `BannerAlerts.tsx` — ensure moderators see persistent banner with high-risk escalation count (`role="alert"`), commanders see pending deanonymization count, both with link to respective queue, `aria-live="polite"` for count updates in chat-frontend/src/features/workbench/review/components/BannerAlerts.tsx
- [x] T074 [US8] Mirror backend changes from T069-T071 to chat-client/server/src/ (dual-target)
- [x] T075 [US8] Mirror frontend changes from T072-T073 to chat-client/src/ (dual-target)

**Checkpoint**: All notification types fire correctly, banners visible for appropriate roles, email delivery works for high-risk events.

---

## Phase 11: User Story 9 — Reporting & Analytics (Priority: P3)

**Goal**: Generate daily summary, weekly performance, monthly quality, and escalation reports. Support export in CSV, PDF, and JSON formats.

**Independent Test**: Generate each report type with date range and verify content accuracy. Export in all 3 formats and verify correct output.

### Implementation for User Story 9

- [x] T076 [US9] Verify and complete `reviewReport.service.ts` — ensure `generateReport()` supports all 4 report types (daily_summary: reviews completed + queue depth + escalation count; weekly_performance: per-reviewer stats; monthly_quality: score distributions + inter-rater trends + common criteria issues; escalation_report: flags by severity/status/SLA compliance) in chat-backend/src/services/reviewReport.service.ts
- [x] T077 [US9] Implement report export formatting — ensure JSON returns structured data, CSV generates downloadable file via response stream, PDF generates formatted document (use existing GCS service for temp storage if needed) in chat-backend/src/services/reviewReport.service.ts
- [x] T078 [US9] Verify and complete `review.reports.ts` route — ensure GET `/api/review/reports` lists available report types (REVIEW_REPORTS permission), POST `/api/review/reports/generate` accepts type/format/dateRange and returns report content with correct Content-Type headers in chat-backend/src/routes/review.reports.ts
- [x] T079 [US9] Create report viewing UI — add report generation page with type selector, date range picker, format dropdown, generate button, and download/preview area under `/workbench/review/reports` in chat-frontend/src/features/workbench/review/ (new component or extend existing)
- [x] T080 [US9] Mirror backend changes from T076-T078 to chat-client/server/src/ (dual-target)
- [x] T081 [US9] Mirror frontend changes from T079 to chat-client/src/ (dual-target)

**Checkpoint**: All 4 report types generate with correct data, export works in CSV/PDF/JSON.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, i18n completeness, error handling, E2E tests, and dual-target parity verification

- [x] T082 [P] Accessibility audit — verify WCAG AA compliance across all review components: ScoreSelector keyboard navigation and ARIA, CriteriaFeedbackForm labels and error linking, queue table semantic markup, BannerAlerts role="alert", color contrast for score labels (4.5:1 minimum), focus management in dialogs in chat-frontend/src/features/workbench/review/
- [x] T083 [P] i18n completeness verification — verify all user-visible strings in review components use `t('review:key')` pattern, no hardcoded English text, verify locales/en/review.json, locales/uk/review.json, locales/ru/review.json have all required keys with translations in chat-frontend/src/locales/
- [x] T084 [P] Verify `ReviewErrorBoundary.tsx` wraps all review routes with error fallback UI, handles API errors gracefully, and provides retry actions in chat-frontend/src/features/workbench/review/ReviewErrorBoundary.tsx
- [x] T085 [P] Add E2E test for core review flow — reviewer login → queue → select session → rate messages → submit review in chat-ui/tests/e2e/review/review-flow.spec.ts
- [x] T086 [P] Add E2E test for risk flagging — reviewer flags session with high severity → moderator sees escalation → moderator resolves in chat-ui/tests/e2e/review/risk-flagging.spec.ts
- [x] T087 [P] Add E2E test for deanonymization — reviewer requests deano → commander approves → requester views revealed identity → verify audit log in chat-ui/tests/e2e/review/deanonymization.spec.ts
- [x] T088 Dual-target parity verification — run tests in both split repos and chat-client monorepo, confirm functionally equivalent behavior across all 9 user stories in chat-client/
- [x] T089 Mirror E2E tests from T085-T087 to chat-client/tests/e2e/review/ (dual-target)
- [x] T090 Run quickstart.md validation — follow the verification checklist in specs/002-chat-moderation-review/quickstart.md to confirm end-to-end system readiness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T004 (types published) and T005 (migration created) — BLOCKS all user stories
- **User Stories (Phase 3-11)**: All depend on Foundational phase completion
  - P1 stories (US1, US2, US3) should be completed first
  - P2 stories (US4, US5, US6) follow P1
  - P3 stories (US7, US8, US9) follow P2
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational — builds on US1 review service (shared service file) but independently testable
- **US3 (P1)**: Can start after Foundational — no dependencies on US1/US2 for flagging; notification of scores ≤ 2 integrates with US1's rating flow
- **US4 (P2)**: Can start after Foundational — extends US1's queue with advanced features
- **US5 (P2)**: Can start after Foundational — integrates with US3's flag form for deanonymization requests
- **US6 (P2)**: Can start after Foundational — requires review data from US1/US2 for stats
- **US7 (P3)**: Can start after Foundational — independent config CRUD
- **US8 (P3)**: Can start after Foundational — integrates with US3 flags, US4 assignments, US5 deanonymization for notification triggers
- **US9 (P3)**: Can start after Foundational — aggregates data from all other stories

### Cross-Repository Execution Order

```
1. chat-types (T001-T004)      → Publish first
2. chat-backend (T005-T006, T009, then user story tasks)
3. chat-frontend (T007, T010-T013, then user story tasks)
4. chat-ui (T085-T087)         → After backend + frontend complete
5. chat-client (T008, T014-T015, then dual-target mirrors)
```

### Within Each User Story

1. Backend service verification/completion FIRST
2. Backend route verification/completion
3. Frontend component verification/completion (can parallel within story)
4. Dual-target mirror LAST (for that story)

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all parallel (different files in chat-types)
- **Phase 2**: T010, T011, T012, T013 all parallel (different frontend files)
- **Each story**: Frontend components marked [P] can be worked in parallel
- **Across stories**: After Foundational, different developers can work US1/US2/US3 in parallel
- **Dual-target**: Mirror tasks can be batched per repo after source changes stabilize

---

## Parallel Example: User Story 1

```bash
# After Phase 2 complete, launch backend tasks:
Task T016: "Verify reviewQueue.service.ts"
Task T018: "Verify anonymization.service.ts"  # [P] - different file

# After T016/T018 done, launch T019 (depends on both services)
Task T019: "Verify review.service.ts"

# In parallel with backend, launch independent frontend tasks:
Task T021: "Verify ReviewQueueView.tsx"        # [P]
Task T022: "Verify SessionCard.tsx"            # [P]
Task T024: "Verify ScoreSelector.tsx"          # [P]
Task T025: "Verify CriteriaFeedbackForm.tsx"   # [P]
Task T026: "Verify ReviewRatingPanel.tsx"      # [P]
Task T027: "Verify ReviewProgress.tsx"         # [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + migration)
2. Complete Phase 2: Foundational (route mounting + i18n + frontend routes)
3. Complete Phase 3: User Story 1 (core review flow)
4. **STOP and VALIDATE**: A reviewer can log in, view queue, rate AI messages, submit review
5. Deploy to dev environment for stakeholder demo

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Review) → Test → Deploy (MVP!)
3. US2 (Multi-reviewer) + US3 (Risk flags) → Test → Deploy (P1 complete!)
4. US4 (Queue) + US5 (Deanonymization) + US6 (Dashboard) → Test → Deploy (P2 complete!)
5. US7 (Config) + US8 (Notifications) + US9 (Reports) → Test → Deploy (P3 complete!)
6. Polish (Accessibility, E2E, Parity) → Final release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Review) → then US4 (Queue)
   - Developer B: US2 (Scoring) → then US5 (Deanonymization)
   - Developer C: US3 (Risk flags) → then US6 (Dashboard)
3. P3 stories and Polish distributed as team becomes available
4. Dual-target mirrors can be batched after each priority tier

---

## Notes

- All tasks reference EXISTING files — "verify and complete" means: read the existing code, compare against spec acceptance scenarios, add missing logic, fix bugs
- [P] tasks = different files, no dependencies — safe to parallelize
- [Story] label maps task to specific user story for traceability
- Dual-target mirror tasks (T008, T014-T015, T028-T029, etc.) should be done AFTER the source changes are verified working
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
