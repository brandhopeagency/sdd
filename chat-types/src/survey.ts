/**
 * Survey Module types
 *
 * Covers schemas, instances, responses, gate-check payloads,
 * group survey ordering, and visibility evaluation
 * for the Workbench Survey Module (MHG-SURV-001 / 019).
 */

// ── Enums ──

export enum SurveySchemaStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum SurveyInstanceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CLOSED = 'closed'
}

export enum SurveyQuestionType {
  FREE_TEXT = 'free_text',
  INTEGER_SIGNED = 'integer_signed',
  INTEGER_UNSIGNED = 'integer_unsigned',
  DECIMAL = 'decimal',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  POSTAL_CODE = 'postal_code',
  ALPHANUMERIC_CODE = 'alphanumeric_code',
  RATING_SCALE = 'rating_scale',
  SINGLE_CHOICE = 'single_choice',
  MULTI_CHOICE = 'multi_choice',
  BOOLEAN = 'boolean'
}

export enum FreeTextDataType {
  TEXT = 'text',
  INTEGER_SIGNED = 'integer_signed',
  INTEGER_UNSIGNED = 'integer_unsigned',
  DECIMAL = 'decimal',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  POSTAL_CODE = 'postal_code',
  ALPHANUMERIC_CODE = 'alphanumeric_code',
  RATING_SCALE = 'rating_scale'
}

export enum VisibilityConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains'
}

// ── Constants ──

export const REGEX_PRESETS: Record<string, string> = {
  email: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$',
  phone: '^\\+?[0-9\\s\\-().]{7,20}$',
  url: '^https?:\\/\\/[^\\s/$.?#].[^\\s]*$',
  postal_code: '^[a-zA-Z0-9\\s\\-]{3,10}$',
  alphanumeric_code: '^[a-zA-Z0-9]+$',
};

// ── Embedded JSONB types ──

export interface RatingScaleConfig {
  startValue: number;
  endValue: number;
  step: number;
}

export interface VisibilityCondition {
  questionId: string;
  operator: VisibilityConditionOperator;
  value: string | string[] | boolean;
}

/** Input type for an inline freetext field on a choice option. */
export type FreetextInputType = 'string' | 'number';

/**
 * Per-option freetext configuration for single_choice / multi_choice questions.
 * Discriminated on `freetextEnabled` — freetext fields are structurally absent
 * when disabled, preventing contradictory state at compile time.
 *
 * `label` must exactly match a string in the parent question's `options[]`
 * (case-sensitive). Options without a matching entry are treated as freetext-disabled.
 */
export type ChoiceOptionConfig =
  | { label: string; freetextEnabled: false }
  | {
      label: string;
      freetextEnabled: true;
      /** Whether to accept any text ('string') or numeric input only ('number'). */
      freetextType: FreetextInputType;
      /** If true, the freetext field must be non-empty when this option is selected. */
      freetextRequired?: boolean;
    };

export interface SurveyQuestionValidation {
  regex?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  min?: string | null;
  max?: string | null;
}

export interface SurveyQuestion {
  id: string;
  order: number;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  options: string[] | null;
  validation: SurveyQuestionValidation | null;
  riskFlag: boolean;
  /** @deprecated Legacy snapshot compatibility only. Prefer `type`. */
  dataType?: FreeTextDataType;
  ratingScaleConfig?: RatingScaleConfig | null;

  // Existing single-condition — deprecated, preserved for backward compat
  /** @deprecated Use visibilityConditions instead */
  visibilityCondition?: VisibilityCondition | null;

  // Multi-condition visibility (new)
  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;  // defaults to 'and' when omitted

  // Per-option freetext configuration (single_choice / multi_choice only)
  optionConfigs?: ChoiceOptionConfig[] | null;
}

export interface SurveyQuestionInput {
  type: SurveyQuestionType;
  text: string;
  required?: boolean;
  options?: string[] | null;
  validation?: SurveyQuestionValidation | null;
  riskFlag?: boolean;
  dataType?: FreeTextDataType;
  ratingScaleConfig?: RatingScaleConfig | null;

  /** @deprecated Use visibilityConditions instead */
  visibilityCondition?: VisibilityCondition | null;

  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;
  optionConfigs?: ChoiceOptionConfig[] | null;
}

export interface SurveyAnswer {
  questionId: string;
  value: string | string[] | boolean | null;
  visible?: boolean;
  // captures freetext entry per selected option label (key = option label, value = freetext)
  freetextValues?: Record<string, string> | null;
}

// ── Entity interfaces ──

export interface SurveySchema {
  id: string;
  title: string;
  description: string | null;
  status: SurveySchemaStatus;
  questions: SurveyQuestion[];
  clonedFromId: string | null;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export interface SurveyInstance {
  id: string;
  schemaId: string;
  schemaSnapshot: SurveySchema;
  title: string;
  status: SurveyInstanceStatus;
  publicHeader?: string | null;
  showReview?: boolean;
  addToMemory?: boolean;
  groupIds: string[];
  startDate: string;
  expirationDate: string;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  completedCount?: number;
}

export interface SurveyResponse {
  id: string;
  instanceId: string;
  pseudonymousId: string;
  groupId?: string | null;
  answers: SurveyAnswer[];
  startedAt: string;
  completedAt: string | null;
  isComplete: boolean;
  invalidatedAt?: string | null;
  invalidatedBy?: string | null;
  invalidationReason?: string | null;
}

// ── List/summary types ──

export interface SurveySchemaListItem {
  id: string;
  title: string;
  status: SurveySchemaStatus;
  questionCount: number;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface SurveyInstanceListItem {
  id: string;
  schemaId: string;
  title: string;
  status: SurveyInstanceStatus;
  publicHeader?: string | null;
  showReview?: boolean;
  addToMemory?: boolean;
  groupIds: string[];
  startDate: string;
  expirationDate: string;
  completedCount: number;
  createdAt: string;
}

export interface GroupSurveyOrderItem {
  instanceId: string;
  title: string;
  publicHeader?: string | null;
  status: SurveyInstanceStatus;
  displayOrder: number;
  startDate: string;
  expirationDate: string;
  completedCount: number;
  showReview?: boolean;
}

/**
 * Returned by the gate-check endpoint.
 * Contains the instance snapshot and any existing partial response.
 */
export interface PendingSurvey {
  instance: SurveyInstance;
  existingResponse: SurveyResponse | null;
}

// ── Visibility Evaluation ──

/**
 * Pure function that evaluates which questions are visible based on
 * visibility conditions and current answers.
 *
 * Handles all five operators (equals, not_equals, in, not_in, contains),
 * transitive chains, and unanswered source questions (condition → false).
 * Multi-condition logic uses the AND/OR combinator from `visibilityConditions`;
 * legacy single-condition (`visibilityCondition`) is supported for backward compat.
 *
 * @param questions - Ordered array of survey questions (by `order` ASC)
 * @param answers - Map of questionId → current answer value
 * @returns Map of questionId → isVisible
 */
export function evaluateVisibility(
  questions: SurveyQuestion[],
  answers: Map<string, SurveyAnswer['value']>,
): Map<string, boolean> {
  const visibility = new Map<string, boolean>();

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  for (const q of sorted) {
    // visibilityConditions takes precedence over the legacy single-condition field.
    // An explicitly set array (even empty) suppresses the legacy field so that
    // clearing all conditions works correctly during schema migration.
    if (q.visibilityConditions !== null && q.visibilityConditions !== undefined) {
      if (q.visibilityConditions.length === 0) {
        // Explicitly cleared — unconditionally visible
        visibility.set(q.id, true);
      } else {
        const combinator = q.visibilityConditionCombinator ?? 'and';
        const results = q.visibilityConditions.map(
          cond => evaluateSingleCondition(cond, answers, visibility),
        );
        const visible = combinator === 'or'
          ? results.some(Boolean)
          : results.every(Boolean);
        visibility.set(q.id, visible);
      }
    } else if (q.visibilityCondition) {
      // Legacy single-condition path (backward compat)
      visibility.set(q.id, evaluateSingleCondition(q.visibilityCondition, answers, visibility));
    } else {
      // No condition — unconditionally visible
      visibility.set(q.id, true);
    }
  }

  return visibility;
}

function evaluateSingleCondition(
  cond: VisibilityCondition,
  answers: Map<string, SurveyAnswer['value']>,
  visibility: Map<string, boolean>,
): boolean {
  // If the source question is hidden, not yet evaluated (forward reference), or
  // not present in the question list at all, the condition evaluates to false.
  if (visibility.get(cond.questionId) !== true) {
    return false;
  }

  const sourceAnswer = answers.get(cond.questionId);

  if (sourceAnswer === null || sourceAnswer === undefined) {
    return false;
  }

  return evaluateCondition(cond.operator, sourceAnswer, cond.value);
}

function evaluateCondition(
  operator: VisibilityConditionOperator,
  answer: NonNullable<SurveyAnswer['value']>,
  expected: VisibilityCondition['value'],
): boolean {
  switch (operator) {
    case VisibilityConditionOperator.EQUALS:
      return deepEquals(answer, expected);

    case VisibilityConditionOperator.NOT_EQUALS:
      return !deepEquals(answer, expected);

    case VisibilityConditionOperator.IN: {
      if (!Array.isArray(expected)) return false;
      if (typeof answer === 'string') return expected.includes(answer);
      if (typeof answer === 'boolean') return expected.includes(String(answer));
      // multi-choice answer: visible if any selected value is in the list
      if (Array.isArray(answer)) return answer.some(v => expected.includes(v));
      return false;
    }

    case VisibilityConditionOperator.NOT_IN: {
      if (!Array.isArray(expected)) return false;
      if (typeof answer === 'string') return !expected.includes(answer);
      if (typeof answer === 'boolean') return !expected.includes(String(answer));
      // multi-choice answer: visible only if none of the selected values are in the list
      if (Array.isArray(answer)) return !answer.some(v => expected.includes(v));
      return false;
    }

    case VisibilityConditionOperator.CONTAINS: {
      if (Array.isArray(answer) && typeof expected === 'string') {
        return answer.includes(expected);
      }
      return deepEquals(answer, expected);
    }

    default:
      // Unknown operator — hide the dependent question rather than silently show it.
      // This handles future operators not yet implemented in this version.
      return false;
  }
}

// ── Schema Export/Import Format ──

/** Question shape for v1 export files (legacy `visibilityCondition` only). */
export interface ExportQuestionV1 {
  id: string;
  order: number;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  options: string[] | null;
  validation: SurveyQuestionValidation | null;
  ratingScaleConfig: RatingScaleConfig | null;
  visibilityCondition: VisibilityCondition | null;
  riskFlag: boolean;
}

/** Question shape for v2 export files (multi-condition + freetext options). */
export interface ExportQuestionV2 extends ExportQuestionV1 {
  visibilityConditions: VisibilityCondition[] | null;
  visibilityConditionCombinator: 'and' | 'or' | null;
  optionConfigs: ChoiceOptionConfig[] | null;
}

/**
 * @deprecated Use `ExportQuestionV2` for new code; kept for backward compatibility
 * with existing importers that reference `ExportQuestion` directly.
 */
export type ExportQuestion = ExportQuestionV2;

/** v1 export file — only `visibilityCondition` (singular) per question. */
export interface SchemaExportV1 {
  schemaVersion: 1;
  title: string;
  description: string | null;
  questions: ExportQuestionV1[];
}

/** v2 export file — multi-condition visibility + freetext option configs. */
export interface SchemaExportV2 {
  schemaVersion: 2;
  title: string;
  description: string | null;
  questions: ExportQuestionV2[];
}

/**
 * Discriminated union on `schemaVersion`.
 * Importers should switch on `schemaVersion` for exhaustive handling:
 * ```
 * if (data.schemaVersion === 1) { // data.questions: ExportQuestionV1[] }
 * if (data.schemaVersion === 2) { // data.questions: ExportQuestionV2[] }
 * ```
 */
export type SchemaExportFormat = SchemaExportV1 | SchemaExportV2;

export const CURRENT_SCHEMA_EXPORT_VERSION = 2;

function deepEquals(
  a: NonNullable<SurveyAnswer['value']>,
  b: VisibilityCondition['value'],
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...(b as string[])].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  if (typeof a === 'boolean') return String(a) === String(b);
  return a === b;
}
