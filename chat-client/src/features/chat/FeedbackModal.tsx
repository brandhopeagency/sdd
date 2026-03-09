import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Star } from 'lucide-react';

interface FeedbackModalProps {
  onSubmit: (rating: 1 | 2 | 3 | 4 | 5, comment: string) => void;
  onClose: () => void;
}

export default function FeedbackModal({ onSubmit, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [hoveredRating, setHoveredRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [comment, setComment] = useState('');

  const ratingOptions = [
    { label: t('feedback.ratings.poor'), value: 1 as const },
    { label: t('feedback.ratings.fair'), value: 2 as const },
    { label: t('feedback.ratings.good'), value: 3 as const },
    { label: t('feedback.ratings.great'), value: 4 as const },
    { label: t('feedback.ratings.excellent'), value: 5 as const },
  ];

  const handleSubmit = () => {
    if (selectedRating === null) return;
    onSubmit(selectedRating, comment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-800">{t('feedback.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-3">
            {t('feedback.question')}
          </label>
          <div className="flex flex-col items-center">
            {/* Star Rating Scale */}
            <div className="flex items-center gap-2">
              {([1, 2, 3, 4, 5] as const).map((rating) => {
                // Determine which rating to use for display (hover > selected)
                const displayRating = hoveredRating || selectedRating;
                const isFilled = displayRating !== null && rating <= displayRating;
                const isHovered = hoveredRating === rating;

                return (
                  <button
                    key={rating}
                    onClick={() => setSelectedRating(rating)}
                    onMouseEnter={() => setHoveredRating(rating)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="p-1 transition-all duration-200 hover:scale-110"
                    aria-label={`Rate ${rating} out of 5`}
                  >
                    <Star
                      className={`w-8 h-8 transition-all duration-200 ${
                        isFilled
                          ? isHovered
                            ? 'fill-primary-400 text-primary-400'
                            : 'fill-primary-500 text-primary-500'
                          : 'fill-none text-neutral-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Rating Label */}
            <div className="mt-2 text-sm text-neutral-600 min-h-[20px]">
              {selectedRating
                ? ratingOptions[selectedRating - 1].label
                : hoveredRating
                ? ratingOptions[hoveredRating - 1].label
                : t('feedback.selectRating')}
            </div>
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {t('feedback.comment')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('feedback.commentPlaceholder')}
            rows={3}
            className="input resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-outline">
            {t('feedback.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedRating === null}
            className="btn-primary"
          >
            {t('feedback.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
