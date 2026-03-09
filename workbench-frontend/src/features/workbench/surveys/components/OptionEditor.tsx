import { useTranslation } from 'react-i18next';
import type { ChoiceOptionConfig } from '@mentalhelpglobal/chat-types';

interface OptionEditorProps {
  label: string;
  config: ChoiceOptionConfig | undefined;
  onChange: (config: ChoiceOptionConfig) => void;
  disabled?: boolean;
}

export default function OptionEditor({ label, config, onChange, disabled }: OptionEditorProps) {
  const { t } = useTranslation();

  const freetextEnabled = config?.freetextEnabled === true;
  const freetextType = (config?.freetextEnabled === true ? config.freetextType : 'string') as 'string' | 'number';
  const freetextRequired = config?.freetextEnabled === true ? (config.freetextRequired ?? false) : false;

  const handleFreetextEnabledChange = (enabled: boolean) => {
    if (enabled) {
      onChange({ label, freetextEnabled: true, freetextType: 'string', freetextRequired: false });
    } else {
      onChange({ label, freetextEnabled: false });
    }
  };

  const handleFreetextTypeChange = (type: 'string' | 'number') => {
    if (freetextEnabled) {
      onChange({ label, freetextEnabled: true, freetextType: type, freetextRequired });
    }
  };

  const handleFreetextRequiredChange = (required: boolean) => {
    if (freetextEnabled) {
      onChange({ label, freetextEnabled: true, freetextType, freetextRequired: required });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs">
      <span className="font-medium text-gray-700 min-w-[80px] truncate">{label}</span>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={freetextEnabled}
          onChange={(e) => handleFreetextEnabledChange(e.target.checked)}
          disabled={disabled}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
        />
        <span className="text-gray-600">{t('survey.option.freetextLabel')}</span>
      </label>

      {freetextEnabled && (
        <>
          <div className="flex items-center gap-1.5">
            <select
              value={freetextType}
              onChange={(e) => handleFreetextTypeChange(e.target.value as 'string' | 'number')}
              disabled={disabled}
              className="px-1.5 py-0.5 text-xs border border-gray-300 rounded-md bg-white disabled:bg-gray-100"
            >
              <option value="string">{t('survey.option.freetextType.string')}</option>
              <option value="number">{t('survey.option.freetextType.number')}</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={freetextRequired}
              onChange={(e) => handleFreetextRequiredChange(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span className="text-gray-600">{t('survey.option.freetextRequired')}</span>
          </label>
        </>
      )}
    </div>
  );
}
