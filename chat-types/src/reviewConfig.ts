/**
 * Review system configuration types and enums.
 *
 * Contains ReviewConfiguration, and all enums used across the review system:
 * ReviewStatus, SessionReviewStatus, RiskLevel, Severity, FlagStatus,
 * CriterionKey, ReasonCategory, JustificationCategory, DeanonymizationStatus.
 */

// ─── Review Status Enums ────────────────────────────────────────────────────

/** Status of an individual reviewer's review. */
export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

/** Aggregate review status for a session. */
export type SessionReviewStatus =
  | 'pending_review'
  | 'in_review'
  | 'complete'
  | 'disputed'
  | 'disputed_closed';

/** Risk level of a session. */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/** Severity level for risk flags. */
export type Severity = 'high' | 'medium' | 'low';

/** Status of a risk flag. */
export type FlagStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

// ─── Evaluation Criteria ────────────────────────────────────────────────────

/** Keys for the five evaluation criteria. */
export type CriterionKey = 'relevance' | 'empathy' | 'safety' | 'ethics' | 'clarity';

/** All valid criterion keys as an array (for iteration). */
export const CRITERION_KEYS: CriterionKey[] = [
  'relevance',
  'empathy',
  'safety',
  'ethics',
  'clarity'
];

// ─── Risk Flag Categories ───────────────────────────────────────────────────

/** Reason categories for risk flags. */
export type ReasonCategory =
  | 'crisis_indicators'
  | 'self_harm_language'
  | 'inappropriate_ai_response'
  | 'ethical_concern'
  | 'other_safety_concern';

/** All valid reason categories as an array (for iteration). */
export const REASON_CATEGORIES: ReasonCategory[] = [
  'crisis_indicators',
  'self_harm_language',
  'inappropriate_ai_response',
  'ethical_concern',
  'other_safety_concern'
];

// ─── Deanonymization ────────────────────────────────────────────────────────

/** Justification categories for deanonymization requests. */
export type JustificationCategory =
  | 'welfare_check'
  | 'legal_requirement'
  | 'clinical_escalation'
  | 'investigation';

/** All valid justification categories as an array (for iteration). */
export const JUSTIFICATION_CATEGORIES: JustificationCategory[] = [
  'welfare_check',
  'legal_requirement',
  'clinical_escalation',
  'investigation'
];

/** Status of a deanonymization request. */
export type DeanonymizationStatus = 'pending' | 'approved' | 'denied';

// ─── Notifications ──────────────────────────────────────────────────────────

/** Event types for review notifications. */
export type ReviewNotificationEventType =
  | 'review_assigned'
  | 'assignment_expiring'
  | 'assignment_expired'
  | 'high_risk_flag'
  | 'medium_risk_flag'
  | 'deanonymization_requested'
  | 'deanonymization_resolved'
  | 'dispute_detected'
  | 'review_complete'
  | 'weekly_summary';

// ─── Supervision ────────────────────────────────────────────────────────────

/** Policy controlling which reviews require supervision. */
export type SupervisionPolicy = 'all' | 'sampled' | 'none';

/** Status of a review in the supervision pipeline. */
export type SupervisionStatus =
  | 'pending_supervision'
  | 'approved'
  | 'disapproved'
  | 'revision_requested'
  | 'not_required';

// ─── Grade Descriptions ─────────────────────────────────────────────────────

/** Editable description for a score level (1-10). */
export interface GradeDescription {
  scoreLevel: number;
  description: string;
  updatedBy: string | null;
  updatedAt: Date;
}

/** Input for updating a grade description. */
export interface UpdateGradeDescriptionInput {
  description: string;
}

// ─── Group Review Config ────────────────────────────────────────────────────

/** Per-group overrides for review configuration. */
export interface GroupReviewConfig {
  id: string;
  groupId: string;
  reviewerCountOverride: number | null;
  supervisionPolicy: SupervisionPolicy | null;
  supervisionSamplePercentage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating/updating a group review config. */
export interface UpdateGroupReviewConfigInput {
  reviewerCountOverride?: number | null;
  supervisionPolicy?: SupervisionPolicy | null;
  supervisionSamplePercentage?: number | null;
}

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * System-wide review configuration (singleton).
 */
export interface ReviewConfiguration {
  id: number;
  minReviews: number;
  maxReviews: number;
  criteriaThreshold: number;
  autoFlagThreshold: number;
  varianceLimit: number;
  timeoutHours: number;
  highRiskSlaHours: number;
  mediumRiskSlaHours: number;
  deanonymizationAccessHours: number;
  /** Minimum user+AI messages for review queue inclusion (default 4). */
  minMessageThreshold: number;
  /** Global default supervision policy. */
  supervisionPolicy: SupervisionPolicy;
  /** Global sampling rate when policy = 'sampled'. */
  supervisionSamplePercentage: number;
  updatedAt: Date;
  updatedBy: string | null;
}

/**
 * Default review configuration values.
 */
export const DEFAULT_REVIEW_CONFIG: Omit<ReviewConfiguration, 'id' | 'updatedAt' | 'updatedBy'> = {
  minReviews: 3,
  maxReviews: 5,
  criteriaThreshold: 7,
  autoFlagThreshold: 4,
  varianceLimit: 2.0,
  timeoutHours: 24,
  highRiskSlaHours: 2,
  mediumRiskSlaHours: 24,
  deanonymizationAccessHours: 72,
  minMessageThreshold: 4,
  supervisionPolicy: 'none',
  supervisionSamplePercentage: 100
};

/**
 * Input for updating review configuration (all fields optional).
 */
export interface UpdateReviewConfigInput {
  minReviews?: number;
  maxReviews?: number;
  criteriaThreshold?: number;
  autoFlagThreshold?: number;
  varianceLimit?: number;
  timeoutHours?: number;
  highRiskSlaHours?: number;
  mediumRiskSlaHours?: number;
  deanonymizationAccessHours?: number;
  minMessageThreshold?: number;
  supervisionPolicy?: SupervisionPolicy;
  supervisionSamplePercentage?: number;
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

/** Time period filter for dashboards. */
export type DashboardPeriod = 'today' | 'week' | 'month' | 'all';

/** Score distribution buckets for dashboard display. */
export interface ScoreDistribution {
  outstanding: number; // 9-10
  good: number;        // 7-8
  adequate: number;    // 5-6
  poor: number;        // 3-4
  unsafe: number;      // 1-2
}

/** Criteria feedback count breakdown. */
export interface CriteriaFeedbackCounts {
  relevance: number;
  empathy: number;
  safety: number;
  ethics: number;
  clarity: number;
}

/** Weekly trend data point. */
export interface WeeklyTrendPoint {
  week: string;
  reviewsCompleted: number;
  averageScore: number;
}

/** Personal reviewer dashboard statistics. */
export interface ReviewerDashboardStats {
  reviewsCompleted: number;
  averageScoreGiven: number | null;
  agreementRate: number;
  scoreDistribution: ScoreDistribution;
  criteriaFeedbackCounts: CriteriaFeedbackCounts;
  weeklyTrend: WeeklyTrendPoint[];
}

/** Reviewer workload entry for team dashboard. */
export interface ReviewerWorkloadEntry {
  reviewerId: string;
  reviewerName: string;
  reviewsCompleted: number;
  reviewsInProgress: number;
  averageScore: number;
}

/** Queue depth breakdown. */
export interface QueueDepth {
  pendingReview: number;
  inReview: number;
  disputed: number;
  complete: number;
}

/** Team dashboard statistics. */
export interface TeamDashboardStats {
  totalReviews: number;
  averageTeamScore: number | null;
  interRaterReliability: number;
  pendingEscalations: number;
  pendingDeanonymizations: number;
  reviewerWorkload: ReviewerWorkloadEntry[];
  queueDepth: QueueDepth;
}

// ─── Report Types ───────────────────────────────────────────────────────────

/** Report types available for generation. */
export type ReportType =
  | 'daily_summary'
  | 'weekly_performance'
  | 'monthly_quality'
  | 'escalation_report';

/** Export formats for reports. */
export type ReportFormat = 'json' | 'csv' | 'pdf';

/** Report metadata. */
export interface ReportMetadata {
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
}
