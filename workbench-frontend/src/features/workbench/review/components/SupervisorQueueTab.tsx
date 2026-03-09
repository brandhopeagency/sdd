import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Loader2 } from 'lucide-react';
import { useSupervisionStore } from '@/stores/supervisionStore';

export default function SupervisorQueueTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { queue, queueLoading, fetchQueue } = useSupervisionStore();

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  if (queueLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <ClipboardList className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm">{t('supervision.queueEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {queue.map((item) => (
        <div
          key={item.sessionReviewId}
          className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium truncate">{t('supervision.reviewer')}: {item.reviewerName}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{item.groupName}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>{t('supervision.messages')}: {item.sessionMessageCount}</span>
              <span>{t('supervision.iteration')} {item.revisionIteration}</span>
              <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/workbench/review/supervision/${item.sessionReviewId}`)}
            className="ml-4 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            {t('supervision.viewDetails')}
          </button>
        </div>
      ))}
    </div>
  );
}
