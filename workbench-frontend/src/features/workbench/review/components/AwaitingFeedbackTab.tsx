import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSupervisionStore } from '@/stores/supervisionStore';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';

export default function AwaitingFeedbackTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { awaitingFeedback, awaitingLoading, fetchAwaitingFeedback } = useSupervisionStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      fetchAwaitingFeedback(user.id);
    }
  }, [user?.id, fetchAwaitingFeedback]);

  if (awaitingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (awaitingFeedback.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Clock className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm">{t('supervision.awaitingEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {awaitingFeedback.map((item) => (
        <div
          key={`${item.sessionReviewId}-${item.revisionIteration}`}
          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.supervisorDecision === 'approved' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium capitalize">
                {t('supervision.supervisorDecision')}: {item.supervisorDecision}
              </span>
              <span className="text-xs text-gray-400">
                {t('supervision.iteration')} {item.revisionIteration}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(item.decidedAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {item.supervisorComments}
          </p>
          {item.returnToReviewer && (
            <button
              onClick={() => navigate(`/workbench/review/session/${item.sessionId}`)}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              {t('supervision.viewDetails')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
