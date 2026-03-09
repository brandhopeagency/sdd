import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, Shield, X } from 'lucide-react';
import { useReviewStore } from '@/stores/reviewStore';

const BANNER_POLL_INTERVAL_MS = 60_000;

export default function BannerAlerts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { bannerAlerts, fetchBannerAlerts } = useReviewStore();

  const [dismissedEscalations, setDismissedEscalations] = useState(false);
  const [dismissedDeanon, setDismissedDeanon] = useState(false);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);

  // Fetch on mount and poll
  useEffect(() => {
    fetchBannerAlerts();
    const timer = setInterval(() => {
      fetchBannerAlerts();
      // Reset dismissals on refresh so new alerts show
      setDismissedEscalations(false);
      setDismissedDeanon(false);
      setDismissedOverdue(false);
    }, BANNER_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchBannerAlerts]);

  const handleDismiss = useCallback(
    (setter: React.Dispatch<React.SetStateAction<boolean>>) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setter(true);
    },
    [],
  );

  const showEscalations =
    !dismissedEscalations && bannerAlerts.highRiskEscalations > 0;
  const showDeanon =
    !dismissedDeanon && bannerAlerts.pendingDeanonymizations > 0;
  const showOverdue =
    !dismissedOverdue && bannerAlerts.overdueSlaCounts > 0;

  if (!showEscalations && !showDeanon && !showOverdue) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* High-risk escalations banner (moderators) */}
      {showEscalations && (
        <button
          onClick={() => navigate('/workbench/review/escalations')}
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span className="text-sm font-medium">
              {t('review.notifications.banners.escalations', {
                count: bannerAlerts.highRiskEscalations,
              })}
            </span>
          </div>
          <button
            onClick={handleDismiss(setDismissedEscalations)}
            className="p-0.5 rounded hover:bg-amber-200/60 transition-colors"
            aria-label={t('review.common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </button>
      )}

      {/* Pending deanonymizations banner (commanders) */}
      {showDeanon && (
        <button
          onClick={() => navigate('/workbench/review/deanonymization')}
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span className="text-sm font-medium">
              {t('review.notifications.banners.deanonymizations', {
                count: bannerAlerts.pendingDeanonymizations,
              })}
            </span>
          </div>
          <button
            onClick={handleDismiss(setDismissedDeanon)}
            className="p-0.5 rounded hover:bg-blue-200/60 transition-colors"
            aria-label={t('review.common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </button>
      )}

      {/* Overdue SLA banner */}
      {showOverdue && (
        <button
          onClick={() => navigate('/workbench/review/escalations')}
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 hover:bg-red-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span className="text-sm font-medium">
              {t('review.notifications.banners.overdue', {
                count: bannerAlerts.overdueSlaCounts,
              })}
            </span>
          </div>
          <button
            onClick={handleDismiss(setDismissedOverdue)}
            className="p-0.5 rounded hover:bg-red-200/60 transition-colors"
            aria-label={t('review.common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </button>
      )}
    </div>
  );
}
