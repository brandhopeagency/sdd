import { useTranslation } from 'react-i18next';
import type { SurveyQuestion } from '@mentalhelpglobal/chat-types';
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';
import NumericInput from './NumericInput';
import DateTimeInput from './DateTimeInput';
import PresetTextInput from './PresetTextInput';
import RatingScaleInput from './RatingScaleInput';

interface Props {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

const NUMERIC_TYPES = new Set([
  SurveyQuestionType.INTEGER_SIGNED,
  SurveyQuestionType.INTEGER_UNSIGNED,
  SurveyQuestionType.DECIMAL,
]);

const DATETIME_TYPES = new Set([
  SurveyQuestionType.DATE,
  SurveyQuestionType.TIME,
  SurveyQuestionType.DATETIME,
]);

const PRESET_TYPES = new Set([
  SurveyQuestionType.EMAIL,
  SurveyQuestionType.PHONE,
  SurveyQuestionType.URL,
  SurveyQuestionType.POSTAL_CODE,
  SurveyQuestionType.ALPHANUMERIC_CODE,
]);

export default function FreeTextInput({ question, value, onChange }: Props) {
  const { t } = useTranslation();
  const type = question.type;

  if (NUMERIC_TYPES.has(type as SurveyQuestionType)) {
    return <NumericInput questionType={type} value={value} onChange={onChange} />;
  }

  if (DATETIME_TYPES.has(type as SurveyQuestionType)) {
    return <DateTimeInput questionType={type} value={value} onChange={onChange} />;
  }

  if (PRESET_TYPES.has(type as SurveyQuestionType)) {
    return <PresetTextInput questionType={type} value={value} onChange={onChange} />;
  }

  if (type === SurveyQuestionType.RATING_SCALE && question.ratingScaleConfig) {
    return (
      <RatingScaleInput
        config={question.ratingScaleConfig}
        value={value}
        onChange={onChange}
      />
    );
  }

  const validation = question.validation;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-[100px]"
      placeholder={t('surveyGate.typeAnswer')}
      minLength={validation?.minLength ?? undefined}
      maxLength={validation?.maxLength ?? undefined}
    />
  );
}
