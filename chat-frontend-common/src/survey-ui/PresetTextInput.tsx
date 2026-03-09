import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SurveyQuestionType, REGEX_PRESETS } from '@mentalhelpglobal/chat-types';

interface Props {
  questionType: SurveyQuestionType;
  value: string;
  onChange: (value: string) => void;
}

const INPUT_MODES: Partial<Record<SurveyQuestionType, string>> = {
  [SurveyQuestionType.EMAIL]: 'email',
  [SurveyQuestionType.PHONE]: 'tel',
  [SurveyQuestionType.URL]: 'url',
};

export default function PresetTextInput({ questionType, value, onChange }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  const validate = useCallback((val: string) => {
    if (!val) { setError(''); return; }
    const pattern = REGEX_PRESETS[questionType];
    if (pattern && !new RegExp(pattern).test(val)) {
      setError(t(`surveyGate.validation.${questionType}`));
    } else {
      setError('');
    }
  }, [questionType, t]);

  return (
    <div>
      <input
        type="text"
        inputMode={(INPUT_MODES[questionType] as any) ?? 'text'}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onBlur={() => validate(value)}
        className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${error ? 'border-red-500' : ''}`}
        placeholder={t('surveyGate.typeAnswer')}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
