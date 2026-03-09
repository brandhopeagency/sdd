import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import { generateReport } from '@/services/reviewApi';
import type { DashboardPeriod } from '@mentalhelpglobal/chat-types';

const REPORT_TYPES = [
  'daily_summary',
  'weekly_performance',
  'monthly_quality',
  'escalation_report',
] as const;

const REPORT_FORMATS = ['json', 'csv', 'pdf'] as const;

const PERIODS: DashboardPeriod[] = ['today', 'week', 'month', 'all'];

const STATUS_COLORS: Record<string, string> = {
  pendingReview: 'bg-amber-400',
  inReview: 'bg-sky-500',
  disputed: 'bg-rose-500',
  complete: 'bg-emerald-500',
};

const STATUS_LABELS: Record<string, string> = {
  pendingReview: 'pending_review',
  inReview: 'in_review',
  disputed: 'disputed',
  complete: 'complete',
};

export default function TeamDashboard() {
  const { t } = useTranslation();
  const {
    teamDashboard,
    dashboardPeriod,
    fetchTeamDashboard,
    setDashboardPeriod,
    error,
  } = useReviewStore();

  const [loading, setLoading] = useState(false);

  // Reports state
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>('daily_summary');
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportFormat, setReportFormat] = useState<(typeof REPORT_FORMATS)[number]>('json');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleGenerateReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    setReportResult(null);
    try {
      const result = await generateReport(reportType, reportFrom, reportTo, reportFormat);
      if (result instanceof Blob) {
        // Download file
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_${reportFrom}_${reportTo}.${reportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setReportResult(result);
      }
    } catch (err: any) {
      setReportError(err.message || t('review.common.error'));
    } finally {
      setReportLoading(false);
    }
  }, [reportType, reportFrom, reportTo, reportFormat, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeamDashboard(dashboardPeriod).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dashboardPeriod, fetchTeamDashboard]);

  const handlePeriod = (p: DashboardPeriod) => {
    setDashboardPeriod(p);
  };

  // Queue depth total
  const queueTotal = teamDashboard
    ? teamDashboard.queueDepth.pendingReview +
      teamDashboard.queueDepth.inReview +
      teamDashboard.queueDepth.disputed +
      teamDashboard.queueDepth.complete
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">
          {t('review.dashboard.teamTitle')}
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
      {loading && !teamDashboard && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <span className="ml-3 text-neutral-500">{t('review.common.loading')}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && teamDashboard && teamDashboard.totalReviews === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center text-neutral-500">
          {t('review.dashboard.noData')}
        </div>
      )}

      {/* Dashboard content */}
      {teamDashboard && (
        <>
          {/* Stats cards row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total Reviews */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.totalReviews')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {teamDashboard.totalReviews}
              </p>
            </div>

            {/* Team Average */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.teamAverage')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {teamDashboard.averageTeamScore != null
                  ? teamDashboard.averageTeamScore.toFixed(1)
                  : '—'}
              </p>
            </div>

            {/* Inter-Rater Reliability */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.interRaterReliability')}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {teamDashboard.interRaterReliability}%
              </p>
            </div>

            {/* Pending Escalations */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.pendingEscalations')}
              </p>
              <p className={`mt-1 text-3xl font-bold ${
                teamDashboard.pendingEscalations > 0 ? 'text-rose-600' : 'text-neutral-900'
              }`}>
                {teamDashboard.pendingEscalations}
              </p>
            </div>

            {/* Pending Deanonymizations */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">
                {t('review.dashboard.stats.pendingDeanonymizations')}
              </p>
              <p className={`mt-1 text-3xl font-bold ${
                teamDashboard.pendingDeanonymizations > 0 ? 'text-amber-600' : 'text-neutral-900'
              }`}>
                {teamDashboard.pendingDeanonymizations}
              </p>
            </div>
          </div>

          {/* Reviewer Workload Table */}
          {teamDashboard.reviewerWorkload.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-neutral-800">
                  {t('review.dashboard.workload.title')}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {t('review.dashboard.workload.reviewer')}
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {t('review.dashboard.workload.completed')}
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {t('review.dashboard.workload.inProgress')}
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {t('review.dashboard.workload.average')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {teamDashboard.reviewerWorkload.map((entry) => (
                      <tr key={entry.reviewerId} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-neutral-800">
                          {entry.reviewerName}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-neutral-700">
                          {entry.reviewsCompleted}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-neutral-700">
                          {entry.reviewsInProgress > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                              {entry.reviewsInProgress}
                            </span>
                          )}
                          {entry.reviewsInProgress === 0 && '0'}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-neutral-800">
                          {entry.averageScore > 0 ? entry.averageScore.toFixed(1) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Queue Depth */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-800">
              {t('review.dashboard.queueDepth')}
            </h2>

            {queueTotal === 0 ? (
              <p className="text-sm text-neutral-400">{t('review.dashboard.noData')}</p>
            ) : (
              <div className="space-y-3">
                {/* Stacked bar */}
                <div className="flex h-6 w-full overflow-hidden rounded-full">
                  {(['pendingReview', 'inReview', 'disputed', 'complete'] as const).map((key) => {
                    const count = teamDashboard.queueDepth[key];
                    const pct = queueTotal > 0 ? (count / queueTotal) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={key}
                        className={`${STATUS_COLORS[key]} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                        title={`${t(`review.common.status.${STATUS_LABELS[key]}`)}: ${count}`}
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4">
                  {(['pendingReview', 'inReview', 'disputed', 'complete'] as const).map((key) => {
                    const count = teamDashboard.queueDepth[key];
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className={`inline-block h-3 w-3 rounded-sm ${STATUS_COLORS[key]}`} />
                        <span className="text-neutral-600">
                          {t(`review.common.status.${STATUS_LABELS[key]}`)}
                        </span>
                        <span className="font-semibold text-neutral-800">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reports */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-neutral-800">
                {t('review.reports.title')}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Report Type */}
                <div>
                  <label
                    htmlFor="report-type"
                    className="mb-1 block text-sm font-medium text-neutral-700"
                  >
                    {t('review.reports.type')}
                  </label>
                  <select
                    id="report-type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as typeof reportType)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {REPORT_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {t(`review.reports.types.${rt}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* From date */}
                <div>
                  <label
                    htmlFor="report-from"
                    className="mb-1 block text-sm font-medium text-neutral-700"
                  >
                    {t('review.reports.from')}
                  </label>
                  <input
                    id="report-from"
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* To date */}
                <div>
                  <label
                    htmlFor="report-to"
                    className="mb-1 block text-sm font-medium text-neutral-700"
                  >
                    {t('review.reports.to')}
                  </label>
                  <input
                    id="report-to"
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* Format */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    {t('review.reports.format')}
                  </label>
                  <div className="flex gap-3 pt-1.5">
                    {REPORT_FORMATS.map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-sm text-neutral-700 cursor-pointer">
                        <input
                          type="radio"
                          name="report-format"
                          value={f}
                          checked={reportFormat === f}
                          onChange={() => setReportFormat(f)}
                          className="h-4 w-4 border-neutral-300 text-sky-600 focus:ring-sky-500"
                        />
                        {f.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading || !reportFrom || !reportTo}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportLoading && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {reportLoading
                    ? t('review.reports.generating')
                    : t('review.reports.generate')}
                </button>
              </div>

              {/* Report error */}
              {reportError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {reportError}
                </div>
              )}

              {/* JSON report result preview */}
              {reportResult && reportFormat === 'json' && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <pre className="max-h-96 overflow-auto text-xs text-neutral-700 whitespace-pre-wrap">
                    {JSON.stringify(reportResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
