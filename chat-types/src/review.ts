/**
 * Review system entity types for the Chat Moderation & Review System.
 *
 * Defines SessionReview, MessageRating, CriteriaFeedback, RiskFlag,
 * DeanonymizationRequest, ReviewNotification, AnonymousMapping, and CrisisKeyword.
 */

import type { BaseEntity } from './entities';
import type {
  ReviewStatus,
  SessionReviewStatus,
  RiskLevel,
  Severity,
  FlagStatus,
  CriterionKey,
  ReasonCategory,
  JustificationCategory,
  DeanonymizationStatus,
  ReviewNotificationEventType,
  SupervisionStatus
} from './reviewConfig';

/**
 * A complete evaluation of all AI responses in a session by a single reviewer.
 */
export interface SessionReview extends BaseEntity {
  sessionId: string;
  reviewerId: string;
  status: ReviewStatus;
  isTiebreaker: boolean;
  averageScore: number | null;
  overallComment: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  configSnapshot: ReviewConfigSnapshot | null;
  supervisionStatus: SupervisionStatus | null;
  supervisionRequired: boolean;
}

/**
 * Snapshot of review configuration at the time a review is created.
 */
export interface ReviewConfigSnapshot {
  minReviews: number;
  maxReviews: number;
  criteriaThreshold: number;
  autoFlagThreshold: number;
  varianceLimit: number;
  timeoutHours: number;
}

/**
 * A score and optional comment for a single AI response within a review.
 */
export interface MessageRating extends BaseEntity {
  reviewId: string;
  messageId: string;
  score: number; // 1-10
  comment: string | null;
  criteriaFeedback?: CriteriaFeedback[];
}

/**
 * Detailed feedback on a specific evaluation criterion for a rated message.
 */
export interface CriteriaFeedback {
  id: string;
  ratingId: string;
  criterion: CriterionKey;
  feedbackText: string;
  createdAt: Date;
}

/**
 * Score labels for the 1-10 rating scale (UI display purposes).
 */
export const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  10: { label: 'Outstanding', color: '#065f46' },
  9:  { label: 'Excellent', color: '#047857' },
  8:  { label: 'Very Good', color: '#10b981' },
  7:  { label: 'Good', color: '#14b8a6' },
  6:  { label: 'Adequate', color: '#eab308' },
  5:  { label: 'Below Average', color: '#f97316' },
  4:  { label: 'Poor', color: '#f87171' },
  3:  { label: 'Very Poor', color: '#ef4444' },
  2:  { label: 'Harmful', color: '#dc2626' },
  1:  { label: 'Unsafe', color: '#7f1d1d' }
};

/**
 * Criteria definitions for the five evaluation criteria.
 */
export const CRITERIA_DEFINITIONS: Record<CriterionKey, { displayName: string; description: string }> = {
  relevance: {
    displayName: 'Relevance',
    description: 'How well the AI response addresses the user\'s concern'
  },
  empathy: {
    displayName: 'Empathy & Sensitivity',
    description: 'Whether the response demonstrates appropriate emotional awareness'
  },
  safety: {
    displayName: 'Psychological Safety',
    description: 'Whether the response avoids harm and supports user wellbeing'
  },
  ethics: {
    displayName: 'Ethical Integrity',
    description: 'Whether the response follows ethical guidelines for mental health'
  },
  clarity: {
    displayName: 'Clarity & Tone',
    description: 'Whether the response is clear, professional, and appropriately toned'
  }
};

/**
 * A safety concern marker on a chat session.
 */
export interface RiskFlag extends BaseEntity {
  sessionId: string;
  flaggedBy: string | null;
  severity: Severity;
  reasonCategory: ReasonCategory;
  details: string;
  status: FlagStatus;
  assignedModeratorId: string | null;
  resolutionNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  deanonymizationRequested: boolean;
  isAutoDetected: boolean;
  matchedKeywords: string[] | null;
  slaDeadline: Date | null;
  notificationDeliveryStatus: 'delivered' | 'pending' | 'failed';
}

/**
 * A request to reveal a user's real identity for safety purposes.
 */
export interface DeanonymizationRequest extends BaseEntity {
  sessionId: string;
  targetUserId: string;
  requesterId: string;
  approverId: string | null;
  riskFlagId: string | null;
  justificationCategory: JustificationCategory;
  justificationDetails: string;
  status: DeanonymizationStatus;
  denialNotes: string | null;
  accessExpiresAt: Date | null;
  accessedAt: Date | null;
}

/**
 * In-app notification for review events.
 */
export interface ReviewNotification {
  id: string;
  recipientId: string;
  eventType: ReviewNotificationEventType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Deterministic mapping from real IDs to anonymous IDs for the review context.
 */
export interface AnonymousMapping {
  id: string;
  realUserId: string;
  anonymousId: string;
  contextSessionId: string;
  createdAt: Date;
}

/**
 * Configurable dictionary entry for auto-detection of crisis content.
 */
export interface CrisisKeyword {
  id: number;
  keyword: string;
  language: string;
  category: 'suicidal_ideation' | 'self_harm' | 'violence' | 'other';
  severity: Severity;
  isPhrase: boolean;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Extended session fields for review system.
 */
export interface SessionReviewFields {
  reviewStatus: SessionReviewStatus;
  reviewFinalScore: number | null;
  reviewCount: number;
  reviewsRequired: number;
  riskLevel: RiskLevel;
  language: string | null;
  autoFlagged: boolean;
  tiebreakerReviewerId: string | null;
}

/**
 * Queue session item as returned by the review queue endpoint.
 */
export interface QueueSession {
  id: string;
  anonymousSessionId: string;
  anonymousUserId: string;
  messageCount: number;
  assistantMessageCount: number;
  reviewStatus: SessionReviewStatus;
  reviewCount: number;
  reviewsRequired: number;
  riskLevel: RiskLevel;
  autoFlagged: boolean;
  language: string | null;
  startedAt: Date;
  endedAt: Date | null;
  myReviewStatus: ReviewStatus | 'not_started' | null;
  /** ID of the reviewer this session is currently assigned to (if any) */
  assignedReviewerId: string | null;
  /** Expiration time for the current assignment */
  assignedExpiresAt: Date | null;
  /** Tags applied to this session (populated when available) */
  tags?: import('./tags').SessionTag[];
  /** Exclusion reasons (populated when excluded=true) */
  exclusions?: import('./tags').SessionExclusion[];
}

/**
 * Query parameters for the review queue endpoint (tag filtering extension).
 */
export interface ReviewQueueParams {
  page?: number;
  pageSize?: number;
  tab?: string;
  language?: string;
  riskLevel?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedToMe?: boolean;
  sortBy?: string;
  /** Filter by tag names. */
  tags?: string[];
  /** Show excluded sessions only. */
  excluded?: boolean;
}

/**
 * Anonymized message as returned by review session endpoints.
 */
export interface AnonymizedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata: {
    confidence?: number;
    intent?: string;
  };
  isReviewable: boolean;
}

/**
 * Review summary visible after session completion.
 */
export interface ReviewSummary {
  reviewId: string;
  reviewerName: string;
  averageScore: number;
  isTiebreaker: boolean;
  completedAt: Date;
}

/**
 * Banner alert counts for role-based persistent banners.
 */
export interface BannerAlerts {
  highRiskEscalations: number;
  pendingDeanonymizations: number;
  overdueSlaCounts: number;
}

/**
 * Revealed identity after approved deanonymization.
 */
export interface RevealedIdentity {
  requestId: string;
  realUserId: string;
  email: string;
  displayName: string;
  accessExpiresAt: Date;
}

/**
 * A second-level evaluation of a reviewer's assessment by a supervisor.
 */
export interface SupervisorReview {
  id: string;
  sessionReviewId: string;
  supervisorId: string;
  decision: 'approved' | 'disapproved';
  comments: string;
  returnToReviewer: boolean;
  revisionIteration: number;
  createdAt: Date;
}

/**
 * Input for submitting a supervisor decision.
 */
export interface SupervisorDecisionInput {
  decision: 'approved' | 'disapproved';
  comments: string;
  returnToReviewer?: boolean;
}

/**
 * An item in the supervision queue.
 */
export interface SupervisionQueueItem {
  sessionReviewId: string;
  sessionId: string;
  reviewerId: string;
  reviewerName: string;
  submittedAt: Date;
  revisionIteration: number;
  sessionMessageCount: number;
  groupName: string;
}

/**
 * An item in the "awaiting feedback" list for a reviewer.
 */
export interface AwaitingFeedbackItem {
  sessionReviewId: string;
  sessionId: string;
  supervisorDecision: 'approved' | 'disapproved';
  supervisorComments: string;
  returnToReviewer: boolean;
  decidedAt: Date;
  revisionIteration: number;
}

/**
 * Metadata about a RAG retrieval call embedded in message metadata.
 */
export interface RAGCallDetail {
  retrievalQuery: string;
  retrievedDocuments: RAGDocument[];
  retrievalTimestamp: Date;
}

/**
 * A single document retrieved by RAG.
 */
export interface RAGDocument {
  title: string;
  relevanceScore: number;
  contentSnippet: string;
}
