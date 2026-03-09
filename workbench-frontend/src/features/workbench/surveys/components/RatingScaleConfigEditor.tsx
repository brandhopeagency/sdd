import { useTranslation } from 'react-i18next';
import type { RatingScaleConfig } from '@mentalhelpglobal/chat-types';

interface Props {
  config: RatingScaleConfig | null | undefined;
  onChange: (config: RatingScaleConfig) => void;
  disabled?: boolean;
}

export default function RatingScaleConfigEditor({ config, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const current: RatingScaleConfig = config ?? { startValue: 0, endValue: 10, step: 1 };

  const segmentCount = current.step > 0
    ? Math.floor((current.endValue - current.startValue) / current.step) + 1
    : 0;
  const isValid = current.endValue > current.startValue
    && current.step > 0
    && Number.isInteger((current.endValue - current.startValue) / current.step);

  return (
    <div className="space-y-2 p-3 border rounded-md bg-gray-50">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('survey.ratingScale.startValue')}</label>
          <input
            type="number"
            value={current.startValue}
            onChange={(e) => onChange({ ...current, startValue: Number(e.target.value) })}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('survey.ratingScale.endValue')}</label>
          <input
            type="number"
            value={current.endValue}
            onChange={(e) => onChange({ ...current, endValue: Number(e.target.value) })}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('survey.ratingScale.step')}</label>
          <input
            type="number"
            value={current.step}
            min={0.01}
            step="any"
            onChange={(e) => onChange({ ...current, step: Number(e.target.value) })}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm border rounded-md disabled:bg-gray-50"
          />
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {isValid
          ? t('survey.ratingScale.segmentCount', { count: segmentCount })
          : <span className="text-red-500">{t('survey.ratingScale.invalidConfig')}</span>
        }
      </div>
    </div>
  );
}
