# Research: Chat Moderation and Review System

**Feature Branch**: `003-chat-moderation-review`  
**Date**: 2026-02-10

## Research Summary

Technical context unknowns were resolved using repository conventions from prior review-related artifacts and constitution constraints. No unresolved `NEEDS CLARIFICATION` items remain for Phase 1 design.

---

## R1: Queue Prioritization Model

**Decision**: Use deterministic queue priority ordering of (1) risk severity, (2) elapsed time since session end, and (3) number of completed reviews.

**Rationale**: This aligns with safety-first review operations while keeping overdue and under-reviewed sessions visible. The ordering is simple to explain and validate in UI and tests.

**Alternatives considered**:
- Pure FIFO queue: rejected because high-risk sessions must preempt normal workload.
- Dynamic reviewer-personalized ranking only: rejected because it can hide globally urgent sessions.

---

## R2: Multi-Reviewer Dispute Resolution Rule

**Decision**: Treat score disagreement as the range between reviewer averages (`max - min`) and trigger disputed state when the range exceeds configurable tolerance.

**Rationale**: The range is transparent for reviewers and moderators and easier to reason about than statistical variance for low reviewer counts.

**Alternatives considered**:
- Standard deviation threshold: rejected as less interpretable for 3-5 reviews.
- Median-only aggregation without dispute state: rejected because it removes explicit moderation workflows for disagreement.

---

## R3: Deanonymization Access Control Model

**Decision**: Keep deanonymization as an explicit request/approval lifecycle with role-based approvals and time-limited revealed access.

**Rationale**: This satisfies privacy-first governance and compliance expectations while allowing urgent intervention when justified.

**Alternatives considered**:
- Instant reveal for moderator role: rejected due to excessive privilege risk.
- Permanent reveal after approval: rejected because least-privilege access must expire.

---

## R4: Escalation Notification Reliability

**Decision**: Persist risk flags before any notification delivery attempt and track delivery status separately for retry/escalation handling.

**Rationale**: Safety records must never be lost due to transient notification failures; the review action itself is the authoritative event.

**Alternatives considered**:
- Block flag submission until notifications succeed: rejected because it delays urgent operator action.
- Fire-and-forget notifications without status tracking: rejected because moderation teams need delivery visibility for accountability.

---

## R5: Reviewer Blinding Visibility Rules

**Decision**: Hide individual peer scores until reviewer submission; show only aggregate outcomes during in-progress states; reveal full detail after completion.

**Rationale**: This protects review independence while preserving a post-completion learning loop for calibration.

**Alternatives considered**:
- Full real-time peer visibility: rejected due to anchoring bias risk.
- Permanent blind mode: rejected because it limits reviewer calibration and quality improvement.

---

## R6: Assignment and Expiration Strategy

**Decision**: Use soft assignment reservation with expiry and automatic return-to-pool for unstarted/incomplete reviews.

**Rationale**: Reservation avoids reviewer collisions while expiry prevents queue starvation and supports SLA adherence.

**Alternatives considered**:
- Hard lock until manual release: rejected due to high operational overhead.
- No assignment state: rejected because concurrent reviewer conflicts increase and accountability decreases.

---

## R7: Cross-Repository Contract Flow

**Decision**: Implement in split repositories in this order: `chat-types` → `chat-backend` → `chat-frontend` → `chat-ui`.

**Rationale**: Shared contract-first sequencing minimizes integration breakage and keeps API/UI development aligned to canonical types.

**Alternatives considered**:
- Backend-first with local duplicated types: rejected due to drift risk.
- Frontend-first mocking without contract lock: rejected because endpoint and validation mismatch risk is high.

---

## R8: Accessibility and i18n Baseline

**Decision**: Treat accessibility and trilingual text support as release criteria for reviewer-facing workflows, including keyboard support and non-color-dependent status signaling.

**Rationale**: Constitution principle VI requires WCAG AA and i18n support for all user-facing functionality.

**Alternatives considered**:
- Accessibility as post-release hardening: rejected due to constitution non-compliance.
- English-only initial release: rejected due to product language requirements.
