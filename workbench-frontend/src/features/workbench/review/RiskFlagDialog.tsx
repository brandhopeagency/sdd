import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import type { RiskFlagFormState } from '@/types/reviewForms';

interface RiskFlagDialogProps {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

const SEVERITY_OPTIONS = ['high', 'medium', 'low'] as const;

const REASON_CATEGORIES = [
  'crisis_indicators',
  'self_harm_language',
  'inappropriate_ai_response',
  'ethical_concern',
  'other_safety_concern',
] as const;

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  high: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', ring: 'ring-red-500' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', ring: 'ring-amber-500' },
  low: { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', ring: 'ring-sky-500' },
};

export default function RiskFlagDialog({ sessionId, open, onClose }: RiskFlagDialogProps) {
  const { t } = useTranslation();
  const { createFlag } = useReviewStore();

  const [form, setForm] = useState<RiskFlagFormState>({
    severity: '',
    reasonCategory: '',
    details: '',
    requestDeanonymization: false,
    deanonymizationJustification: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deliveryStatus, setDeliveryStatus] = useState<'delivered' | 'pending' | 'failed' | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.severity) {
      newErrors.severity = t('review.flag.severityRequired');
    }
    if (!form.reasonCategory) {
      newErrors.reasonCategory = t('review.flag.reasonRequired');
    }
    if (!form.details || form.details.length < 10) {
      newErrors.details = t('review.flag.detailsMin');
    }
    if (form.requestDeanonymization && form.deanonymizationJustification.length < 10) {
      newErrors.deanonymizationJustification = t('review.flag.detailsMin');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const result = await createFlag(sessionId, {
        severity: form.severity,
        reasonCategory: form.reasonCategory,
        details: form.details,
        requestDeanonymization: form.requestDeanonymization || undefined,
        deanonymizationJustification: form.requestDeanonymization
          ? form.deanonymizationJustification
          : undefined,
      });

      // Show notification delivery status briefly before closing
      const status = result?.notificationDeliveryStatus ?? 'delivered';
      setDeliveryStatus(status);

      // Auto-close after brief delay so user sees the status
      setTimeout(() => {
        setForm({
          severity: '',
          reasonCategory: '',
          details: '',
          requestDeanonymization: false,
          deanonymizationJustification: '',
        });
        setErrors({});
        setDeliveryStatus(null);
        onClose();
      }, status === 'delivered' ? 1200 : 2500);
    } catch {
      // Error is handled by the store
    } finally {
      setSubmitting(false);
    }
  }, [form, sessionId, submitting, validate, createFlag, onClose]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setForm({
      severity: '',
      reasonCategory: '',
      details: '',
      requestDeanonymization: false,
      deanonymizationJustification: '',
    });
    setErrors({});
    setDeliveryStatus(null);
    onClose();
  }, [submitting, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key handler
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus the dialog on open
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-flag-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 id="risk-flag-dialog-title" className="text-lg font-bold text-neutral-800">
            {t('review.flag.title')}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label={t('review.common.close')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Severity */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              {t('review.flag.severity')} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {SEVERITY_OPTIONS.map((sev) => {
                const colors = SEVERITY_COLORS[sev];
                const isSelected = form.severity === sev;
                return (
                  <label
                    key={sev}
                    className={`
                      flex flex-1 cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2.5
                      text-sm font-medium transition-all
                      ${isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text} ring-2 ${colors.ring}`
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={sev}
                      checked={isSelected}
                      onChange={() => setForm((f) => ({ ...f, severity: sev }))}
                      className="sr-only"
                    />
                    {t(`review.flag.severityOptions.${sev}`)}
                  </label>
                );
              })}
            </div>
            {errors.severity && (
              <p className="mt-1 text-xs text-red-600">{errors.severity}</p>
            )}
          </div>

          {/* Reason Category */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              {t('review.flag.reason')} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.reasonCategory}
              onChange={(e) => setForm((f) => ({ ...f, reasonCategory: e.target.value as RiskFlagFormState['reasonCategory'] }))}
              className={`
                w-full rounded-lg border px-3 py-2.5 text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-sky-500
                ${errors.reasonCategory ? 'border-red-300 bg-red-50' : 'border-neutral-300 bg-white'}
              `}
            >
              <option value="">{t('review.flag.reason')}...</option>
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`review.flag.reasonOptions.${cat}`)}
                </option>
              ))}
            </select>
            {errors.reasonCategory && (
              <p className="mt-1 text-xs text-red-600">{errors.reasonCategory}</p>
            )}
          </div>

          {/* Details */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              {t('review.flag.details')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.details}
              onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              rows={3}
              placeholder={t('review.flag.detailsMin')}
              className={`
                w-full resize-none rounded-lg border px-3 py-2.5 text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-sky-500
                ${errors.details ? 'border-red-300 bg-red-50' : 'border-neutral-300 bg-white'}
              `}
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.details ? (
                <p className="text-xs text-red-600">{errors.details}</p>
              ) : (
                <p className="text-xs text-neutral-400">{t('review.flag.detailsMin')}</p>
              )}
              <span className={`text-xs ${form.details.length < 10 ? 'text-neutral-400' : 'text-emerald-600'}`}>
                {form.details.length}/10
              </span>
            </div>
          </div>

          {/* Deanonymization request */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.requestDeanonymization}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requestDeanonymization: e.target.checked }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-neutral-700">
                {t('review.flag.requestDeanonymization')}
              </span>
            </label>

            {form.requestDeanonymization && (
              <div className="mt-3">
                <textarea
                  value={form.deanonymizationJustification}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deanonymizationJustification: e.target.value }))
                  }
                  rows={2}
                  placeholder={t('review.flag.deanonymizationJustification')}
                  className={`
                    w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors
                    focus:outline-none focus:ring-2 focus:ring-sky-500
                    ${errors.deanonymizationJustification ? 'border-red-300 bg-red-50' : 'border-neutral-300 bg-white'}
                  `}
                />
                {errors.deanonymizationJustification && (
                  <p className="mt-1 text-xs text-red-600">{errors.deanonymizationJustification}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notification delivery status indicator */}
        {deliveryStatus && (
          <div className={`mx-6 mb-2 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            deliveryStatus === 'delivered'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : deliveryStatus === 'pending'
                ? 'border border-amber-200 bg-amber-50 text-amber-700'
                : 'border border-red-200 bg-red-50 text-red-700'
          }`}>
            <span className={`inline-block h-2 w-2 rounded-full ${
              deliveryStatus === 'delivered'
                ? 'bg-emerald-500'
                : deliveryStatus === 'pending'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
            }`} />
            {deliveryStatus === 'delivered' && t('review.flag.notificationDelivered', 'Flag created — notifications delivered')}
            {deliveryStatus === 'pending' && t('review.flag.notificationPending', 'Flag created — notification delivery pending')}
            {deliveryStatus === 'failed' && t('review.flag.notificationFailed', 'Flag created — notification delivery failed')}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {t('review.common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {submitting ? t('review.common.loading') : t('review.flag.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
