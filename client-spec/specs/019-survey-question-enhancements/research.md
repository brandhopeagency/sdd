# Research: Survey Module Enhancements

**Branch**: `019-survey-question-enhancements` | **Date**: 2026-03-05  
**Spec**: [spec.md](./spec.md)

---

## R1. Canonical Question Type Model

**Decision**: Use canonical `SurveyQuestion.type` values for all typed question kinds (numeric/date/time/preset/rating), with `free_text` reserved for plain/custom-regex text.

**Rationale**: Matches clarified product direction, simplifies renderer branching and backend validator routing, and removes ambiguity around `free_text.dataType`.

**Alternatives considered**:
- Keep `free_text + dataType` subtyping: rejected for higher branching complexity and weaker schema semantics.
- Hybrid model: rejected due to inconsistent authoring and validation UX.

---

## R2. Constraint Model by Type

**Decision**: Support type-specific constraints only:
- numeric: optional `minValue`, `maxValue`
- date/time/datetime: optional `min`, `max`
- rating: `startValue`, `endValue`, `step` (required and internally valid)
- preset text types: pattern-only, no range controls

**Rationale**: Prevents invalid or meaningless constraints and keeps schema editor behavior predictable.

**Alternatives considered**:
- No constraints beyond type validation: rejected (insufficient for real survey rules like age bounds).
- Universal constraints for all types: rejected (semantic mismatch for preset text types).

---

## R3. Visibility Evaluation and Operators

**Decision**: Keep shared operators `equals`, `not_equals`, `in`, `contains`; evaluate conditions client-side (UX) and server-side (integrity), with source questions restricted to lower order.

**Rationale**: Ensures deterministic flow, prevents tampered submissions, and keeps workbench preview/gate/back-end aligned.

**Alternatives considered**:
- Client-only evaluation: rejected (integrity risk).
- Multi-condition logic in this phase: rejected (out-of-scope complexity).

---

## R4. Group Surveys Workbench Visibility

**Decision**: Group Detail exposes a first-class `Surveys` tab only for users with `SURVEY_INSTANCE_MANAGE`; hide tab entirely otherwise.

**Rationale**: Resolves discoverability issue while keeping permission boundaries explicit and reducing disabled-UI confusion.

**Alternatives considered**:
- Show disabled tab with tooltip: rejected (still perceived as broken by non-privileged users).
- Global-only surveys page: rejected (worse group-context navigation).

---

## R5. Ordering and Export Contracts

**Decision**:
- Per-group ordering persists in `group_survey_order`.
- Group page API remains `GET/PUT /api/workbench/groups/:groupId/surveys`.
- Bulk export remains group-scoped JSON/CSV download on survey instance responses endpoint.

**Rationale**: Aligns gate ordering, workbench ordering, and analytics scope while preserving established route shapes.

**Alternatives considered**:
- Global `priority` on survey instance: rejected as not group-specific.
- Global unscoped export: rejected due to context and privacy risks.

---

## R6. Backward Compatibility Strategy

**Decision**: Maintain additive compatibility for legacy snapshots/responses:
- legacy question shapes continue to render and validate with defaults
- missing `visible` is treated as `true`
- answer union remains `string | string[] | boolean | null`

**Rationale**: Avoids migration-heavy rollout and keeps existing survey history intact.

**Alternatives considered**:
- Force migration rewrite of historical JSONB documents: rejected for risk and operational cost.

---

## Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Shared types | TypeScript (`chat-types`) | 5.x |
| Backend | Node.js + Express (`chat-backend`) | Node 20 / Express 4 |
| Database | PostgreSQL | 15.x |
| Frontends | React + Vite (`chat-frontend`, `workbench-frontend`) | React 18 / Vite 5 |
| Testing | Vitest + Playwright (`chat-ui`) | current repo standards |
