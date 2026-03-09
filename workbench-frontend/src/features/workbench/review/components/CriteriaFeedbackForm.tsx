import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CriterionKey } from '@mentalhelpglobal/chat-types';
import type { CriteriaFeedbackFormState } from '@/types/reviewForms';

interface CriteriaFeedbackFormProps {
  score: number;
  criteriaThreshold: number;
  feedback: CriteriaFeedbackFormState;
  onChange: (feedback: CriteriaFeedbackFormState) => void;
  disabled?: boolean;
}

const CRITERIA_KEYS: CriterionKey[] = ['relevance', 'empathy', 'safety', 'ethics', 'clarity'];

export default function CriteriaFeedbackForm({
  score,
  criteriaThreshold,
  feedback,
  onChange,
  disabled = false,
}: CriteriaFeedbackFormProps) {
  const { t } = useTranslation();
  const [checkedCriteria, setCheckedCriteria] = useState<Set<CriterionKey>>(() => {
    const initial = new Set<CriterionKey>();
    CRITERIA_KEYS.forEach((key) => {
      if (feedback[key].trim().length > 0) initial.add(key);
    });
    return initial;
  });

  const isRequired = score <= criteriaThreshold;

  const toggleCheck = useCallback((key: CriterionKey) => {
    setCheckedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        onChange({ ...feedback, [key]: '' });
      } else {
        next.add(key);
        if (!feedback[key]) {
          onChange({ ...feedback, [key]: key });
        }
      }
      return next;
    });
  }, [feedback, onChange]);

  const handleFeedbackChange = useCallback(
    (key: CriterionKey, value: string) => {
      onChange({ ...feedback, [key]: value });
    },
    [feedback, onChange],
  );

  const criterionName = (key: CriterionKey) => t(`review.criteria.${key}.name`);
  const criterionDescription = (key: CriterionKey) => t(`review.criteria.${key}.description`);

  const checkedCount = checkedCriteria.size;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          {t('review.criteriaFeedback.title')}
        </h3>
        {isRequired && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {t('review.criteriaFeedback.required')}
          </span>
        )}
      </div>

      {isRequired && (
        <p className="text-xs text-neutral-500">
          {t('review.criteriaFeedback.checkboxHint', { threshold: criteriaThreshold })}
        </p>
      )}

      <div className="space-y-2">
        {CRITERIA_KEYS.map((key) => {
          const isChecked = checkedCriteria.has(key);

          return (
            <div
              key={key}
              className={`
                overflow-hidden rounded-lg border transition-colors duration-150
                ${isChecked ? 'border-blue-200 bg-blue-50/30' : 'border-neutral-200 bg-white'}
              `}
            >
              {/* Checkbox header */}
              <label
                className={`
                  flex items-center gap-3 px-4 py-3
                  ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-50'}
                `}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(key)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-neutral-800">
                    {criterionName(key)}
                  </span>
                  <p className="text-xs text-neutral-500 mt-0.5">{criterionDescription(key)}</p>
                </div>
              </label>

              {/* Optional feedback text */}
              {isChecked && (
                <div className="border-t border-neutral-100 px-4 pb-3 pt-2">
                  <textarea
                    id={`criteria-${key}-textarea`}
                    value={feedback[key] === key ? '' : feedback[key]}
                    onChange={(e) => handleFeedbackChange(key, e.target.value || key)}
                    disabled={disabled}
                    placeholder={t('review.criteriaFeedback.optionalDetail')}
                    rows={2}
                    className={`
                      w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm
                      placeholder:text-neutral-400
                      focus:outline-none focus:ring-2 focus:ring-sky-300
                      ${disabled ? 'cursor-not-allowed bg-neutral-50' : 'bg-white'}
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isRequired && checkedCount === 0 && (
        <p className="text-xs text-red-500">{t('review.criteriaFeedback.selectAtLeastOne')}</p>
      )}
    </div>
  );
}
