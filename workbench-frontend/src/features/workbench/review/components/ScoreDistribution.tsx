import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScoreDistribution as ScoreDistributionType } from '@mentalhelpglobal/chat-types';

interface ScoreDistributionProps {
  distribution: ScoreDistributionType;
}

const RANGES = [
  { key: 'outstanding', label: '9-10', color: 'bg-emerald-600', textColor: 'text-emerald-700' },
  { key: 'good', label: '7-8', color: 'bg-emerald-400', textColor: 'text-emerald-600' },
  { key: 'adequate', label: '5-6', color: 'bg-amber-400', textColor: 'text-amber-600' },
  { key: 'poor', label: '3-4', color: 'bg-orange-400', textColor: 'text-orange-600' },
  { key: 'unsafe', label: '1-2', color: 'bg-red-500', textColor: 'text-red-600' },
] as const;

export default function ScoreDistribution({ distribution }: ScoreDistributionProps) {
  const { t } = useTranslation();

  const total = useMemo(
    () =>
      distribution.outstanding +
      distribution.good +
      distribution.adequate +
      distribution.poor +
      distribution.unsafe,
    [distribution],
  );

  return (
    <div
      className="space-y-3"
      role="img"
      aria-label={t('review.dashboard.scoreDistribution')}
    >
      {RANGES.map(({ key, label, color, textColor }) => {
        const count = distribution[key as keyof ScoreDistributionType];
        const pct = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={key} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-28 shrink-0 text-right">
              <span className={`text-sm font-medium ${textColor}`}>
                {t(`review.score.labels.${key === 'outstanding' ? '10' : key === 'good' ? '8' : key === 'adequate' ? '6' : key === 'poor' ? '4' : '1'}`)}
              </span>
              <span className="ml-1 text-xs text-neutral-400">({label})</span>
            </div>

            {/* Bar */}
            <div className="flex-1">
              <div
                className="h-5 overflow-hidden rounded bg-neutral-100"
                role="meter"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={`${key}: ${count}`}
              >
                <div
                  className={`h-full rounded transition-all duration-500 ease-out ${color}`}
                  style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>

            {/* Count */}
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-neutral-700">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
