import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface ReviewProgressProps {
  rated: number;
  total: number;
  canSubmit: boolean;
}

export default function ReviewProgress({ rated, total, canSubmit }: ReviewProgressProps) {
  const { t } = useTranslation();

  const percent = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(100, Math.round((rated / total) * 100));
  }, [rated, total]);

  const isComplete = rated >= total && total > 0;

  return (
    <div className="space-y-2">
      {/* Text row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-600">
          {t('review.progress.rated', { rated, total })}
        </span>

        {/* Submit readiness */}
        <span
          className={`
            inline-flex items-center gap-1 text-xs font-medium transition-colors duration-200
            ${canSubmit ? 'text-emerald-600' : 'text-neutral-400'}
          `}
          aria-live="polite"
        >
          {canSubmit ? (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('review.progress.readyToSubmit')}
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="8" />
              </svg>
              {t('review.progress.notReady')}
            </>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuenow={rated}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('review.progress.ariaLabel', { rated, total })}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-500 ease-out
            ${isComplete ? 'bg-emerald-500' : 'bg-sky-500'}
          `}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Percentage */}
      <div className="text-right">
        <span
          className={`text-xs font-medium ${
            isComplete ? 'text-emerald-600' : 'text-neutral-500'
          }`}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}
