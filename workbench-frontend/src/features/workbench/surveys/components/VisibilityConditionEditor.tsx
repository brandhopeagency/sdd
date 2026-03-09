import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VisibilityConditionOperator, SurveyQuestionType } from '@mentalhelpglobal/chat-types';
import type { VisibilityCondition } from '@mentalhelpglobal/chat-types';
import { X, Plus } from 'lucide-react';

interface Props {
  // Multi-condition props (new)
  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;
  onChangeMulti?: (conditions: VisibilityCondition[], combinator: 'and' | 'or') => void;

  // Legacy single-condition props (backward compat)
  condition?: VisibilityCondition | null;
  onChange?: (condition: VisibilityCondition | null) => void;

  availableQuestions: { id: string; order: number; text: string; type: SurveyQuestionType; options: string[] | null }[];
  disabled?: boolean;
}

const OPERATORS = [
  { value: VisibilityConditionOperator.EQUALS, labelKey: 'survey.condition.equals' },
  { value: VisibilityConditionOperator.NOT_EQUALS, labelKey: 'survey.condition.notEquals' },
  { value: VisibilityConditionOperator.IN, labelKey: 'survey.condition.in' },
  { value: VisibilityConditionOperator.NOT_IN, labelKey: 'survey.condition.operator.not_in' },
  { value: VisibilityConditionOperator.CONTAINS, labelKey: 'survey.condition.contains' },
];

const MULTI_VALUE_OPS = new Set([
  VisibilityConditionOperator.IN,
  VisibilityConditionOperator.NOT_IN,
]);

function isMultiValueOp(op: VisibilityConditionOperator): boolean {
  return MULTI_VALUE_OPS.has(op);
}

function getStringValue(v: VisibilityCondition['value']): string {
  if (Array.isArray(v)) return '';
  if (typeof v === 'boolean') return String(v);
  return v ?? '';
}

function getArrayValue(v: VisibilityCondition['value']): string[] {
  if (Array.isArray(v)) return v as string[];
  return [];
}

// ── Tag multi-value input ──────────────────────────────────────────────────

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

function TagInput({ values, onChange, disabled }: TagInputProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const addValue = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addValue(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const removeValue = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-wrap gap-1 px-2 py-1 border rounded-md min-h-[28px] bg-white disabled:bg-gray-50 focus-within:ring-1 focus-within:ring-indigo-500">
      {values.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">
          {v}
          {!disabled && (
            <button type="button" onClick={() => removeValue(i)} className="text-indigo-400 hover:text-indigo-700">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addValue(inputValue); }}
          placeholder={values.length === 0 ? t('survey.condition.multiValue.placeholder') : ''}
          className="flex-1 min-w-[80px] text-xs outline-none bg-transparent"
        />
      )}
    </div>
  );
}

// ── Single condition row ───────────────────────────────────────────────────

interface ConditionRowProps {
  condition: VisibilityCondition;
  availableQuestions: Props['availableQuestions'];
  onChange: (updated: VisibilityCondition) => void;
  onRemove: () => void;
  disabled?: boolean;
  showIf: boolean;
}

function ConditionRow({ condition, availableQuestions, onChange, onRemove, disabled, showIf }: ConditionRowProps) {
  const { t } = useTranslation();
  const sourceQuestion = availableQuestions.find(q => q.id === condition.questionId);

  const handleOperatorChange = (op: VisibilityConditionOperator) => {
    const wasMulti = isMultiValueOp(condition.operator);
    const willBeMulti = isMultiValueOp(op);
    let nextValue = condition.value;
    if (wasMulti && !willBeMulti) {
      nextValue = '';
    } else if (!wasMulti && willBeMulti) {
      nextValue = [];
    }
    onChange({ ...condition, operator: op, value: nextValue });
  };

  const renderValueInput = () => {
    if (!sourceQuestion) return null;

    if (isMultiValueOp(condition.operator)) {
      return (
        <TagInput
          values={getArrayValue(condition.value)}
          onChange={(vals) => onChange({ ...condition, value: vals })}
          disabled={disabled}
        />
      );
    }

    if (sourceQuestion.type === SurveyQuestionType.BOOLEAN) {
      return (
        <select
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value === 'true' })}
          disabled={disabled}
          className="px-2 py-1 text-xs border rounded-md disabled:bg-gray-50"
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </select>
      );
    }

    if (sourceQuestion.type === SurveyQuestionType.SINGLE_CHOICE && sourceQuestion.options) {
      return (
        <select
          value={getStringValue(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          disabled={disabled}
          className="px-2 py-1 text-xs border rounded-md disabled:bg-gray-50"
        >
          <option value="">{t('survey.condition.selectValue')}</option>
          {sourceQuestion.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={getStringValue(condition.value)}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        disabled={disabled}
        placeholder={t('survey.condition.valuePlaceholder')}
        className="px-2 py-1 text-xs border rounded-md disabled:bg-gray-50 w-24"
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-md border border-indigo-200">
      {showIf && (
        <span className="text-xs text-indigo-600 font-medium shrink-0">{t('survey.condition.ifLabel')}</span>
      )}

      <select
        value={condition.questionId}
        onChange={(e) => onChange({ ...condition, questionId: e.target.value })}
        disabled={disabled}
        className="px-2 py-1 text-xs border rounded-md disabled:bg-gray-50 max-w-[120px]"
      >
        {availableQuestions.map((q) => (
          <option key={q.id} value={q.id}>Q{q.order}: {q.text.slice(0, 30)}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as VisibilityConditionOperator)}
        disabled={disabled}
        className="px-2 py-1 text-xs border rounded-md disabled:bg-gray-50"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{t(op.labelKey)}</option>
        ))}
      </select>

      {renderValueInput()}

      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 shrink-0"
          aria-label={t('survey.condition.removeCondition')}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function VisibilityConditionEditor({
  visibilityConditions,
  visibilityConditionCombinator,
  onChangeMulti,
  condition,
  onChange,
  availableQuestions,
  disabled,
}: Props) {
  const { t } = useTranslation();

  // Normalise incoming data: prefer multi-condition props; fall back to legacy
  const [conditions, setConditions] = useState<VisibilityCondition[]>(() => {
    if (visibilityConditions && visibilityConditions.length > 0) return visibilityConditions;
    if (condition) return [condition];
    return [];
  });
  const [combinator, setCombinator] = useState<'and' | 'or'>(visibilityConditionCombinator ?? 'and');
  const [staleWarning, setStaleWarning] = useState(false);

  // Pending stale-cleanup notification: set when stale conditions are removed,
  // then propagated to the parent in a dedicated effect to avoid calling onChange
  // inside the sync effect (which would cause an extra render loop).
  const pendingStaleCleanup = useRef<{ filtered: VisibilityCondition[]; combinator: 'and' | 'or' } | null>(null);

  // Sync from props when they change
  useEffect(() => {
    let next: VisibilityCondition[];
    if (visibilityConditions && visibilityConditions.length > 0) {
      next = visibilityConditions;
    } else if (condition) {
      next = [condition];
    } else {
      next = [];
    }

    // T040: filter stale conditions whose questionId is not in availableQuestions
    const validIds = new Set(availableQuestions.map(q => q.id));
    const filtered = next.filter(c => validIds.has(c.questionId));
    if (filtered.length < next.length) {
      setStaleWarning(true);
      // Schedule parent notification — do NOT call onChange here to avoid
      // calling a parent state-setter while this effect is still flushing,
      // which would trigger an immediate re-render loop.
      pendingStaleCleanup.current = { filtered, combinator: visibilityConditionCombinator ?? 'and' };
      next = filtered;
    } else {
      setStaleWarning(false);
      pendingStaleCleanup.current = null;
    }

    setConditions(next);
    setCombinator(visibilityConditionCombinator ?? 'and');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityConditions, condition, availableQuestions, visibilityConditionCombinator]);

  // Propagate stale-cleanup to parent after the above effect has settled.
  useEffect(() => {
    const pending = pendingStaleCleanup.current;
    if (!pending) return;
    pendingStaleCleanup.current = null;
    if (onChangeMulti) {
      onChangeMulti(pending.filtered, pending.combinator);
    } else if (onChange) {
      onChange(pending.filtered.length > 0 ? pending.filtered[0] : null);
    }
  // onChangeMulti / onChange are intentionally omitted — they are stable
  // function refs from the parent but are not memoized; including them would
  // re-fire this effect on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleWarning]);

  if (availableQuestions.length === 0) return null;

  const propagate = (nextConditions: VisibilityCondition[], nextCombinator: 'and' | 'or') => {
    setConditions(nextConditions);
    setCombinator(nextCombinator);

    if (onChangeMulti) {
      onChangeMulti(nextConditions, nextCombinator);
    } else if (onChange) {
      // Legacy callback: pass first condition or null
      onChange(nextConditions.length > 0 ? nextConditions[0] : null);
    }
  };

  const handleAddCondition = () => {
    const defaultQ = availableQuestions[0];
    const newCond: VisibilityCondition = {
      questionId: defaultQ.id,
      operator: VisibilityConditionOperator.EQUALS,
      value: '',
    };
    propagate([...conditions, newCond], combinator);
  };

  const handleUpdateCondition = (idx: number, updated: VisibilityCondition) => {
    const next = conditions.map((c, i) => i === idx ? updated : c);
    propagate(next, combinator);
  };

  const handleRemoveCondition = (idx: number) => {
    const next = conditions.filter((_, i) => i !== idx);
    propagate(next, combinator);
  };

  const handleCombinatorChange = (next: 'and' | 'or') => {
    propagate(conditions, next);
  };

  if (conditions.length === 0) {
    return (
      <button
        type="button"
        onClick={handleAddCondition}
        disabled={disabled}
        className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      >
        {t('survey.condition.add')}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {staleWarning && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {t('survey.condition.staleRemoved')}
        </p>
      )}

      {conditions.map((cond, idx) => (
        <div key={idx}>
          {idx > 0 && conditions.length >= 2 && (
            <div className="flex items-center gap-1 my-1 ml-2">
              <button
                type="button"
                onClick={() => handleCombinatorChange('and')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                  combinator === 'and'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                } disabled:opacity-50`}
              >
                {t('survey.condition.combinator.and')}
              </button>
              <button
                type="button"
                onClick={() => handleCombinatorChange('or')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                  combinator === 'or'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                } disabled:opacity-50`}
              >
                {t('survey.condition.combinator.or')}
              </button>
            </div>
          )}
          <ConditionRow
            condition={cond}
            availableQuestions={availableQuestions}
            onChange={(updated) => handleUpdateCondition(idx, updated)}
            onRemove={() => handleRemoveCondition(idx)}
            disabled={disabled}
            showIf={idx === 0}
          />
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={handleAddCondition}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
        >
          <Plus className="w-3 h-3" />
          {t('survey.condition.addCondition')}
        </button>
      )}
    </div>
  );
}
