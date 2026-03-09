import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import ScoreDistribution from './components/ScoreDistribution';
import type { DashboardPeriod, CriteriaFeedbackCounts } from '@mentalhelpglobal/chat-types';

const PERIODS: DashboardPeriod[] = ['today', 'week', 'month', 'all'];

const CRITERIA_KEYS: (keyof CriteriaFeedbackCounts)[] = [
  'relevance',
  'empathy',
  'safety',
  'ethics',
  'clarity',
];

const CRITERIA_COLORS: Record<string, string> = {
  relevance: 'bg-sky-500',
  empathy: 'bg-violet-500',
  safety: 'bg-rose-500',
  ethics: 'bg-amber-500',
  clarity: 'bg-emerald-500',
};

export default function ReviewDashboard() {
  const { t } = useTranslation();
  const {
    myDashboard,
    dashboardPeriod,
    fetchMyDashboard,
    setDashboardPeriod,
    error,
  } = useReviewStore();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyDashboard(dashboardPeriod).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dashboardPeriod, fetchMyDashboard]);

  // Weekly trend: last 8 weeks
  const trendData = useMemo(() => {
    if (!myDashboard?.weeklyTrend) return [];
    return myDashboard.weeklyTrend.slice(-8);
  }, [myDashboard?.weeklyTrend]);

  const trendMax = useMemo(() => {
    if (trendData.length === 0) return 1;
    return Math.max(1, ...trendData.map((p) => p.reviewsCompleted));
  }, [trendData]);

  // Criteria max for bar scaling
  const criteriaMax = useMemo(() => {
    if (!myDashboard) return 1;
    const counts = myDashboard.criteriaFeedbackCounts;
    return Math.max(1, ...CRITERIA_KEYS.map((k) => counts[k]));
  }, [myDashboard]);

  const handlePeriod = (p: DashboardPeriod) => {
    setDashboardPeriod(p);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">
          {t('review.dashboard.title')}
        </h1>

        {/* Period tabs */}
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={dashboardPeriod === p}
              onClick={() => handlePeriod(p)}
              className={`
                rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${dashboardPeriod === p
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'}
              `}
            >
              {t(`review.dashboard.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !myDashboard && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <span className="ml-3 text-neutral-500">{t('review.common.loading')}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && myDashboard && myDashboard.reviewsCompleted === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center text-neutral-500">
          {t('review.dashboard.noData')}
        </div>
      )}

      {/* Dashboard content */}
      {myDashboard && (
        <>
          {/* Stats cards row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Reviews Completed */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.reviewsCompleted')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {myDashboard.reviewsCompleted}
              </p>
            </div>

            {/* Average Score */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.averageScore')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {myDashboard.averageScoreGiven != null
                  ? myDashboard.averageScoreGiven.toFixed(1)
                  : '—'}
              </p>
            </div>

            {/* Agreement Rate */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.agreementRate')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {myDashboard.agreementRate}%
              </p>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-800">
              {t('review.dashboard.scoreDistribution')}
            </h2>
            <ScoreDistribution distribution={myDashboard.scoreDistribution} />
          </div>

          {/* Criteria feedback breakdown */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-800">
              {t('review.dashboard.criteriaBreakdown')}
            </h2>
            <div className="space-y-3">
              {CRITERIA_KEYS.map((key) => {
                const count = myDashboard.criteriaFeedbackCounts[key];
                const pct = criteriaMax > 0 ? (count / criteriaMax) * 100 : 0;

                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-right text-sm font-medium text-neutral-600">
                      {t(`review.criteria.${key}.name`)}
                    </span>
                    <div className="flex-1">
                      <div className="h-5 overflow-hidden rounded bg-neutral-100">
                        <div
                          className={`h-full rounded transition-all duration-500 ease-out ${CRITERIA_COLORS[key]}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold text-neutral-700">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly trend */}
          {trendData.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-800">
                {t('review.dashboard.weeklyTrend')}
              </h2>
              <div className="flex items-end gap-2" style={{ height: 120 }}>
                {trendData.map((point, i) => {
                  const barHeight = Math.max(4, (point.reviewsCompleted / trendMax) * 100);
                  const weekLabel = new Date(point.week).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={point.week || i}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      {/* Count label */}
                      <span className="text-xs font-medium text-neutral-500">
                        {point.reviewsCompleted}
                      </span>
                      {/* Bar */}
                      <div
                        className="w-full max-w-[32px] rounded-t bg-sky-500 transition-all duration-500"
                        style={{ height: `${barHeight}%` }}
                        title={`${weekLabel}: ${point.reviewsCompleted} reviews, avg ${point.averageScore}`}
                      />
                      {/* Week label */}
                      <span className="text-[10px] text-neutral-400">{weekLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
