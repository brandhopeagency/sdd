# Data Model: Chat Moderation and Review System

**Feature Branch**: `003-chat-moderation-review`  
**Date**: 2026-02-10  
**Source**: `spec.md` functional requirements and research decisions

## Overview

The model supports anonymized session review, per-message scoring, multi-review aggregation, safety escalation, governed deanonymization, and immutable auditability. The design is implementation-ready for split repositories and keeps privacy controls explicit at the data level.

## Entity Relationship Summary

- One `ChatSession` has many `SessionMessage`, `SessionReview`, `RiskFlag`, and `DeanonymizationRequest`.
- One `SessionReview` has many `MessageRating`.
- One `MessageRating` has many `CriteriaFeedback` (0..5).
- One `RiskFlag` may create zero or one linked `DeanonymizationRequest`.
- One `Reviewer` can author many reviews, flags, and requests.
- All sensitive actions emit `AuditEvent`.

## Entities

### 1) ChatSession

Represents a completed conversation waiting for review or already reviewed.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `anonymousUserId` | String | Yes | Displayed as `USER-XXXX`; never exposes real identity |
| `startedAt` | Timestamp | Yes | Session start time |
| `endedAt` | Timestamp | Yes | Session end time |
| `language` | Enum(`uk`,`en`,`ru`,`other`) | Yes | Used for reviewer eligibility |
| `messageCount` | Integer | Yes | Must be `>= 0` |
| `reviewStatus` | Enum(`pending`,`in_progress`,`completed`,`disputed`,`tiebreaker`,`resolved`) | Yes | Lifecycle state |
| `reviewsRequired` | Integer | Yes | Config-driven, range `1..10` |
| `reviewsCompleted` | Integer | Yes | Range `0..reviewsAllowed` |
| `finalScore` | Decimal(3,1) | No | Populated when review is resolved |
| `riskLevel` | Enum(`none`,`low`,`medium`,`high`) | Yes | Derived from open flags and detections |
| `hasRiskFlag` | Boolean | Yes | Fast queue filter indicator |

### 2) SessionMessage

Single message in a chat session.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `sessionId` | UUID | Yes | FK to `ChatSession` |
| `role` | Enum(`user`,`assistant`,`system`) | Yes | Only `assistant` messages are scorable |
| `content` | Text | Yes | Non-empty |
| `timestamp` | Timestamp | Yes | Within session bounds |
| `riskIndicator` | Boolean | Yes | Marks detected risky user phrases |

### 3) Reviewer

System actor authorized for moderation workflows.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `role` | Enum(`reviewer`,`senior_reviewer`,`moderator`,`commander`,`admin`) | Yes | Access control source |
| `qualificationStatus` | Enum(`active`,`inactive`,`suspended`) | Yes | Only active reviewers can submit |
| `languages` | Array<Language> | Yes | Assignment constrained by language |
| `calibrationScore` | Decimal(5,2) | No | Used for reviewer quality program |

### 4) SessionReview

A full reviewer submission for a session.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `sessionId` | UUID | Yes | FK to `ChatSession` |
| `reviewerId` | UUID | Yes | FK to `Reviewer` |
| `status` | Enum(`pending`,`in_progress`,`completed`,`expired`) | Yes | Assignment/review lifecycle |
| `isTiebreaker` | Boolean | Yes | Marks conflict-resolution review |
| `startedAt` | Timestamp | No | Set when review begins |
| `completedAt` | Timestamp | No | Set when submission succeeds |
| `expiresAt` | Timestamp | No | For soft lock expiry |
| `averageScore` | Decimal(3,1) | No | Derived from message ratings |
| `overallComment` | Text | No | Optional session-level comment |

**Unique constraint**: one reviewer cannot submit more than one review for the same session.

### 5) MessageRating

Score assigned to an AI message by a reviewer.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `reviewId` | UUID | Yes | FK to `SessionReview` |
| `messageId` | UUID | Yes | FK to `SessionMessage` (assistant only) |
| `score` | Integer | Yes | Range `1..10` |
| `comment` | Text | No | Optional unless local policy requires |
| `createdAt` | Timestamp | Yes | Record timestamp |

### 6) CriteriaFeedback

Detailed criterion notes for low-scored responses.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `ratingId` | UUID | Yes | FK to `MessageRating` |
| `criterionKey` | Enum(`relevance`,`empathy`,`safety`,`ethics`,`clarity`) | Yes | One row per criterion |
| `feedbackText` | Text | Yes | Length `10..500` |
| `createdAt` | Timestamp | Yes | Record timestamp |

**Validation rule**: for scores `<= criteriaThreshold`, at least one `CriteriaFeedback` row is required.

### 7) RiskFlag

Safety escalation record tied to a session.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `sessionId` | UUID | Yes | FK to `ChatSession` |
| `flaggedBy` | UUID | No | Nullable when auto-detected |
| `severity` | Enum(`low`,`medium`,`high`) | Yes | Drives SLA and routing |
| `reason` | String | Yes | Controlled reason category |
| `details` | Text | No | Optional supporting evidence |
| `status` | Enum(`open`,`acknowledged`,`resolved`,`escalated`) | Yes | Escalation lifecycle |
| `deanonRequested` | Boolean | Yes | Triggers request workflow |
| `createdAt` | Timestamp | Yes | Flag timestamp |
| `resolvedAt` | Timestamp | No | Set when closed |

### 8) DeanonymizationRequest

Governed workflow for identity reveal.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `sessionId` | UUID | Yes | FK to `ChatSession` |
| `requestedBy` | UUID | Yes | Reviewer/senior/moderator/admin |
| `approvedBy` | UUID | No | Commander/admin decision actor |
| `justification` | String | Yes | Required reason category |
| `details` | Text | Yes | Must explain necessity |
| `status` | Enum(`pending`,`approved`,`denied`) | Yes | Request lifecycle |
| `createdAt` | Timestamp | Yes | Submission timestamp |
| `resolvedAt` | Timestamp | No | Decision timestamp |
| `expiresAt` | Timestamp | No | If approved, access timeout |

### 9) ReviewConfiguration

Administrative runtime policy values.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `minReviewsRequired` | Integer | Yes | Range `1..10` |
| `maxReviewsAllowed` | Integer | Yes | Range `1..10`, must be `>= minReviewsRequired` |
| `criteriaThreshold` | Integer | Yes | Range `1..10` |
| `autoFlagThreshold` | Integer | Yes | Range `1..10` |
| `scoreVarianceLimit` | Decimal(2,1) | Yes | Range `0.5..5.0` |
| `reviewTimeoutHours` | Integer | Yes | Positive value |
| `highRiskResponseHours` | Integer | Yes | Positive value |
| `mediumRiskResponseHours` | Integer | Yes | Positive value |

### 10) AuditEvent

Immutable record of sensitive operations.

| Field | Type | Required | Rules |
|------|------|----------|-------|
| `id` | UUID | Yes | Unique identifier |
| `actorId` | UUID | Yes | Initiating user |
| `action` | String | Yes | Domain event key |
| `targetType` | String | Yes | E.g., `session`, `review`, `risk_flag`, `deanonymization` |
| `targetId` | UUID/String | Yes | Resource identifier |
| `details` | JSON/Object | No | Structured contextual metadata |
| `createdAt` | Timestamp | Yes | Event time |

## State Transitions

### ChatSession Review Lifecycle

`pending` -> `in_progress` -> (`completed` | `disputed`) -> (`tiebreaker` -> `resolved`) or direct `resolved`

### SessionReview Lifecycle

`pending` -> `in_progress` -> (`completed` | `expired`)

### RiskFlag Lifecycle

`open` -> (`acknowledged` | `escalated` | `resolved`)  
`acknowledged` -> (`resolved` | `escalated`)

### DeanonymizationRequest Lifecycle

`pending` -> (`approved` | `denied`)

## Derived Business Rules

1. All assistant messages in a submitted review must have exactly one rating.
2. A reviewer cannot review the same session twice.
3. Peer individual scores remain hidden until reviewer submission is complete.
4. High-severity flags require accelerated response timelines relative to medium.
5. Deanonymization approvals must always be attributable to an authorized approver and auditable.
