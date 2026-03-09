import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import type { SupervisorDecisionInput, SupervisorReview } from '@mentalhelpglobal/chat-types';

interface Props {
  priorDecisions: SupervisorReview[];
  currentIteration: number;
  onSubmit: (input: SupervisorDecisionInput) => Promise<void>;
  submitting: boolean;
}

export default function SupervisorCommentPanel({ priorDecisions, currentIteration, onSubmit, submitting }: Props) {
  const { t } = useTranslation();
  const [decision, setDecision] = useState<'approved' | 'disapproved' | null>(null);
  const [comments, setComments] = useState('');
  const [returnToReviewer, setReturnToReviewer] = useState(false);

  const canReturn = decision === 'disapproved' && currentIteration < 3;

  const handleSubmit = async () => {
    if (!decision || !comments.trim()) return;
    await onSubmit({
      decision,
      comments: comments.trim(),
      returnToReviewer: canReturn && returnToReviewer,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Prior decisions */}
      {priorDecisions.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('supervision.priorDecisions')}
          </h4>
          {priorDecisions.map((d) => (
            <div
              key={d.id}
              className={`p-3 rounded-lg text-sm ${
                d.decision === 'approved'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {d.decision === 'approved' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium capitalize">{d.decision}</span>
                <span className="text-gray-500 text-xs">
                  {t('supervision.iteration')} {d.revisionIteration}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300">{d.comments}</p>
            </div>
          ))}
        </div>
      )}

      {/* Decision form */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <h3 className="text-lg font-semibold">{t('supervision.yourDecision')}</h3>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDecision('approved')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
              decision === 'approved'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {t('supervision.approve')}
          </button>
          <button
            type="button"
            onClick={() => setDecision('disapproved')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
              decision === 'disapproved'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
            }`}
          >
            <XCircle className="w-5 h-5" />
            {t('supervision.disapprove')}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('supervision.comments')} *</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('supervision.commentsPlaceholder')}
          />
        </div>

        {canReturn && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={returnToReviewer}
              onChange={(e) => setReturnToReviewer(e.target.checked)}
              className="rounded border-gray-300"
            />
            <RotateCcw className="w-4 h-4 text-orange-500" />
            {t('supervision.returnToReviewer')}
          </label>
        )}
      </div>

      {/* Submit */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={handleSubmit}
          disabled={!decision || !comments.trim() || submitting}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? t('common.loading') : t('supervision.submitDecision')}
        </button>
      </div>
    </div>
  );
}
