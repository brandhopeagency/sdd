import { useTranslation } from 'react-i18next';
import type { SurveyQuestion } from '@mentalhelpglobal/chat-types';

interface Props {
  question: SurveyQuestion;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

export default function BooleanInput({ question, value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <label
        className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
          value === true ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          name={`q-${question.id}`}
          checked={value === true}
          onChange={() => onChange(true)}
          className="w-4 h-4 text-indigo-600"
        />
        <span className="text-sm font-medium">{t('surveyGate.yes')}</span>
      </label>
      <label
        className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
          value === false ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          name={`q-${question.id}`}
          checked={value === false}
          onChange={() => onChange(false)}
          className="w-4 h-4 text-indigo-600"
        />
        <span className="text-sm font-medium">{t('surveyGate.no')}</span>
      </label>
    </div>
  );
}
