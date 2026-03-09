import { useTranslation } from 'react-i18next';

interface Props {
  current: number;
  total: number;
}

export default function SurveyProgress({ current, total }: Props) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{t('surveyGate.progress', { current, total })}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={t('surveyGate.progress', { current, total })}
      >
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
