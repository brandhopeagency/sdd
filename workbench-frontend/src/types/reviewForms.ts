import type { CriterionKey } from '@mentalhelpglobal/chat-types';

export type CriteriaFeedbackFormState = Record<CriterionKey, string>;

export const EMPTY_CRITERIA_FEEDBACK: CriteriaFeedbackFormState = {
  relevance: '',
  empathy: '',
  safety: '',
  ethics: '',
  clarity: '',
};

export interface RiskFlagFormState {
  severity: string;
  reasonCategory: string;
  details: string;
  requestDeanonymization: boolean;
  deanonymizationJustification: string;
}
