import { useTranslation } from 'react-i18next';
import type { ChoiceOptionConfig, SurveyQuestion } from '@mentalhelpglobal/chat-types';

interface Props {
  question: SurveyQuestion;
  value: string | null;
  onChange: (value: string) => void;
  optionConfigs?: ChoiceOptionConfig[];
  onFreetext?: (optionLabel: string, value: string) => void;
  freetextValues?: Record<string, string>;
}

export default function SingleChoiceInput({
  question,
  value,
  onChange,
  optionConfigs,
  onFreetext,
  freetextValues,
}: Props) {
  const { t } = useTranslation();
  const options = question.options ?? [];

  const getConfig = (opt: string): ChoiceOptionConfig | undefined =>
    optionConfigs?.find((c) => c.label === opt);

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const config = getConfig(opt);
        const isSelected = value === opt;
        const hasFreetext = config?.freetextEnabled === true;
        const freetextType = hasFreetext ? (config as Extract<ChoiceOptionConfig, { freetextEnabled: true }>).freetextType : undefined;
        const freetextRequired = hasFreetext ? (config as Extract<ChoiceOptionConfig, { freetextEnabled: true }>).freetextRequired : undefined;
        const currentFreetext = freetextValues?.[opt] ?? '';

        return (
          <div key={opt}>
            <label
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={isSelected}
                onChange={() => onChange(opt)}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
            {isSelected && hasFreetext && (
              <div className="mt-1 ml-10">
                <input
                  type={freetextType === 'number' ? 'number' : 'text'}
                  inputMode={freetextType === 'number' ? 'decimal' : undefined}
                  value={currentFreetext}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (freetextType === 'number' && raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return;
                    onFreetext?.(opt, raw);
                  }}
                  required={freetextRequired === true}
                  placeholder={
                    freetextType === 'number'
                      ? t('survey.freetext.placeholderNumber')
                      : t('survey.freetext.placeholder')
                  }
                  aria-label={
                    freetextType === 'number'
                      ? t('survey.freetext.placeholderNumber')
                      : t('survey.freetext.placeholder')
                  }
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
