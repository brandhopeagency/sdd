import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import type { RiskFlag } from '@mentalhelpglobal/chat-types';

const SEVERITY_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  low: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-red-50', text: 'text-red-700' },
  acknowledged: { bg: 'bg-amber-50', text: 'text-amber-700' },
  escalated: { bg: 'bg-purple-50', text: 'text-purple-700' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

function formatSlaCountdown(deadline: string | null): { text: string; overdue: boolean } {
  if (!deadline) return { text: '—', overdue: false };

  const now = new Date();
  const sla = new Date(deadline);
  const diffMs = sla.getTime() - now.getTime();

  if (diffMs <= 0) {
    const overdueMins = Math.abs(Math.floor(diffMs / 60000));
    if (overdueMins < 60) return { text: `${overdueMins}m overdue`, overdue: true };
    const overdueHours = Math.floor(overdueMins / 60);
    return { text: `${overdueHours}h overdue`, overdue: true };
  }

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return { text: `${mins}m remaining`, overdue: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `${hours}h ${mins % 60}m remaining`, overdue: false };
  const days = Math.floor(hours / 24);
  return { text: `${days}d ${hours % 24}h remaining`, overdue: false };
}

export default function EscalationQueue() {
  const { t } = useTranslation();
  const {
    escalations,
    escalationsTotal,
    error,
    fetchEscalations,
    resolveFlag,
    createDeanonymizationRequest,
  } = useReviewStore();

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [counts, setCounts] = useState({ highOpen: 0, mediumOpen: 0, overdueSla: 0 });

  // Resolution dialog state
  const [resolvingFlag, setResolvingFlag] = useState<RiskFlag | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<'acknowledged' | 'resolved' | 'escalated'>('resolved');
  const [resolving, setResolving] = useState(false);

  // Deanonymization request dialog state
  const [deanonFlag, setDeanonFlag] = useState<RiskFlag | null>(null);
  const [deanonJustification, setDeanonJustification] = useState('');
  const [deanonCategory, setDeanonCategory] = useState('welfare_check');
  const [requestingDeanon, setRequestingDeanon] = useState(false);

  const loadEscalations = useCallback(async () => {
    setLoading(true);
    try {
      await fetchEscalations({
        page,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchEscalations, page, severityFilter, statusFilter]);

  // Fetch escalations on mount and filter change
  useEffect(() => {
    loadEscalations();
  }, [loadEscalations]);

  // Extract counts from the store's escalations data
  // (The API returns counts alongside data; we compute from what we have)
  useEffect(() => {
    let highOpen = 0;
    let mediumOpen = 0;
    let overdueSla = 0;

    for (const flag of escalations) {
      const isActive = flag.status === 'open' || flag.status === 'acknowledged';
      if (isActive && flag.severity === 'high') highOpen++;
      if (isActive && flag.severity === 'medium') mediumOpen++;
      if (isActive && flag.slaDeadline && new Date(flag.slaDeadline) < new Date()) overdueSla++;
    }

    setCounts({ highOpen, mediumOpen, overdueSla });
  }, [escalations]);

  const handleQuickAction = useCallback(
    async (flag: RiskFlag, action: 'acknowledged' | 'resolved' | 'escalated') => {
      if (action === 'resolved') {
        setResolvingFlag(flag);
        setResolutionAction('resolved');
        setResolutionNotes('');
        return;
      }

      // Acknowledge or escalate without notes dialog
      try {
        await resolveFlag(flag.id, { resolution: action, notes: '' });
        await loadEscalations();
      } catch {
        // Error handled by store
      }
    },
    [resolveFlag, loadEscalations],
  );

  const handleResolveSubmit = useCallback(async () => {
    if (!resolvingFlag || resolving) return;

    setResolving(true);
    try {
      await resolveFlag(resolvingFlag.id, {
        resolution: resolutionAction,
        notes: resolutionNotes,
      });
      setResolvingFlag(null);
      setResolutionNotes('');
      await loadEscalations();
    } catch {
      // Error handled by store
    } finally {
      setResolving(false);
    }
  }, [resolvingFlag, resolutionAction, resolutionNotes, resolving, resolveFlag, loadEscalations]);

  const handleDeanonSubmit = useCallback(async () => {
    if (!deanonFlag || requestingDeanon || deanonJustification.length < 10) return;

    setRequestingDeanon(true);
    try {
      await createDeanonymizationRequest({
        sessionId: deanonFlag.sessionId,
        flagId: deanonFlag.id,
        justificationCategory: deanonCategory,
        justificationDetails: deanonJustification,
      });
      setDeanonFlag(null);
      setDeanonJustification('');
      setDeanonCategory('welfare_check');
    } catch {
      // Error handled by store
    } finally {
      setRequestingDeanon(false);
    }
  }, [deanonFlag, deanonCategory, deanonJustification, requestingDeanon, createDeanonymizationRequest]);

  const pageSize = 20;
  const totalPages = Math.ceil(escalationsTotal / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">{t('review.escalation.title')}</h1>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-2xl font-bold text-red-700">{counts.highOpen}</p>
          <p className="text-sm text-red-600">
            {t('review.flag.severityOptions.high')} — {t('review.escalation.title')}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-700">{counts.mediumOpen}</p>
          <p className="text-sm text-amber-600">
            {t('review.flag.severityOptions.medium')} — {t('review.escalation.title')}
          </p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <p className="text-2xl font-bold text-purple-700">{counts.overdueSla}</p>
          <p className="text-sm text-purple-600">
            {t('review.escalation.overdueSla', { count: counts.overdueSla })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">{t('review.flag.severity')}: All</option>
          <option value="high">{t('review.flag.severityOptions.high')}</option>
          <option value="medium">{t('review.flag.severityOptions.medium')}</option>
          <option value="low">{t('review.flag.severityOptions.low')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">Status: All</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-sky-600" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadEscalations}
            className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800"
          >
            {t('review.common.retry')}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && escalations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 py-16">
          <svg className="mb-4 h-12 w-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium text-neutral-500">{t('review.escalation.empty')}</p>
        </div>
      )}

      {/* Flag cards */}
      {!loading && escalations.length > 0 && (
        <div className="space-y-3">
          {escalations.map((flag) => {
            const sevColors = SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE.low;
            const statusColors = STATUS_BADGE[flag.status] ?? STATUS_BADGE.open;
            const sla = formatSlaCountdown(flag.slaDeadline as string | null);

            return (
              <div
                key={flag.id}
                className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: flag info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {/* Severity badge */}
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sevColors.bg} ${sevColors.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sevColors.dot}`} />
                        {t(`review.flag.severityOptions.${flag.severity}`)}
                      </span>

                      {/* Status badge */}
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                        {flag.status}
                      </span>

                      {/* Auto-detected badge */}
                      {flag.isAutoDetected && (
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                          {t('review.flag.autoDetected')}
                        </span>
                      )}

                      {/* SLA countdown */}
                      <span className={`ml-auto text-xs font-medium ${sla.overdue ? 'text-red-600' : 'text-neutral-500'}`}>
                        {sla.text}
                      </span>
                    </div>

                    {/* Session ID */}
                    <p className="mb-1 text-xs text-neutral-500">
                      Session: <span className="font-mono">{flag.sessionId?.slice(0, 8)}...</span>
                    </p>

                    {/* Reason category */}
                    <p className="mb-1 text-sm font-medium text-neutral-700">
                      {t(`review.flag.reasonOptions.${flag.reasonCategory}`, flag.reasonCategory)}
                    </p>

                    {/* Details preview */}
                    <p className="text-sm text-neutral-600 line-clamp-2">
                      {flag.details}
                    </p>

                    {/* Matched keywords */}
                    {flag.matchedKeywords && flag.matchedKeywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {flag.matchedKeywords.map((kw, i) => (
                          <span key={i} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  {(flag.status === 'open' || flag.status === 'acknowledged' || flag.status === 'escalated') && (
                    <div className="flex flex-shrink-0 flex-col gap-2">
                      {flag.status === 'open' && (
                        <button
                          onClick={() => handleQuickAction(flag, 'acknowledged')}
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          {t('review.escalation.acknowledge')}
                        </button>
                      )}
                      <button
                        onClick={() => handleQuickAction(flag, 'resolved')}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        {t('review.escalation.resolve')}
                      </button>
                      {flag.status !== 'escalated' && (
                        <button
                          onClick={() => handleQuickAction(flag, 'escalated')}
                          className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
                        >
                          {t('review.escalation.escalate')}
                        </button>
                      )}
                      {!flag.deanonymizationRequested && (
                        <button
                          onClick={() => { setDeanonFlag(flag); setDeanonJustification(''); setDeanonCategory('welfare_check'); }}
                          className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          {t('review.escalation.requestDeanonymization', 'Request Deanon')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Resolution Notes Dialog */}
      {resolvingFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !resolving && setResolvingFlag(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-neutral-800">
              {t('review.escalation.resolve')}
            </h3>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder={t('review.escalation.resolutionNotes')}
              className="mb-4 w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResolvingFlag(null)}
                disabled={resolving}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                {t('review.common.cancel')}
              </button>
              <button
                onClick={handleResolveSubmit}
                disabled={resolving || resolutionNotes.length < 5}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {resolving ? t('review.common.loading') : t('review.escalation.resolve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deanonymization Request Dialog */}
      {deanonFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !requestingDeanon && setDeanonFlag(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-neutral-800">
              {t('review.escalation.requestDeanonymization', 'Request Deanonymization')}
            </h3>
            <p className="mb-3 text-sm text-neutral-600">
              Session: <span className="font-mono">{deanonFlag.sessionId?.slice(0, 8)}...</span>
            </p>

            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.deanonymization.category', 'Justification Category')}
            </label>
            <select
              value={deanonCategory}
              onChange={(e) => setDeanonCategory(e.target.value)}
              className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="welfare_check">{t('review.deanonymization.welfareCheck', 'Welfare Check')}</option>
              <option value="legal_requirement">{t('review.deanonymization.legalRequirement', 'Legal Requirement')}</option>
              <option value="clinical_escalation">{t('review.deanonymization.clinicalEscalation', 'Clinical Escalation')}</option>
              <option value="investigation">{t('review.deanonymization.investigation', 'Investigation')}</option>
            </select>

            <label className="mb-1 block text-sm font-medium text-neutral-700">
              {t('review.deanonymization.justification', 'Justification Details')}
            </label>
            <textarea
              value={deanonJustification}
              onChange={(e) => setDeanonJustification(e.target.value)}
              rows={4}
              placeholder={t('review.deanonymization.justificationPlaceholder', 'Explain why deanonymization is needed (min 10 characters)...')}
              className="mb-4 w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeanonFlag(null)}
                disabled={requestingDeanon}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                {t('review.common.cancel')}
              </button>
              <button
                onClick={handleDeanonSubmit}
                disabled={requestingDeanon || deanonJustification.length < 10}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {requestingDeanon ? t('review.common.loading') : t('review.escalation.submitDeanonymization', 'Submit Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
