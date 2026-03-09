/**
 * Frontend-specific review types
 * Component props, form state, and convenience re-exports
 */

import type {
  CriterionKey, QueueSession, SessionReview,
  MessageRating, RiskFlag, Severity, ReasonCategory,
  JustificationCategory, ReviewStatus, SessionReviewStatus,
  DashboardPeriod, ReportType, ReportFormat
} from '@mentalhelpglobal/chat-types';

// Re-export commonly used types for convenience
export type {
  CriterionKey, QueueSession, SessionReview,
  MessageRating, RiskFlag, Severity, ReasonCategory,
  JustificationCategory, ReviewStatus, SessionReviewStatus,
  DashboardPeriod, ReportType, ReportFormat
};

// ── Component Props ──

export interface ScoreSelectorProps {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}

export interface CriteriaFeedbackFormProps {
  score: number;
  criteriaThreshold: number;
  feedback: CriteriaFeedbackFormState;
  onChange: (feedback: CriteriaFeedbackFormState) => void;
  disabled?: boolean;
}

export interface SessionCardProps {
  session: QueueSession;
  onClick?: (sessionId: string) => void;
  onAssign?: (sessionId: string) => void;
  showAssign?: boolean;
}

export interface ReviewProgressProps {
  rated: number;
  total: number;
  canSubmit: boolean;
}

// ── Form State ──

export interface CriteriaFeedbackFormState {
  relevance: string;
  empathy: string;
  safety: string;
  ethics: string;
  clarity: string;
}

export const EMPTY_CRITERIA_FEEDBACK: CriteriaFeedbackFormState = {
  relevance: '',
  empathy: '',
  safety: '',
  ethics: '',
  clarity: '',
};

export interface RatingFormState {
  score: number | null;
  comment: string;
  criteriaFeedback: CriteriaFeedbackFormState;
}

export interface RiskFlagFormState {
  severity: Severity | '';
  reasonCategory: ReasonCategory | '';
  details: string;
  requestDeanonymization: boolean;
  deanonymizationJustification: string;
}

export interface QueueFilterState {
  riskLevel: string;
  language: string;
  dateFrom: string;
  dateTo: string;
  assignedToMe: boolean;
  sortBy: 'priority' | 'date' | 'messageCount';
}

export const DEFAULT_QUEUE_FILTERS: QueueFilterState = {
  riskLevel: '',
  language: '',
  dateFrom: '',
  dateTo: '',
  assignedToMe: false,
  sortBy: 'priority',
};
