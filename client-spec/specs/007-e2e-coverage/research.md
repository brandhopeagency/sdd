# Research: E2E Test Coverage Expansion

**Feature**: 007-e2e-coverage | **Date**: 2026-02-08

## R1: Test Data Seeding Strategy

### Decision

Use an idempotent SQL seed script (`seed-e2e-accounts.sql`) executed manually once against the dev database. The script creates fixed test accounts per role with well-known email addresses, a test group, and group memberships. All inserts use `ON CONFLICT DO NOTHING` so the script is safe to re-run.

### Rationale

- **Pre-seeded accounts are faster** than creating accounts in test setup — OTP login is the only auth mechanism, and each login takes ~3-5 seconds. Creating accounts would add another OTP flow per test.
- **Fixed accounts enable storage state reuse** — the existing `ensureOtpStorageState()` pattern caches auth state in `tests/e2e/.auth/`. One storage state file per role avoids re-authenticating on every test run.
- **SQL seed is the simplest approach** — no API client needed, no migration framework dependency. The dev database is already accessible via Cloud SQL Proxy or directly via `gcloud sql connect`.
- **Idempotent design** prevents failures on re-runs — `ON CONFLICT (email) DO NOTHING` ensures the script can be executed multiple times without side effects.

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| API-based seeding (call user creation endpoints) | Requires auth token → chicken-and-egg problem; slower; would need a seeding API endpoint |
| Test-time account creation | Each test would need a fresh OTP flow to create an account; adds 5+ seconds per test; fragile |
| Migration-based seeding (new migration file) | Seed data is not schema — it shouldn't be in the migration chain; would run in production |
| Shared test database snapshot | Over-engineered for 6 accounts; harder to maintain; Cloud SQL doesn't support easy snapshots |

---

## R2: Multi-Role Authentication Pattern

### Decision

Extend the existing `authTest` fixture to support role-specific logins using a `roles.ts` configuration file. Each role maps to a test email, and the auth helper gains a `loginAs(role)` function that creates or reuses a role-specific storage state file.

### Rationale

- **Storage state per role** avoids OTP collisions — only one OTP flow per role per test run, cached in `tests/e2e/.auth/{role}-playwright.json`.
- **File-locking is already implemented** — the existing `ensureOtpStorageState()` uses `.lock` files to prevent parallel generation. Extending this to per-role files follows the same pattern.
- **Configuration in `roles.ts`** keeps test emails centralized — if an email changes, only one file needs updating.
- **Serial execution** (1 worker) simplifies the locking concern — no contention between parallel workers, but the locking remains as a safety net.

### Design

```typescript
// tests/e2e/fixtures/roles.ts
export const TEST_ROLES = {
  user:        { email: 'e2e-user@test.local',        role: 'user' },
  qa:          { email: 'e2e-qa@test.local',           role: 'qa_specialist' },
  researcher:  { email: 'e2e-researcher@test.local',   role: 'researcher' },
  moderator:   { email: 'e2e-moderator@test.local',    role: 'moderator' },
  group_admin: { email: 'e2e-group-admin@test.local',  role: 'group_admin' },
  owner:       { email: 'e2e-owner@test.local',        role: 'owner' },
} as const;

export type TestRole = keyof typeof TEST_ROLES;
```

```typescript
// Enhanced authTest fixture
const test = e2eTest.extend<{ role: TestRole }>({
  role: ['owner', { option: true }],
  // ... creates storageState for the given role
});
```

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| Single account + role-switching API | No role-switching API exists; would need a new backend endpoint |
| Create accounts in `globalSetup` | Playwright global setup doesn't have page context; would need raw HTTP calls |
| Separate Playwright projects per role | Over-engineered for serial execution; adds config complexity |

---

## R3: CI Workflow Configuration

### Decision

Enhance the existing `chat-client/.github/workflows/ui-e2e-dev.yml` to:
1. Set `--workers=1` explicitly for serial execution
2. Add `--timeout=90000` (already present)
3. Set `--retries=1` (already present)
4. Add env variable for test email per role if needed
5. Ensure `test-results/` and `playwright-report/` artifacts are uploaded (already present)

The `chat-ui` repo does not have a CI workflow — it will need one created, or tests there are run manually. The spec's CI requirement (FR-020 through FR-022) applies to the `chat-client` monorepo workflow since that's where PR-triggered CI runs.

### Rationale

- **Serial execution is sufficient** — spec clarification confirms 1 worker. The suite has ~44 tests with a 5-minute budget. At ~5 seconds per test average (including page navigation), serial execution fits within the budget: 44 × 5s = 220s ≈ 3.7 minutes.
- **The CI workflow already exists** in `chat-client` — it triggers on `develop` deploys and supports manual dispatch. Only minor enhancements are needed.
- **`chat-ui` CI is optional** — the split repo's tests are identical to the monorepo's. CI validation in one repo is sufficient per practical considerations, though both repos must have the test files per Dual-Target Discipline.

### Time Budget Estimate

| Category | Tests | Avg Duration | Total |
|----------|-------|-------------|-------|
| Auth (OTP login) | 1 | 15s | 15s |
| Auth (validation + guards) | 6 | 3s | 18s |
| Chat (session + feedback) | 8 | 8s | 64s |
| Workbench (navigation + users) | 6 | 5s | 30s |
| Groups (lifecycle + admin) | 6 | 6s | 36s |
| Research (moderation + annotation) | 6 | 6s | 36s |
| Privacy (masking + GDPR) | 5 | 4s | 20s |
| Review (queue + session) | 6 | 6s | 36s |
| Smoke | 1 | 2s | 2s |
| **Total** | **~45** | | **~257s ≈ 4.3 min** |

Within the 5-minute budget with margin for CI overhead.

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| Parallel workers (default) | Spec clarification chose serial; shared accounts could cause contention |
| Separate CI workflow for E2E only | Unnecessary — existing workflow already handles post-deploy E2E |
| GitHub Actions matrix per role | Over-engineered; serial in one job is simpler and faster (no job startup overhead) |

---

## R4: Review System Test Patterns

### Decision

Review system tests exercise the frontend UI flows, not the API directly. Tests navigate through the review queue, open a session for review, rate messages, add criteria feedback, and submit reviews. The test user is seeded with `owner` role (which has all permissions including review access).

### Rationale

- **E2E tests validate the full stack** — the spec explicitly states tests exercise the deployed dev environment end-to-end.
- **The review system is entirely untested** — no existing E2E tests cover any review functionality. Starting with queue navigation and a basic review workflow provides the highest value.
- **Owner role simplifies permissions** — the owner has all permissions, including review queue access. Using a dedicated reviewer role would require understanding the review permission model in detail and potentially creating additional test accounts.

### Test Approach

**`review-queue.spec.ts`:**
1. Navigate to workbench → review section
2. Verify queue renders with session list
3. Verify filter/sort controls exist
4. Click a session to open it for review

**`review-session.spec.ts`:**
1. Open a session from the queue
2. Verify message list renders
3. Rate a message (click score 1-10)
4. Add criteria feedback text
5. Submit the review
6. Verify the session moves to completed state (or out of queue)

### Considerations

- Review tests depend on **existing chat sessions** in the dev database — the seed script should create at least one reviewable session, or tests should create one via the chat flow first.
- The rating UI uses a **1-10 numeric input** — tests need to identify the correct score selector element.
- Tests should **not assert specific session content** — content depends on AI responses which are non-deterministic.

---

## R5: Flaky Test Mitigation

### Decision

Apply three mitigation strategies:
1. **Retry once** (`--retries=1`) — already configured in CI
2. **Generous timeouts** — 90s per test in CI (already configured), 30s locally
3. **Deterministic locators** — follow existing patterns (role-based, placeholder-based), avoid text-content assertions on dynamic data

### Rationale

- **The spec allows up to 5% flaky rate** over 10 consecutive runs. With ~45 tests and 5% threshold, up to 2 tests can be flaky. The retry mechanism handles transient failures.
- **AI response assertions are the main flaky risk** — per spec clarification, tests only assert a non-empty response bubble appears within timeout, never matching specific text.
- **Dev environment stability** is outside test control — network latency, Cloud Run cold starts, and Dialogflow CX response times vary. The 90s timeout in CI provides ample buffer.

### Mitigation Patterns

| Risk | Mitigation |
|------|-----------|
| Dialogflow CX slow response | Assert bubble exists within 30s timeout; don't assert text content |
| Cloud Run cold start | First test (smoke) warms the backend; subsequent tests benefit |
| Shared account state | Tests clean up after themselves where possible; serial execution prevents contention |
| DOM not ready | Use Playwright's built-in auto-waiting (click, fill, etc.); avoid `page.waitForTimeout()` |
| Network instability | Retry once in CI; generous timeout; existing error filtering ignores benign errors |
