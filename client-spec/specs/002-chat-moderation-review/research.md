# Research: Chat Moderation & Review System

**Feature Branch**: `002-chat-moderation-review`
**Date**: 2026-02-10

## Research Summary

The review system scaffold is already implemented across `chat-types`, `chat-backend`, and `chat-frontend`. Research focuses on closing implementation gaps, confirming architectural decisions, and resolving unknowns from the Technical Context.

---

## R1: Route Mounting Strategy

**Decision**: Mount all review routes under `/api/review` prefix in `chat-backend/src/index.ts` with a single import block.

**Rationale**: The existing routes follow a consistent pattern (`review.queue.ts`, `review.sessions.ts`, etc.) with `reviewAuth` middleware applied internally. Mounting under `/api/review` maintains consistency with existing `/api/admin`, `/api/auth`, `/api/chat` prefixes in `index.ts`.

**Alternatives considered**:
- Mount each review route file separately under distinct paths → Rejected: inconsistent with existing pattern; all review routes share `reviewAuth` base middleware
- Mount behind a feature flag → Rejected: feature is committed for delivery; flag adds unnecessary complexity

**Implementation**:

```typescript
// In index.ts
import reviewQueueRouter from './routes/review.queue';
import reviewSessionsRouter from './routes/review.sessions';
import reviewFlagsRouter from './routes/review.flags';
import reviewDeanonymizationRouter from './routes/review.deanonymization';
import reviewDashboardRouter from './routes/review.dashboard';
import reviewNotificationsRouter from './routes/review.notifications';
import reviewReportsRouter from './routes/review.reports';
import adminReviewConfigRouter from './routes/admin.reviewConfig';

app.use('/api/review', reviewQueueRouter);
app.use('/api/review/sessions', reviewSessionsRouter);
app.use('/api/review/sessions', reviewFlagsRouter);       // nested under sessions/:sessionId/flags
app.use('/api/review/deanonymization', reviewDeanonymizationRouter);
app.use('/api/review/dashboard', reviewDashboardRouter);
app.use('/api/review/notifications', reviewNotificationsRouter);
app.use('/api/review/reports', reviewReportsRouter);
app.use('/api/admin/review', adminReviewConfigRouter);
```

---

## R2: Deanonymization Access Duration Migration

**Decision**: Create migration `014_update_deanonymization_hours.sql` to change the default `deanonymization_access_hours` from 24 to 72 in both the table default and the seeded configuration row.

**Rationale**: Spec clarification confirmed 72-hour default to accommodate weekend/cross-timezone scenarios. The existing `DEFAULT_REVIEW_CONFIG` in `chat-types/src/reviewConfig.ts` also needs updating from 24 to 72.

**Alternatives considered**:
- Update only the seeded row, not the column default → Rejected: column default and seed should match to prevent drift
- Make this a config-only change (no migration) → Rejected: DB default must reflect the operational default for new installations

**Implementation**:

```sql
-- 014_update_deanonymization_hours.sql
BEGIN;
ALTER TABLE review_configuration
    ALTER COLUMN deanonymization_access_hours SET DEFAULT 72;
UPDATE review_configuration
    SET deanonymization_access_hours = 72
    WHERE id = 1 AND deanonymization_access_hours = 24;
COMMIT;
```

---

## R3: Notification Resilience Pattern (FR-026)

**Decision**: Implement a notification outbox pattern with scheduled retry and escalation.

**Rationale**: FR-026 requires that high-risk flags are persisted independently of notification delivery, with a "notification pending" status visible to the reviewer, automatic retry, and escalating alerts if delivery fails after 15 minutes.

**Design**:

1. **Outbox table**: Add `notification_delivery_status` column to `risk_flags` table with values: `'delivered' | 'pending' | 'failed'`
2. **Immediate attempt**: When a high-risk flag is saved, attempt notification delivery synchronously. If successful, mark `delivered`. If the Notification Service is unavailable, mark `pending`.
3. **Retry loop**: A scheduled job (Cloud Run Jobs or `setInterval` in the backend process) polls for `pending` notifications every 60 seconds and retries delivery.
4. **Escalation**: If a notification remains `pending` for >15 minutes (configurable), trigger email fallback directly via the email service (bypassing the Notification Service) to moderators and commanders.
5. **Frontend indicator**: The `RiskFlag` response includes `notificationDeliveryStatus` so the UI can display "notification pending" or "delivered" to the submitting reviewer.

**Alternatives considered**:
- External message queue (Cloud Pub/Sub) → Rejected: adds infrastructure dependency for a narrow use case; the review backend can handle retry in-process
- Block submission until notification confirmed → Rejected: delays reviewer workflow; spec explicitly chose non-blocking approach
- Fire-and-forget with no tracking → Rejected: violates FR-026 explicit requirement for pending status visibility

**Implementation**:

```sql
-- In migration 014
ALTER TABLE risk_flags
    ADD COLUMN IF NOT EXISTS notification_delivery_status VARCHAR(10)
    DEFAULT 'pending'
    CHECK (notification_delivery_status IN ('delivered', 'pending', 'failed'));
```

---

## R4: Audit Log Target Type Extension

**Decision**: Extend `AuditLogEntry.targetType` in `chat-types` to include review-specific target types.

**Rationale**: The existing `targetType` union is `'user' | 'session' | 'message'`. The review system needs audit logging for deanonymization events (CR-002, FR-012), configuration changes, and risk flag actions. These require distinct target types for query filtering.

**Implementation**:

```typescript
// In entities.ts
export interface AuditLogEntry extends BaseEntity {
  actorId: string;
  action: string;
  targetType: 'user' | 'session' | 'message' | 'deanonymization' | 'review' | 'risk_flag' | 'review_config';
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
}
```

**Alternatives considered**:
- Use generic `'review'` for all review audit events → Rejected: loses query specificity for compliance reporting
- Create a separate `review_audit_log` table → Rejected: duplicates audit infrastructure; single audit log with extended types is simpler

---

## R5: i18n Namespace Loading

**Decision**: Register `review` as a separate i18n namespace loaded on demand via i18next's namespace support.

**Rationale**: The review locale files (`locales/en/review.json`, `locales/uk/review.json`, `locales/ru/review.json`) already exist but are not loaded by `i18n.ts`. Using namespaces keeps the main locale bundle small and loads review translations only when the review module is accessed.

**Implementation**:

```typescript
// In i18n.ts — add review namespace resources
import enReview from './locales/en/review.json';
import ukReview from './locales/uk/review.json';
import ruReview from './locales/ru/review.json';

// In the i18n.init() resources config:
resources: {
  uk: { translation: uk, review: ukReview },
  en: { translation: en, review: enReview },
  ru: { translation: ru, review: ruReview }
}
// Add 'review' to ns array and set defaultNS: 'translation'
```

**Usage in components**: `const { t } = useTranslation('review');`

**Alternatives considered**:
- Merge review translations into main locale files → Rejected: increases initial bundle for all users; review is a specialized module
- Lazy-load namespaces via i18next-http-backend → Rejected: adds HTTP dependency; static imports are simpler for 3 locale files

---

## R6: RBAC Role Mapping

**Decision**: Map spec review roles to existing `UserRole` enum values. No new roles needed.

**Rationale**: The existing RBAC system already maps review permissions to system roles:

| Spec Role | System Role (`UserRole`) | Key Review Permissions |
|-----------|-------------------------|----------------------|
| Reviewer | `QA_SPECIALIST` | `REVIEW_ACCESS`, `REVIEW_SUBMIT`, `REVIEW_FLAG` |
| Senior Reviewer | `RESEARCHER` | + `REVIEW_TIEBREAK`, `REVIEW_TEAM_DASHBOARD` |
| Moderator | `MODERATOR` | + `REVIEW_ESCALATION`, `REVIEW_ASSIGN`, `REVIEW_DEANONYMIZE_REQUEST` |
| Commander | `GROUP_ADMIN` | + `REVIEW_DEANONYMIZE_APPROVE`, `REVIEW_COMMANDER_DASHBOARD` |
| Admin | `OWNER` | All permissions (includes `REVIEW_CONFIGURE`, `REVIEW_REPORTS`) |

This mapping is already implemented in `chat-types/src/rbac.ts` `ROLE_PERMISSIONS` constant. No changes needed.

**Alternatives considered**:
- Add dedicated review roles (e.g., `REVIEWER`, `SENIOR_REVIEWER`) → Rejected: would require DB migration on users table, role reassignment, and break existing RBAC infrastructure. Current mapping is sufficient and already implemented.

---

## R7: Frontend Route Registration

**Decision**: Register review pages under the existing workbench route tree at `/workbench/review/*`.

**Rationale**: The review components live in `features/workbench/review/`. The workbench is the existing admin/management interface. Review pages should be nested under it with permission-gated routes.

**Routes**:

| Path | Component | Permission Required |
|------|-----------|-------------------|
| `/workbench/review` | `ReviewQueueView` | `REVIEW_ACCESS` |
| `/workbench/review/session/:id` | `ReviewSessionView` | `REVIEW_ACCESS` |
| `/workbench/review/dashboard` | `ReviewDashboard` | `REVIEW_ACCESS` |
| `/workbench/review/team` | `TeamDashboard` | `REVIEW_TEAM_DASHBOARD` |
| `/workbench/review/escalations` | `EscalationQueue` | `REVIEW_ESCALATION` |
| `/workbench/review/deanonymization` | `DeanonymizationPanel` | `REVIEW_DEANONYMIZE_APPROVE` |
| `/workbench/review/config` | `ReviewConfigPage` | `REVIEW_CONFIGURE` |

**Alternatives considered**:
- Top-level `/review` route → Rejected: breaks workbench navigation pattern; review is a workbench feature

---

## R8: Score Variance Calculation

**Decision**: Use population variance (not sample variance) for the score variance threshold.

**Rationale**: The variance threshold (default 2.0 points) is compared against the spread of reviewer scores for a session. With a small number of reviewers (typically 3-5), population variance is more appropriate than sample variance. The spec uses "score variance" which in this context means the range (max - min) of average scores across reviewers, compared against the `varianceLimit` threshold.

**Calculation**: `variance = max(reviewer_avg_scores) - min(reviewer_avg_scores)`

If `variance > config.varianceLimit` → session is "disputed".

**Alternatives considered**:
- Standard deviation → Rejected: with 3-5 data points, SD is less intuitive than range; the configurable threshold (default 2.0) is specified in the same unit as scores
- Mean absolute deviation → Rejected: more complex for no benefit with small N

---

## R9: Notification Service Integration

**Decision**: Use the existing email service for push/email notifications; implement in-app notifications via the existing `review_notifications` table.

**Rationale**: The spec assumes a Notification Service exists. The backend already has email service providers (`services/email/`). In-app notifications are handled by the `review_notifications` DB table. Push notifications can be deferred to P3 (US8) or implemented via Firebase Cloud Messaging when ready.

**Channel mapping**:

| Event | In-app | Email | Push |
|-------|--------|-------|------|
| High-risk flag | Yes | Yes | Deferred (P3) |
| Medium-risk flag | Yes | No | No |
| Review assignment | Yes | No | No |
| Assignment expiring | Yes | No | No |
| Deanonymization request/resolution | Yes | Yes | No |
| Dispute detected | Yes | No | No |

**Alternatives considered**:
- Integrate Firebase Cloud Messaging for push from day one → Rejected: adds complexity; push is P3 (US8); email covers urgent notifications adequately for P1
- Use Cloud Pub/Sub for event-driven notifications → Rejected: overengineered for current scale; direct service calls sufficient

---

## R10: Accessibility Requirements

**Decision**: Implement WCAG AA compliance following existing frontend patterns with specific focus areas for the review module.

**Rationale**: Constitution VI mandates WCAG AA. The review module has specific accessibility needs due to its rating interface and data-dense dashboards.

**Key requirements**:
1. **Score selector**: Keyboard navigable (arrow keys), visible focus indicator, ARIA `role="radiogroup"` with score labels announced
2. **Criteria feedback form**: Labels associated with inputs, error messages linked via `aria-describedby`, minimum character count announced
3. **Queue table**: Proper `<table>` markup with `<th scope>`, sortable columns with `aria-sort`, filter controls labeled
4. **Banners**: `role="alert"` for high-risk notifications, `aria-live="polite"` for queue updates
5. **Color coding**: Score colors meet 4.5:1 contrast ratio; never rely on color alone (always paired with text label)
6. **Keyboard navigation**: Tab order follows visual layout; modal dialogs trap focus; Escape closes dialogs

**Alternatives considered**:
- Custom accessibility audit tool integration → Deferred: manual + automated testing (axe-core) in E2E is sufficient for initial launch
