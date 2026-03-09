import { useTranslation } from 'react-i18next';
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';

interface Props {
  questionType: SurveyQuestionType;
  value: string;
  onChange: (value: string) => void;
}

export default function DateTimeInput({ questionType, value, onChange }: Props) {
  const { t } = useTranslation();

  const inputType = questionType === SurveyQuestionType.DATE ? 'date'
    : questionType === SurveyQuestionType.TIME ? 'time'
    : 'datetime-local';

  return (
    <input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      placeholder={t('surveyGate.typeAnswer')}
    />
  );
}
