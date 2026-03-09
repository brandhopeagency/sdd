// Re-export review types from shared package
export type {
  SessionReview,
  MessageRating,
  CriteriaFeedback,
  RiskFlag,
  DeanonymizationRequest,
  ReviewNotification,
  ReviewConfiguration,
  QueueSession,
  AnonymizedMessage,
  ReviewSummary,
  BannerAlerts,
  RevealedIdentity,
  ReviewStatus,
  SessionReviewStatus,
  RiskLevel,
  Severity,
  FlagStatus,
  CriterionKey,
  ReasonCategory,
  JustificationCategory,
  DeanonymizationStatus,
  UpdateReviewConfigInput,
  DashboardPeriod,
  ScoreDistribution,
  ReviewerDashboardStats,
  TeamDashboardStats,
  ReportType,
  ReportFormat,
  SupervisionPolicy,
  SupervisionStatus,
  GradeDescription,
  UpdateGradeDescriptionInput,
  GroupReviewConfig,
  UpdateGroupReviewConfigInput,
  SupervisorReview,
  SupervisorDecisionInput,
  SupervisionQueueItem,
  AwaitingFeedbackItem,
  RAGCallDetail,
  RAGDocument,
} from '@mentalhelpglobal/chat-types';

// ── Queue Query Parameters ──

export interface QueueQueryParams {
  tab?: 'pending' | 'flagged' | 'in_progress' | 'completed';
  riskLevel?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedToMe?: string; // 'true' or 'false'
  sortBy?: 'priority' | 'date' | 'messageCount';
  page?: string;
  pageSize?: string;
}

// ── Rating Input ──

export interface CreateRatingInput {
  messageId: string;
  score: number;
  comment?: string | null;
  criteriaFeedback?: Array<{
    criterion: string;
    feedbackText: string;
  }>;
}

// ── Submit Review Input ──

export interface SubmitReviewInput {
  overallComment?: string | null;
}

// ── Risk Flag Input ──

export interface CreateFlagInput {
  severity: string;
  reasonCategory: string;
  details: string;
  requestDeanonymization?: boolean;
  deanonymizationJustification?: string;
}

// ── Resolve Flag Input ──

export interface ResolveFlagInput {
  resolutionNotes: string;
  newStatus?: 'acknowledged' | 'resolved' | 'escalated';
}

// ── Deanonymization Inputs ──

export interface CreateDeanonymizationInput {
  sessionId: string;
  justificationCategory: string;
  justificationDetails: string;
  riskFlagId?: string | null;
}

export interface ApproveDeanonymizationInput {
  accessDurationHours?: number;
}

export interface DenyDeanonymizationInput {
  denialNotes: string;
}

// ── Assignment Input ──

export interface AssignSessionInput {
  reviewerId: string;
}

// ── Report Query ──

export interface ReportQueryParams {
  from: string;
  to: string;
  format?: 'json' | 'csv' | 'pdf';
}

// ── Paginated Response ──

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
