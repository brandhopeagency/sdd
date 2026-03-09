import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import * as reviewApi from '@/services/reviewApi';
import type { DeanonymizationRequest, RevealedIdentity, JustificationCategory } from '@mentalhelpglobal/chat-types';

// ── Constants ──

const JUSTIFICATION_CATEGORIES: JustificationCategory[] = [
  'welfare_check',
  'legal_requirement',
  'clinical_escalation',
  'investigation',
];

const MIN_DETAILS_LENGTH = 20;

// ── Status badge helper ──

function statusBadge(status: string, t: (key: string) => string): { bg: string; text: string } {
  switch (status) {
    case 'pending':
      return { bg: 'bg-amber-100 text-amber-800', text: t('review.deanonymization.pending') };
    case 'approved':
      return { bg: 'bg-emerald-100 text-emerald-800', text: t('review.deanonymization.approved') };
    case 'denied':
      return { bg: 'bg-red-100 text-red-800', text: t('review.deanonymization.denied') };
    case 'expired':
      return { bg: 'bg-neutral-100 text-neutral-500', text: t('review.deanonymization.accessExpired') };
    default:
      return { bg: 'bg-neutral-100 text-neutral-600', text: status };
  }
}

// ── Countdown hook ──

function useCountdown(expiresAt: Date | string | null) {
  const [remaining, setRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isWarn, setIsWarn] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining('');
      return;
    }

    const targetMs = new Date(expiresAt).getTime();

    function tick() {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        setIsExpired(true);
        setIsWarn(false);
        return;
      }

      setIsExpired(false);
      setIsWarn(diff < 15 * 60 * 1000); // warn when < 15 min

      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      setRemaining(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      );
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return { remaining, isExpired, isWarn };
}

// ── Props ──

interface DeanonymizationPanelProps {
  sessionId?: string;
}

// ── Component ──

export default function DeanonymizationPanel({ sessionId }: DeanonymizationPanelProps) {
  const { t } = useTranslation();

  const {
    deanonymizationRequests,
    createDeanonymizationRequest,
    fetchDeanonymizationRequests,
    approveDeanonymization,
    denyDeanonymization,
    error,
    clearError,
  } = useReviewStore();

  // ── Local state ──
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<JustificationCategory | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Approve confirmation dialog
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Deny dialog
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNotes, setDenyNotes] = useState('');

  // Revealed identity
  const [revealedIdentity, setRevealedIdentity] = useState<RevealedIdentity | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  // ── Fetch on mount ──
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    fetchDeanonymizationRequests().finally(() => setLoading(false));
  }, [fetchDeanonymizationRequests]);

  // ── Submit request ──
  const handleSubmit = useCallback(async () => {
    if (!category || details.length < MIN_DETAILS_LENGTH) return;

    setSubmitting(true);
    clearError();

    await createDeanonymizationRequest({
      sessionId: sessionId ?? '',
      justificationCategory: category,
      justificationDetails: details,
    });

    setSubmitting(false);
    setSubmitSuccess(true);
    setShowForm(false);
    setCategory('');
    setDetails('');

    setTimeout(() => setSubmitSuccess(false), 3000);
  }, [category, details, sessionId, createDeanonymizationRequest, clearError]);

  // ── Approve (with confirmation) ──
  const handleApproveClick = useCallback(
    (requestId: string) => {
      setApprovingId(requestId);
    },
    [],
  );

  const handleApproveConfirm = useCallback(async () => {
    if (!approvingId) return;
    clearError();
    await approveDeanonymization(approvingId);
    setApprovingId(null);
  }, [approvingId, approveDeanonymization, clearError]);

  const handleApproveCancel = useCallback(() => {
    setApprovingId(null);
  }, []);

  // ── Deny ──
  const handleDeny = useCallback(async () => {
    if (!denyingId || !denyNotes.trim()) return;
    clearError();
    await denyDeanonymization(denyingId, { denialNotes: denyNotes.trim() });
    setDenyingId(null);
    setDenyNotes('');
  }, [denyingId, denyNotes, denyDeanonymization, clearError]);

  // ── Reveal identity ──
  const handleReveal = useCallback(
    async (requestId: string) => {
      setRevealingId(requestId);
      setRevealError(null);
      try {
        const identity = await reviewApi.getRevealedIdentity(requestId);
        setRevealedIdentity(identity);
      } catch (err) {
        setRevealError(err instanceof Error ? err.message : t('review.deanonymization.revealError'));
      } finally {
        setRevealingId(null);
      }
    },
    [t],
  );

  // ── Filter requests for this session ──
  const sessionRequests = deanonymizationRequests.filter(
    (r) => r.sessionId === sessionId,
  );

  // ── Pending requests (for commander view) ──
  const pendingRequests = deanonymizationRequests.filter(
    (r) => r.status === 'pending',
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          {t('review.deanonymization.title')}
        </h3>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              clearError();
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white
                       transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2
                       focus:ring-sky-300"
          >
            {t('review.deanonymization.request')}
          </button>
        )}
      </div>

      {/* ── Success message ── */}
      {submitSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('review.deanonymization.submitted')}
        </div>
      )}

      {/* ── Error message ── */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Request form ── */}
      {showForm && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          {/* Category dropdown */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-700">
              {t('review.deanonymization.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as JustificationCategory | '')}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm
                         focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="">{t('review.common.noData')}</option>
              {JUSTIFICATION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`review.deanonymization.categoryOptions.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Details textarea */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-700">
              {t('review.deanonymization.details')}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={t('review.deanonymization.detailsMin')}
              className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm
                         placeholder:text-neutral-400
                         focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
            {details.length > 0 && details.length < MIN_DETAILS_LENGTH && (
              <p className="text-xs text-red-500">
                {t('review.deanonymization.detailsMin')}
              </p>
            )}
          </div>

          {/* Form actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!category || details.length < MIN_DETAILS_LENGTH || submitting}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-sky-700 disabled:cursor-not-allowed
                         disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {submitting ? t('review.common.loading') : t('review.deanonymization.submit')}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setCategory('');
                setDetails('');
              }}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium
                         text-neutral-600 transition-colors hover:bg-neutral-50
                         focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              {t('review.common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="py-4 text-center text-sm text-neutral-400">
          {t('review.common.loading')}
        </div>
      )}

      {/* ── Commander view: Pending requests ── */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {t('review.deanonymization.pending')}
          </h4>
          {pendingRequests.map((req) => (
            <PendingRequestCard
              key={req.id}
              request={req}
              onApprove={handleApproveClick}
              onDeny={(id) => {
                setDenyingId(id);
                setDenyNotes('');
              }}
            />
          ))}
        </div>
      )}

      {/* ── Approve confirmation dialog ── */}
      {approvingId && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            {t('review.deanonymization.approveConfirm')}
          </p>
          <p className="text-xs text-emerald-600">
            {t('review.deanonymization.approveConfirmDetail')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleApproveConfirm}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white
                         hover:bg-emerald-700 focus:outline-none focus:ring-2
                         focus:ring-emerald-300"
            >
              {t('review.deanonymization.approve')}
            </button>
            <button
              onClick={handleApproveCancel}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium
                         text-neutral-600 hover:bg-neutral-50 focus:outline-none
                         focus:ring-2 focus:ring-neutral-200"
            >
              {t('review.common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Deny dialog ── */}
      {denyingId && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="block text-sm font-medium text-red-700">
            {t('review.deanonymization.denialNotes')}
          </label>
          <textarea
            value={denyNotes}
            onChange={(e) => setDenyNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-red-300 px-3 py-2 text-sm
                       focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeny}
              disabled={!denyNotes.trim()}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                         hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2
                         focus:ring-red-300"
            >
              {t('review.deanonymization.deny')}
            </button>
            <button
              onClick={() => {
                setDenyingId(null);
                setDenyNotes('');
              }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium
                         text-neutral-600 hover:bg-neutral-50 focus:outline-none
                         focus:ring-2 focus:ring-neutral-200"
            >
              {t('review.common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── My requests list (requester view) ── */}
      {sessionRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {t('review.deanonymization.title')}
          </h4>
          {sessionRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onReveal={handleReveal}
              revealingId={revealingId}
            />
          ))}
        </div>
      )}

      {/* ── Revealed identity display ── */}
      {revealedIdentity && (
        <RevealedIdentityDisplay
          identity={revealedIdentity}
          onClose={() => setRevealedIdentity(null)}
        />
      )}

      {/* ── Reveal error ── */}
      {revealError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {revealError}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && sessionRequests.length === 0 && pendingRequests.length === 0 && !showForm && (
        <p className="py-3 text-center text-sm text-neutral-400">
          {t('review.common.noData')}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ──

function PendingRequestCard({
  request,
  onApprove,
  onDeny,
}: {
  request: DeanonymizationRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const { t } = useTranslation();
  const badge = statusBadge(request.status, t);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg}`}>
              {badge.text}
            </span>
            <span className="text-xs text-neutral-400">
              {t(`review.deanonymization.categoryOptions.${request.justificationCategory}`)}
            </span>
          </div>
          <p className="truncate text-sm text-neutral-600">
            {request.justificationDetails}
          </p>
          <p className="text-xs text-neutral-400">
            {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => onApprove(request.id)}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white
                       transition-colors hover:bg-emerald-700 focus:outline-none
                       focus:ring-2 focus:ring-emerald-300"
          >
            {t('review.deanonymization.approve')}
          </button>
          <button
            onClick={() => onDeny(request.id)}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium
                       text-red-600 transition-colors hover:bg-red-50 focus:outline-none
                       focus:ring-2 focus:ring-red-200"
          >
            {t('review.deanonymization.deny')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  request,
  onReveal,
  revealingId,
}: {
  request: DeanonymizationRequest;
  onReveal: (id: string) => void;
  revealingId: string | null;
}) {
  const { t } = useTranslation();
  const badge = statusBadge(request.status, t);
  const { remaining, isExpired, isWarn } = useCountdown(request.accessExpiresAt);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg}`}>
              {badge.text}
            </span>
            <span className="text-xs text-neutral-400">
              {t(`review.deanonymization.categoryOptions.${request.justificationCategory}`)}
            </span>
          </div>
          <p className="truncate text-sm text-neutral-600">
            {request.justificationDetails}
          </p>
          {request.denialNotes && (
            <p className="text-xs text-red-500">
              {request.denialNotes}
            </p>
          )}
          {request.status === 'approved' && request.accessExpiresAt && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`font-mono font-medium ${
                  isExpired ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-neutral-500'
                }`}
              >
                {isExpired
                  ? t('review.deanonymization.accessExpired')
                  : t('review.deanonymization.accessExpires', { time: remaining })}
              </span>
            </div>
          )}
          <p className="text-xs text-neutral-400">
            {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        {request.status === 'approved' && !isExpired && (
          <button
            onClick={() => onReveal(request.id)}
            disabled={revealingId === request.id}
            className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white
                       transition-colors hover:bg-sky-700 disabled:opacity-50
                       focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            {revealingId === request.id
              ? t('review.common.loading')
              : t('review.deanonymization.revealedIdentity')}
          </button>
        )}
      </div>
    </div>
  );
}

function RevealedIdentityDisplay({
  identity,
  onClose,
}: {
  identity: RevealedIdentity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { remaining, isExpired, isWarn } = useCountdown(identity.accessExpiresAt);

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        isExpired
          ? 'border-red-300 bg-red-50'
          : isWarn
            ? 'border-amber-300 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-neutral-700">
          {t('review.deanonymization.revealedIdentity')}
        </h4>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
          aria-label={t('review.common.close')}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isExpired ? (
        <p className="mt-2 text-sm font-medium text-red-600">
          {t('review.deanonymization.accessExpired')}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {/* Display name */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium uppercase text-neutral-500">{t('review.deanonymization.fieldName')}</span>
            <span className="text-sm font-semibold text-neutral-800">
              {identity.displayName}
            </span>
          </div>

          {/* Email */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium uppercase text-neutral-500">{t('review.deanonymization.fieldEmail')}</span>
            <span className="text-sm text-neutral-800">{identity.email}</span>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-2 pt-1">
            <svg
              className={`h-4 w-4 ${isWarn ? 'text-amber-500' : 'text-neutral-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              className={`text-xs font-mono font-medium ${
                isWarn ? 'text-amber-600' : 'text-neutral-500'
              }`}
            >
              {remaining}
            </span>
            {isWarn && (
              <span className="text-xs font-medium text-amber-600">
                {t('review.deanonymization.accessExpires', { time: remaining })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
