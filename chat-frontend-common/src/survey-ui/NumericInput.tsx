import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';

interface Props {
  questionType: SurveyQuestionType;
  value: string;
  onChange: (value: string) => void;
}

export default function NumericInput({ questionType, value, onChange }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  const validate = useCallback((val: string) => {
    if (!val) { setError(''); return; }
    switch (questionType) {
      case SurveyQuestionType.INTEGER_SIGNED:
        if (!/^-?\d+$/.test(val)) { setError(t('surveyGate.validation.integerSigned')); return; }
        break;
      case SurveyQuestionType.INTEGER_UNSIGNED:
        if (!/^\d+$/.test(val)) { setError(t('surveyGate.validation.integerUnsigned')); return; }
        break;
      case SurveyQuestionType.DECIMAL: {
        const normalized = val.replace(',', '.');
        if (isNaN(Number(normalized))) { setError(t('surveyGate.validation.decimal')); return; }
        break;
      }
    }
    setError('');
  }, [questionType, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw);
    validate(raw);
  };

  const handleBlur = () => {
    let normalized = value;
    if (questionType === SurveyQuestionType.DECIMAL && value.includes(',')) {
      normalized = value.replace(',', '.');
      onChange(normalized);
    }
    validate(normalized);
  };

  return (
    <div>
      <input
        type="text"
        inputMode={questionType === SurveyQuestionType.DECIMAL ? 'decimal' : 'numeric'}
        pattern={questionType === SurveyQuestionType.INTEGER_UNSIGNED ? '[0-9]*' : '[0-9-]*'}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${error ? 'border-red-500' : ''}`}
        placeholder={t('surveyGate.typeAnswer')}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
