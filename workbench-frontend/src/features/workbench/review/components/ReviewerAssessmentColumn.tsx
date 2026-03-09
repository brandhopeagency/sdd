import { useTranslation } from 'react-i18next';
import { SCORE_LABELS, CRITERIA_DEFINITIONS } from '@mentalhelpglobal/chat-types';

interface Props {
  review: any;
  ratings: any[];
}

export default function ReviewerAssessmentColumn({ review, ratings }: Props) {
  const { t } = useTranslation();

  const scoreLabel = review.average_score != null
    ? SCORE_LABELS[Math.round(review.average_score)]
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Review summary header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-2">{t('supervision.reviewerAssessment')}</h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: scoreLabel?.color }}>
            {review.average_score != null ? Number(review.average_score).toFixed(1) : '—'}
          </span>
          {scoreLabel && (
            <span className="text-sm font-medium" style={{ color: scoreLabel.color }}>
              {scoreLabel.label}
            </span>
          )}
        </div>
        {review.overall_comment && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
            "{review.overall_comment}"
          </p>
        )}
      </div>

      {/* Individual message ratings */}
      <div className="flex-1 p-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('supervision.messageRatings')}
        </h4>
        {ratings.map((rating: any, index: number) => {
          const label = SCORE_LABELS[Math.round(Number(rating.score))];
          return (
            <div
              key={rating.id}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('supervision.message')} #{index + 1}
                </span>
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded"
                  style={{ color: label?.color, backgroundColor: `${label?.color}15` }}
                >
                  {rating.score}/10
                </span>
              </div>

              {rating.comment && (
                <p className="text-xs text-gray-600 dark:text-gray-400">{rating.comment}</p>
              )}

              {/* Criteria feedback */}
              {rating.criteria_feedback && Array.isArray(rating.criteria_feedback) && rating.criteria_feedback.length > 0 && (
                <div className="space-y-1 pt-1">
                  {rating.criteria_feedback
                    .filter((cf: any) => cf.id != null)
                    .map((cf: any) => {
                      const def = CRITERIA_DEFINITIONS[cf.criterion as keyof typeof CRITERIA_DEFINITIONS];
                      return (
                        <div key={cf.id} className="text-xs">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {def?.displayName ?? cf.criterion}:
                          </span>{' '}
                          <span className="text-gray-500 dark:text-gray-400">{cf.feedback_text}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
