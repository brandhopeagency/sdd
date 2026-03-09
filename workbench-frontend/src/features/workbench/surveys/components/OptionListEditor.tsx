import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

interface Props {
  options: string[];
  onChange: (options: string[]) => void;
  disabled?: boolean;
}

export default function OptionListEditor({ options, onChange, disabled }: Props) {
  const { t } = useTranslation();

  const addOption = () => onChange([...options, '']);
  const removeOption = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const updateOption = (idx: number, value: string) => {
    const updated = [...options];
    updated[idx] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-500">{t('survey.question.options')}</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
            placeholder={`${t('survey.question.option')} ${i + 1}`}
          />
          {!disabled && (
            <button onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={addOption}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <Plus className="w-4 h-4" /> {t('survey.question.addOption')}
        </button>
      )}
    </div>
  );
}
