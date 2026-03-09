import { useTranslation } from 'react-i18next';
import { SurveyQuestionType, REGEX_PRESETS } from '@mentalhelpglobal/chat-types';
import type { SurveyQuestionInput, VisibilityCondition } from '@mentalhelpglobal/chat-types';
import type { ChoiceOptionConfig } from '@mentalhelpglobal/chat-types';
import OptionListEditor from './OptionListEditor';
import OptionEditor from './OptionEditor';
import DataTypeSelector from './DataTypeSelector';
import RatingScaleConfigEditor from './RatingScaleConfigEditor';
import VisibilityConditionEditor from './VisibilityConditionEditor';
import VisibilityIndicator from './VisibilityIndicator';
import { Trash2 } from 'lucide-react';

const PRESET_TYPES = new Set([
  SurveyQuestionType.EMAIL, SurveyQuestionType.PHONE, SurveyQuestionType.URL,
  SurveyQuestionType.POSTAL_CODE, SurveyQuestionType.ALPHANUMERIC_CODE,
]);
const TEXT_VALIDATION_TYPES = new Set([SurveyQuestionType.FREE_TEXT, undefined]);
const NUMERIC_TYPES = new Set([
  SurveyQuestionType.INTEGER_SIGNED,
  SurveyQuestionType.INTEGER_UNSIGNED,
  SurveyQuestionType.DECIMAL,
]);
const DATE_TIME_TYPES = new Set([SurveyQuestionType.DATE, SurveyQuestionType.TIME, SurveyQuestionType.DATETIME]);

interface Props {
  question: SurveyQuestionInput;
  index: number;
  onChange: (updated: SurveyQuestionInput) => void;
  onRemove: () => void;
  disabled?: boolean;
  allQuestions?: { id: string; order: number; text: string; type: SurveyQuestionType; options: string[] | null }[];
}

export default function QuestionEditor({ question, index, onChange, onRemove, disabled, allQuestions }: Props) {
  const { t } = useTranslation();
  const isChoice = question.type === SurveyQuestionType.SINGLE_CHOICE || question.type === SurveyQuestionType.MULTI_CHOICE;
  const isFreeText = question.type === SurveyQuestionType.FREE_TEXT;
  const isRatingScale = question.type === SurveyQuestionType.RATING_SCALE;
  const isTextValidationType = TEXT_VALIDATION_TYPES.has(question.type);
  const isNumericType = NUMERIC_TYPES.has(question.type as SurveyQuestionType);
  const isDateTimeType = DATE_TIME_TYPES.has(question.type as SurveyQuestionType);
  const isPresetType = PRESET_TYPES.has(question.type as SurveyQuestionType);

  const handleTypeChange = (type: SurveyQuestionType) => {
    const updated: SurveyQuestionInput = { ...question, type };
    if (type === SurveyQuestionType.SINGLE_CHOICE || type === SurveyQuestionType.MULTI_CHOICE) {
      updated.options = question.options?.length ? question.options : [''];
      updated.validation = undefined;
    } else {
      updated.options = undefined;
      updated.optionConfigs = undefined;
    }
    if (type === SurveyQuestionType.RATING_SCALE) {
      updated.ratingScaleConfig = updated.ratingScaleConfig ?? { startValue: 1, endValue: 5, step: 1 };
      updated.validation = undefined;
    } else {
      updated.ratingScaleConfig = undefined;
    }
    if (type === SurveyQuestionType.FREE_TEXT) {
      updated.validation = updated.validation ?? {};
    } else if (!NUMERIC_TYPES.has(type) && !DATE_TIME_TYPES.has(type)) {
      updated.validation = undefined;
    }
    updated.dataType = undefined;
    if (PRESET_TYPES.has(type)) {
      updated.validation = { ...updated.validation, regex: REGEX_PRESETS[type] };
    }
    onChange(updated);
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
          {(question.visibilityCondition || (question.visibilityConditions && question.visibilityConditions.length > 0)) && (
            <VisibilityIndicator
              condition={(question.visibilityConditions?.[0] ?? question.visibilityCondition)!}
              sourceQuestionOrder={allQuestions?.find(q => q.id === (question.visibilityConditions?.[0] ?? question.visibilityCondition)?.questionId)?.order}
            />
          )}
        </div>
        {!disabled && (
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          <DataTypeSelector value={question.type} onChange={handleTypeChange} disabled={disabled} />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required !== false}
              onChange={(e) => onChange({ ...question, required: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-xs text-gray-500">{t('survey.question.required')}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={question.riskFlag === true}
              onChange={(e) => onChange({ ...question, riskFlag: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-xs text-gray-500">{t('survey.question.riskFlag')}</span>
          </label>
        </div>

        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          disabled={disabled}
          placeholder={t('survey.question.textPlaceholder')}
          className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          maxLength={500}
        />

        {isChoice && (
          <>
            <OptionListEditor
              options={question.options ?? []}
              onChange={(options) => {
                const newOptions = options;
                // Sync optionConfigs: remove configs for removed options, update labels for renamed options.
                // Prefer positional match so renaming an option preserves its freetext config.
                const oldConfigs: ChoiceOptionConfig[] = question.optionConfigs ?? [];
                const newConfigs: ChoiceOptionConfig[] = newOptions.map((label, i) => {
                  // 1. Exact label match (no rename, same label still present)
                  const byLabel = oldConfigs.find(c => c.label === label);
                  if (byLabel) return { ...byLabel, label };
                  // 2. Positional match (rename — keep freetext settings, update label)
                  const byPosition = oldConfigs[i];
                  if (byPosition) return { ...byPosition, label };
                  // 3. New option with no prior config
                  return { label, freetextEnabled: false };
                });
                onChange({ ...question, options: newOptions, optionConfigs: newConfigs });
              }}
              disabled={disabled}
            />
            <div className="space-y-1 mt-1">
              {(question.options ?? []).map((label, i) => (
                <OptionEditor
                  key={i}
                  label={label}
                  config={(question.optionConfigs ?? [])[i]}
                  onChange={(cfg) => {
                    const configs = [...(question.optionConfigs ?? (question.options ?? []).map(l => ({ label: l, freetextEnabled: false as const })))];
                    configs[i] = cfg;
                    onChange({ ...question, optionConfigs: configs });
                  }}
                  disabled={disabled}
                />
              ))}
            </div>
          </>
        )}

        {(isFreeText || isRatingScale || isNumericType || isDateTimeType || isPresetType) && (
          <div className="space-y-2">
            {isTextValidationType && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.minLength')}</label>
                  <input
                    type="number"
                    min={0}
                    value={question.validation?.minLength ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, minLength: e.target.value ? Number(e.target.value) : undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.maxLength')}</label>
                  <input
                    type="number"
                    min={0}
                    value={question.validation?.maxLength ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, maxLength: e.target.value ? Number(e.target.value) : undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.regex')}</label>
                  <input
                    type="text"
                    value={question.validation?.regex ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, regex: e.target.value || undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}

            {isNumericType && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.minValue')}</label>
                  <input
                    type="number"
                    value={question.validation?.minValue ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, minValue: e.target.value ? Number(e.target.value) : undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.maxValue')}</label>
                  <input
                    type="number"
                    value={question.validation?.maxValue ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, maxValue: e.target.value ? Number(e.target.value) : undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}

            {isDateTimeType && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.min')}</label>
                  <input
                    type="text"
                    value={question.validation?.min ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, min: e.target.value || undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('survey.question.max')}</label>
                  <input
                    type="text"
                    value={question.validation?.max ?? ''}
                    onChange={(e) => onChange({
                      ...question,
                      validation: { ...question.validation, max: e.target.value || undefined },
                    })}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}

            {isRatingScale && (
              <RatingScaleConfigEditor
                config={question.ratingScaleConfig}
                onChange={(cfg) => onChange({ ...question, ratingScaleConfig: cfg })}
                disabled={disabled}
              />
            )}

            {isPresetType && (
              <div>
                <label className="text-xs text-gray-500">{t('survey.question.regex')}</label>
                <input
                  type="text"
                  value={REGEX_PRESETS[question.type] ?? ''}
                  disabled
                  className="w-full px-2 py-1 text-sm border rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            )}
          </div>
        )}

        {index > 0 && allQuestions && (
          <VisibilityConditionEditor
            condition={question.visibilityCondition ?? null}
            onChange={(cond) => onChange({ ...question, visibilityCondition: cond ?? undefined })}
            visibilityConditions={question.visibilityConditions ?? null}
            visibilityConditionCombinator={question.visibilityConditionCombinator ?? null}
            onChangeMulti={(conditions: VisibilityCondition[], combinator: 'and' | 'or') =>
              onChange({
                ...question,
                visibilityConditions: conditions.length > 0 ? conditions : undefined,
                visibilityConditionCombinator: combinator,
                // Keep legacy field in sync with first condition for backward compat
                visibilityCondition: conditions.length > 0 ? conditions[0] : undefined,
              })
            }
            availableQuestions={allQuestions.filter(q => q.order < index + 1)}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
