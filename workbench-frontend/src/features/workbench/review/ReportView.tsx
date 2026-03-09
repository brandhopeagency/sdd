import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateReport } from '@/services/reviewApi';
import type { ReportType, ReportFormat } from '@mentalhelpglobal/chat-types';

const REPORT_TYPES: ReportType[] = [
  'daily_summary',
  'weekly_performance',
  'monthly_quality',
  'escalation_report',
];

const REPORT_FORMATS: ReportFormat[] = ['json', 'csv', 'pdf'];

export default function ReportView() {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<ReportType>('daily_summary');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<ReportFormat>('json');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateReport(reportType, dateFrom, dateTo, format);
      if (data instanceof Blob) {
        const ext = format === 'pdf' ? 'pdf' : format;
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_${dateFrom}_${dateTo}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setResult({ downloaded: true, filename: `${reportType}_${dateFrom}_${dateTo}.${ext}` });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    } finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo, format, t]);

  const reportTypeLabel = (type: string) =>
    t(`review.reports.types.${type}`, type.replace(/_/g, ' '));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-800">
        {t('review.reports.title', 'Reports & Analytics')}
      </h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.reports.reportType', 'Report Type')}
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {reportTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.reports.dateFrom', 'From')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.reports.dateTo', 'To')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.reports.format', 'Format')}
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ReportFormat)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            >
              {REPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? t('review.reports.generating', 'Generating…') : t('review.reports.generate', 'Generate Report')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            {t('review.reports.preview', 'Result')}
          </h2>
          {result.downloaded ? (
            <p className="text-neutral-600">
              {t('review.reports.downloaded', 'Report downloaded:')} {result.filename}
            </p>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg bg-neutral-50 p-4 text-sm text-neutral-800">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
