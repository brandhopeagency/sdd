import { useTranslation } from 'react-i18next';
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';

interface Props {
  value: SurveyQuestionType | undefined;
  onChange: (type: SurveyQuestionType) => void;
  disabled?: boolean;
}

const QUESTION_TYPE_GROUPS = [
  {
    labelKey: 'survey.questionType.group.numeric',
    options: [
      { value: SurveyQuestionType.INTEGER_SIGNED, labelKey: 'survey.question.type.integer_signed' },
      { value: SurveyQuestionType.INTEGER_UNSIGNED, labelKey: 'survey.question.type.integer_unsigned' },
      { value: SurveyQuestionType.DECIMAL, labelKey: 'survey.question.type.decimal' },
    ],
  },
  {
    labelKey: 'survey.questionType.group.dateTime',
    options: [
      { value: SurveyQuestionType.DATE, labelKey: 'survey.question.type.date' },
      { value: SurveyQuestionType.TIME, labelKey: 'survey.question.type.time' },
      { value: SurveyQuestionType.DATETIME, labelKey: 'survey.question.type.datetime' },
    ],
  },
  {
    labelKey: 'survey.questionType.group.ratingScale',
    options: [
      { value: SurveyQuestionType.RATING_SCALE, labelKey: 'survey.question.type.rating_scale' },
    ],
  },
  {
    labelKey: 'survey.questionType.group.presets',
    options: [
      { value: SurveyQuestionType.EMAIL, labelKey: 'survey.question.type.email' },
      { value: SurveyQuestionType.PHONE, labelKey: 'survey.question.type.phone' },
      { value: SurveyQuestionType.URL, labelKey: 'survey.question.type.url' },
      { value: SurveyQuestionType.POSTAL_CODE, labelKey: 'survey.question.type.postal_code' },
      { value: SurveyQuestionType.ALPHANUMERIC_CODE, labelKey: 'survey.question.type.alphanumeric_code' },
    ],
  },
  {
    labelKey: 'survey.questionType.group.text',
    options: [
      { value: SurveyQuestionType.FREE_TEXT, labelKey: 'survey.question.type.free_text' },
    ],
  },
  {
    labelKey: 'survey.questionType.group.selection',
    options: [
      { value: SurveyQuestionType.SINGLE_CHOICE, labelKey: 'survey.question.type.single_choice' },
      { value: SurveyQuestionType.MULTI_CHOICE, labelKey: 'survey.question.type.multi_choice' },
      { value: SurveyQuestionType.BOOLEAN, labelKey: 'survey.question.type.boolean' },
    ],
  },
];

export default function DataTypeSelector({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <select
      value={value ?? SurveyQuestionType.FREE_TEXT}
      onChange={(e) => onChange(e.target.value as SurveyQuestionType)}
      disabled={disabled}
      className="px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
    >
      {QUESTION_TYPE_GROUPS.map((group) => (
        <optgroup key={group.labelKey} label={t(group.labelKey)}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
