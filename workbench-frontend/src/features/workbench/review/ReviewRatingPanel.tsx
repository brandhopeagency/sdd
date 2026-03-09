import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CriteriaFeedbackFormState } from '@/types/reviewForms';
import { EMPTY_CRITERIA_FEEDBACK } from '@/types/reviewForms';
import ScoreSelector from './components/ScoreSelector';
import CriteriaFeedbackForm from './components/CriteriaFeedbackForm';

interface ReviewRatingPanelProps {
  messageId: string;
  currentRating: {
    score: number | null;
    comment: string;
    criteriaFeedback: CriteriaFeedbackFormState;
  } | null;
  criteriaThreshold: number;
  onSave: (
    messageId: string,
    score: number,
    comment: string | null,
    criteriaFeedback: CriteriaFeedbackFormState,
  ) => Promise<void>;
  disabled?: boolean;
}

const DEBOUNCE_MS = 500;

export default function ReviewRatingPanel({
  messageId,
  currentRating,
  criteriaThreshold,
  onSave,
  disabled = false,
}: ReviewRatingPanelProps) {
  const { t } = useTranslation();

  // Local state initialized from currentRating or defaults
  const [score, setScore] = useState<number | null>(currentRating?.score ?? null);
  const [comment, setComment] = useState<string>(currentRating?.comment ?? '');
  const [criteriaFeedback, setCriteriaFeedback] = useState<CriteriaFeedbackFormState>(
    currentRating?.criteriaFeedback ?? { ...EMPTY_CRITERIA_FEEDBACK },
  );

  // Save confirmation state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Save confirmation timer ref
  const saveConfirmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've received initial data to avoid saving on mount
  const isInitialMount = useRef(true);
  // Track messageId changes to reset state
  const prevMessageIdRef = useRef(messageId);

  // Reset state when messageId changes (navigating between messages)
  useEffect(() => {
    if (prevMessageIdRef.current !== messageId) {
      prevMessageIdRef.current = messageId;
      setScore(currentRating?.score ?? null);
      setComment(currentRating?.comment ?? '');
      setCriteriaFeedback(currentRating?.criteriaFeedback ?? { ...EMPTY_CRITERIA_FEEDBACK });
      setSaveStatus('idle');
      isInitialMount.current = true;
    }
  }, [messageId, currentRating]);

  // Cleanup save confirmation timer on unmount
  useEffect(() => {
    return () => {
      if (saveConfirmRef.current) {
        clearTimeout(saveConfirmRef.current);
      }
    };
  }, []);

  // Auto-save with debounce when score, comment, or criteria change
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Can only save if a score is set
    if (score === null || disabled) return;

    // Keep FE validation aligned with backend contract:
    // when score is at/below threshold, at least one criterion with >=10 chars is required.
    if (score <= criteriaThreshold) {
      const hasValidCriteria =
        criteriaFeedback.relevance.trim().length >= 10 ||
        criteriaFeedback.empathy.trim().length >= 10 ||
        criteriaFeedback.safety.trim().length >= 10 ||
        criteriaFeedback.ethics.trim().length >= 10 ||
        criteriaFeedback.clarity.trim().length >= 10;
      if (!hasValidCriteria) {
        setSaveStatus('idle');
        return;
      }
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setSaveStatus('saving');

    debounceRef.current = setTimeout(async () => {
      try {
        await onSave(
        messageId,
        score,
        comment.trim() || null,
        criteriaFeedback,
        );

        setSaveStatus('saved');

        // Clear "saved" confirmation after 2 seconds
        if (saveConfirmRef.current) {
          clearTimeout(saveConfirmRef.current);
        }
        saveConfirmRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch {
        setSaveStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [score, comment, criteriaFeedback, messageId, disabled, onSave, criteriaThreshold]);

  const handleScoreChange = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleCriteriaChange = useCallback((newFeedback: CriteriaFeedbackFormState) => {
    setCriteriaFeedback(newFeedback);
  }, []);

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <h3 className="text-sm font-semibold text-neutral-700">
        {t('review.ratingPanel.title')}
      </h3>

      {/* Score Selector */}
      <ScoreSelector
        value={score}
        onChange={handleScoreChange}
        disabled={disabled}
      />

      {/* Criteria Feedback Form - shown when score is set */}
      {score !== null && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <CriteriaFeedbackForm
            score={score}
            criteriaThreshold={criteriaThreshold}
            feedback={criteriaFeedback}
            onChange={handleCriteriaChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Optional comment */}
      <div className="space-y-1.5">
        <label
          htmlFor={`comment-${messageId}`}
          className="block text-sm font-medium text-neutral-700"
        >
          {t('review.ratingPanel.commentLabel')}
        </label>
        <textarea
          id={`comment-${messageId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={disabled}
          placeholder={t('review.ratingPanel.commentPlaceholder')}
          aria-label={t('review.ratingPanel.commentAriaLabel')}
          rows={3}
          className={`
            w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm
            transition-colors duration-150
            placeholder:text-neutral-400
            focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200
            ${disabled ? 'cursor-not-allowed bg-neutral-50' : 'bg-white'}
          `}
        />
      </div>

      {/* Auto-save indicator with confirmation */}
      {score !== null && !disabled && (
        <div className="flex items-center gap-1.5 text-xs" aria-live="polite">
          {saveStatus === 'saving' && (
            <p className="flex items-center gap-1.5 text-neutral-400">
              <svg
                className="h-3.5 w-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t('review.ratingPanel.saving')}
            </p>
          )}
          {saveStatus === 'saved' && (
            <p className="flex items-center gap-1.5 text-emerald-600">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('review.ratingPanel.saved')}
            </p>
          )}
          {saveStatus === 'idle' && (
            <p className="flex items-center gap-1.5 text-neutral-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t('review.ratingPanel.autoSaveHint')}
            </p>
          )}
          {saveStatus === 'error' && (
            <p className="flex items-center gap-1.5 text-red-600">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                />
              </svg>
              {t('review.ratingPanel.saveError', 'Failed to save. Please retry.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
