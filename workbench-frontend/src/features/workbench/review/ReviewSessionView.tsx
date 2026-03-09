import { useState, useEffect, useCallback, useMemo, useRef, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuthStore, hasPermission } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import ReviewRatingPanel from './ReviewRatingPanel';
import ReviewProgress from './components/ReviewProgress';
import RiskFlagDialog from './RiskFlagDialog';
import { TagBadge } from './components/TagBadge';
import { TagInput } from './components/TagInput';
import {
  listSessionTags,
  addSessionTag,
  removeSessionTag,
} from '@/services/tagApi';
import type { CriteriaFeedback, ReviewSummary, SessionTag, RAGCallDetail } from '@mentalhelpglobal/chat-types';
import RAGDetailPanel from './components/RAGDetailPanel';
import type { CriteriaFeedbackFormState } from '@/types/reviewForms';
import { EMPTY_CRITERIA_FEEDBACK } from '@/types/reviewForms';

function isAssistantReviewableMessage(message: { role?: unknown; isReviewable?: boolean }): boolean {
  const normalizedRole = String(message.role ?? '').trim().toLowerCase();
  const roleIsAssistantLike =
    normalizedRole === 'assistant' ||
    normalizedRole === 'ai' ||
    normalizedRole === 'bot' ||
    normalizedRole === 'model' ||
    normalizedRole === 'agent';
  if (!roleIsAssistantLike) {
    return false;
  }
  // Some backend deployments marked assistant messages as non-reviewable due to
  // legacy serialization bugs. Prefer role-based detection to keep review usable.
  if (message.isReviewable === false) {
    return true;
  }
  return roleIsAssistantLike;
}

function messageKey(id: unknown): string {
  return String(id);
}

export default function ReviewSessionView() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    selectedSession,
    sessionMessages,
    sessionLoading,
    currentReview,
    ratings,
    sessionFlags,
    error,
    selectSession,
    startReview,
    saveRating,
    submitReview,
    clearError,
  } = useReviewStore();

  const { user } = useAuthStore();
  const canAssignSessionTags = Boolean(
    user?.permissions && hasPermission(user.permissions, Permission.TAG_ASSIGN_SESSION),
  );
  const canCreateTag = Boolean(
    user?.permissions && hasPermission(user.permissions, Permission.TAG_CREATE),
  );

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);

  // Session tags state
  const [sessionTags, setSessionTags] = useState<SessionTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMessageId(null);
  }, [sessionId]);

  // Load session on mount
  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      await selectSession(sessionId);
    };

    loadSession();
  }, [sessionId, selectSession]);

  // Start review automatically if session loaded but no review exists
  useEffect(() => {
    if (!sessionId || !selectedSession || currentReview || sessionLoading) return;

    const autoStartReview = async () => {
      await startReview(sessionId);
    };

    autoStartReview();
  }, [sessionId, selectedSession, currentReview, sessionLoading, startReview]);

  // Auto-select first assistant message when messages load
  useEffect(() => {
    if (sessionMessages.length > 0 && !selectedMessageId) {
      const firstAssistantMessage = sessionMessages.find(
        (msg) => isAssistantReviewableMessage(msg)
      );
      if (firstAssistantMessage) {
        setSelectedMessageId(messageKey(firstAssistantMessage.id));
      }
    }
  }, [sessionMessages, selectedMessageId]);

  // Load session tags
  const fetchSessionTags = useCallback(async () => {
    if (!sessionId) return;
    try {
      setTagsLoading(true);
      setTagError(null);
      const tags = await listSessionTags(sessionId);
      setSessionTags(tags);
    } catch (err: any) {
      setTagError(err.message || 'Failed to load tags');
    } finally {
      setTagsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && selectedSession) {
      fetchSessionTags();
    }
  }, [sessionId, selectedSession, fetchSessionTags]);

  const handleAddSessionTag = useCallback(
    async (payload: { tagDefinitionId: string } | { tagName: string }) => {
      if (!sessionId) return;
      try {
        setTagError(null);
        await addSessionTag(sessionId, payload);
        await fetchSessionTags();
      } catch (err: any) {
        setTagError(err.message || 'Failed to add tag');
      }
    },
    [sessionId, fetchSessionTags],
  );

  const handleRemoveSessionTag = useCallback(
    async (tagDefinitionId: string) => {
      if (!sessionId) return;
      try {
        setTagError(null);
        await removeSessionTag(sessionId, tagDefinitionId);
        await fetchSessionTags();
      } catch (err: any) {
        setTagError(err.message || 'Failed to remove tag');
      }
    },
    [sessionId, fetchSessionTags],
  );

  // Warn before unload if there are unsaved ratings
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentReview && ratings.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentReview, ratings]);

  // Refs for keyboard navigation between messages
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleTranscriptKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, messageId: string) => {
      const reviewableAssistantMsgs = sessionMessages.filter(
        (msg) => isAssistantReviewableMessage(msg),
      );
      const currentIndex = reviewableAssistantMsgs.findIndex((msg) => messageKey(msg.id) === messageId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          nextIndex = Math.min(currentIndex + 1, reviewableAssistantMsgs.length - 1);
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        default:
          return;
      }

      if (nextIndex !== currentIndex) {
        const nextMsg = reviewableAssistantMsgs[nextIndex];
        const nextMessageId = messageKey(nextMsg.id);
        setSelectedMessageId(nextMessageId);
        messageRefs.current.get(nextMessageId)?.focus();
      }
    },
    [sessionMessages],
  );

  // Get assistant messages only (for rating)
  const assistantMessages = useMemo(() => {
    return sessionMessages.filter((msg) => isAssistantReviewableMessage(msg));
  }, [sessionMessages]);

  // Pre-compute 1-based index of each reviewable assistant message for aria-labels.
  const assistantIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const msg of sessionMessages) {
      if (isAssistantReviewableMessage(msg)) {
        map.set(messageKey(msg.id), ++idx);
      }
    }
    return map;
  }, [sessionMessages]);

  // Get current rating for selected message
  const currentRating = useMemo(() => {
    if (!selectedMessageId) return null;
    const rating = ratings.get(selectedMessageId);
    if (!rating) return null;

    // Convert criteriaFeedback array to form state object
    const criteriaFeedbackForm: CriteriaFeedbackFormState = {
      ...EMPTY_CRITERIA_FEEDBACK,
    };
    if (rating.criteriaFeedback && Array.isArray(rating.criteriaFeedback)) {
      rating.criteriaFeedback.forEach((feedback) => {
        if (feedback.criterion in criteriaFeedbackForm) {
          criteriaFeedbackForm[feedback.criterion as keyof CriteriaFeedbackFormState] =
            feedback.feedbackText;
        }
      });
    }

    return {
      score: rating.score ?? null,
      comment: rating.comment ?? '',
      criteriaFeedback: criteriaFeedbackForm,
    };
  }, [selectedMessageId, ratings]);

  // Calculate progress
  const progress = useMemo(() => {
    const rated = assistantMessages.filter((msg) => {
      const rating = ratings.get(messageKey(msg.id));
      return rating && rating.score !== null;
    }).length;
    const total = assistantMessages.length;
    const canSubmit = rated === total && total > 0;

    return { rated, total, canSubmit };
  }, [assistantMessages, ratings]);

  // Handle rating save
  const handleSaveRating = useCallback(
    async (
      messageId: string,
      score: number,
      comment: string | null,
      criteriaFeedback: CriteriaFeedbackFormState
    ) => {
      if (!sessionId || !currentReview?.id) return;

      // Convert criteriaFeedback form state to API array format
      const criteriaFeedbackArray = [];
      if (criteriaFeedback.relevance.trim().length >= 10) {
        criteriaFeedbackArray.push({
          criterion: 'relevance' as const,
          feedbackText: criteriaFeedback.relevance.trim(),
        });
      }
      if (criteriaFeedback.empathy.trim().length >= 10) {
        criteriaFeedbackArray.push({
          criterion: 'empathy' as const,
          feedbackText: criteriaFeedback.empathy.trim(),
        });
      }
      if (criteriaFeedback.safety.trim().length >= 10) {
        criteriaFeedbackArray.push({
          criterion: 'safety' as const,
          feedbackText: criteriaFeedback.safety.trim(),
        });
      }
      if (criteriaFeedback.ethics.trim().length >= 10) {
        criteriaFeedbackArray.push({
          criterion: 'ethics' as const,
          feedbackText: criteriaFeedback.ethics.trim(),
        });
      }
      if (criteriaFeedback.clarity.trim().length >= 10) {
        criteriaFeedbackArray.push({
          criterion: 'clarity' as const,
          feedbackText: criteriaFeedback.clarity.trim(),
        });
      }

      await saveRating(sessionId, currentReview.id, {
        messageId,
        score,
        comment: comment || undefined,
        criteriaFeedback: criteriaFeedbackArray.length > 0 ? (criteriaFeedbackArray as CriteriaFeedback[]) : undefined,
      });
    },
    [sessionId, currentReview, saveRating]
  );

  // Handle submit review
  const handleSubmitReview = useCallback(async () => {
    if (!sessionId || !currentReview?.id || !progress.canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await submitReview(sessionId, currentReview.id);
      setSubmitSuccess(true);

      // Navigate back to queue after a brief delay
      setTimeout(() => {
        navigate('/workbench/review');
      }, 1500);
    } catch {
      // Error is handled by store
      setIsSubmitting(false);
    }
  }, [sessionId, currentReview, progress.canSubmit, isSubmitting, submitReview, navigate, clearError]);

  // Use threshold from review config snapshot when available.
  // Backend enforces this threshold during rating save validation.
  const criteriaThreshold = currentReview?.configSnapshot?.criteriaThreshold ?? 7;

  // Loading state
  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-sky-600" />
          <p className="text-neutral-600">{t('review.session.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !selectedSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
        <button
          onClick={() => navigate('/workbench/review')}
          className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
        >
          {t('review.common.back')}
        </button>
      </div>
    );
  }

  // No session data
  if (!selectedSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600">{t('review.session.loading')}</p>
        </div>
      </div>
    );
  }

  if (sessionMessages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-medium text-amber-800">{t('review.session.noMessagesTitle')}</p>
          <p className="mt-1 text-sm text-amber-700">{t('review.session.noMessagesDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (sessionId) {
                void selectSession(sessionId);
              }
            }}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
          >
            {t('review.common.retry')}
          </button>
          <button
            onClick={() => navigate('/workbench/review')}
            className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
          >
            {t('review.common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workbench/review')}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            aria-label={t('review.common.back')}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('review.common.back')}
          </button>
          <h1 className="text-xl font-bold text-neutral-800">
            {selectedSession?.isCurrentUserTiebreaker
              ? t('review.session.tiebreaker')
              : t('review.session.title')}
          </h1>

          {/* Status badges */}
          {selectedSession?.reviewStatus === 'disputed' && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {t('review.session.disputed')}
            </span>
          )}
          {selectedSession?.reviewStatus === 'disputed_closed' && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              {t('review.session.disputedClosed')}
            </span>
          )}
          {selectedSession?.reviewStatus === 'complete' && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {t('review.session.complete')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Review count */}
          <span className="text-sm text-neutral-600">
            {t('review.session.reviewCount', {
              count: selectedSession?.reviewCount ?? 0,
              required: selectedSession?.reviewsRequired ?? 3,
            })}
          </span>

          {/* Aggregate score after completion */}
          {selectedSession?.reviewFinalScore != null && (
            <span className="inline-flex items-center rounded-md bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
              {t('review.session.aggregateScore', {
                score: selectedSession.reviewFinalScore.toFixed(1),
              })}
            </span>
          )}

          {/* Flag button */}
          <button
            onClick={() => setFlagDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
            </svg>
            {t('review.flag.title')}
          </button>
        </div>
      </div>

      {/* Existing flags for this session */}
      {sessionFlags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-6 py-2">
          <span className="text-xs font-medium text-neutral-500">{t('review.session.flags')}</span>
          {sessionFlags.map((flag) => {
            const sevColors: Record<string, string> = {
              high: 'bg-red-100 text-red-700 border-red-200',
              medium: 'bg-amber-100 text-amber-700 border-amber-200',
              low: 'bg-sky-100 text-sky-700 border-sky-200',
            };
            return (
              <span
                key={flag.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${sevColors[flag.severity] ?? sevColors.low}`}
              >
                {flag.isAutoDetected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {t(`review.flag.severityOptions.${flag.severity}`)} — {t(`review.flag.reasonOptions.${flag.reasonCategory}`, flag.reasonCategory)}
                <span className={`ml-1 rounded-full px-1.5 text-[10px] ${flag.status === 'resolved' ? 'bg-emerald-200 text-emerald-800' : 'bg-neutral-200 text-neutral-600'}`}>
                  {flag.status}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Blinding / tiebreaker info bar */}
      {(() => {
        const status = selectedSession?.reviewStatus;
        const isActive = status === 'pending_review' || status === 'in_review' || status === 'disputed';

        if (selectedSession?.isCurrentUserTiebreaker && isActive && selectedSession?.scoreRange) {
          return (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2.5">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-800">
                {t('review.session.tiebreaker')} &mdash;{' '}
                {t('review.session.scoreRange', {
                  min: selectedSession.scoreRange.min.toFixed(1),
                  max: selectedSession.scoreRange.max.toFixed(1),
                })}
              </span>
            </div>
          );
        }

        if (isActive) {
          return (
            <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-6 py-2.5">
              <svg className="h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
              </svg>
              <span className="text-sm text-sky-700">
                {t('review.session.blinded')}
              </span>
            </div>
          );
        }

        return null;
      })()}

      {/* Session Tags */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-2.5">
        <span className="text-xs font-medium text-neutral-500">{t('review.tags.title')}:</span>

        {tagsLoading ? (
          <span className="text-xs text-neutral-400">{t('review.common.loading')}</span>
        ) : sessionTags.length === 0 && !canAssignSessionTags ? (
          <span className="text-xs text-neutral-400">{t('review.tags.noTags')}</span>
        ) : (
          <>
            {sessionTags.map((st) => (
              <TagBadge
                key={st.tagDefinitionId}
                name={st.tagDefinition?.name ?? ''}
                category={st.tagDefinition?.category as 'user' | 'chat' | undefined}
                onRemove={
                  canAssignSessionTags && st.source !== 'system'
                    ? () => handleRemoveSessionTag(st.tagDefinitionId)
                    : undefined
                }
              />
            ))}
          </>
        )}

        {canAssignSessionTags && (
          <div className="ml-auto w-48">
            <TagInput
              onSelect={handleAddSessionTag}
              excludeTagIds={sessionTags.map((st) => st.tagDefinitionId)}
              canCreateTag={canCreateTag}
            />
          </div>
        )}

        {tagError && (
          <span className="text-xs text-red-600">{tagError}</span>
        )}
      </div>

      {/* Main content - Two column layout */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden lg:flex-row">
        {/* Left panel - Chat transcript (60%) */}
        <div className="flex w-full min-h-0 flex-col border-b border-neutral-200 bg-neutral-50 lg:w-[60%] lg:border-b-0 lg:border-r">
          <div className="border-b border-neutral-200 bg-white px-6 py-3">
            <h2 className="text-sm font-semibold text-neutral-700">
              {t('review.session.transcript')}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {sessionMessages.map((message) => {
                const isUser = message.role === 'user';
                const isAssistant = isAssistantReviewableMessage(message);
                const isAssistantReviewable = isAssistant;
                const key = messageKey(message.id);
                const isSelected = selectedMessageId === key;
                const hasRating = ratings.has(key);

                return (
                  <div
                    key={message.id}
                    ref={(el) => {
                      if (isAssistantReviewable && el) {
                        messageRefs.current.set(key, el);
                      }
                    }}
                    role={isAssistantReviewable ? 'button' : undefined}
                    tabIndex={isAssistantReviewable ? 0 : undefined}
                    aria-label={
                      isAssistantReviewable
                        ? t('review.session.assistantMessageAriaLabel', {
                            index: assistantIndexMap.get(key) ?? 1,
                            total: progress.total,
                          })
                        : undefined
                    }
                    aria-current={isAssistantReviewable && isSelected ? 'true' : undefined}
                    onClick={() => {
                      if (isAssistantReviewable) {
                        setSelectedMessageId(key);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (isAssistantReviewable) {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedMessageId(key);
                        } else {
                          handleTranscriptKeyDown(e, key);
                        }
                      }
                    }}
                    className={`
                      rounded-lg border p-4 transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1
                      ${
                        isAssistantReviewable
                          ? `
                            cursor-pointer
                            ${isSelected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200' : 'border-neutral-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'}
                          `
                          : 'border-neutral-200 bg-neutral-100'
                      }
                    `}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          isUser ? 'text-neutral-600' : 'text-sky-700'
                        }`}
                      >
                        {isUser ? t('review.session.roleUser') : t('review.session.roleAssistant')}
                      </span>
                      {hasRating && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {t('review.session.rated')}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm ${
                        isUser ? 'text-neutral-700' : 'text-neutral-800'
                      }`}
                    >
                      {message.content}
                    </div>
                    {(message as any).ragCallDetail && (
                      <RAGDetailPanel ragDetail={(message as any).ragCallDetail as RAGCallDetail} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel - Review panel (40%) */}
        <div className="flex w-full min-h-0 flex-col bg-white lg:w-[40%]">
          {/* Review Progress */}
          <div className="border-b border-neutral-200 px-6 py-4">
            <ReviewProgress
              rated={progress.rated}
              total={progress.total}
              canSubmit={progress.canSubmit}
            />
          </div>

          {/* All Reviews — shown after session completion */}
          {selectedSession?.allReviews && selectedSession.allReviews.length > 0 && (
            <div className="border-b border-neutral-200 px-6 py-4">
              <h3 className="mb-3 text-sm font-semibold text-neutral-700">
                {t('review.session.allReviews')}
              </h3>
              <div className="space-y-2">
                {(selectedSession.allReviews as ReviewSummary[]).map((review: ReviewSummary) => (
                  <div
                    key={review.reviewId}
                    className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-800">
                        {review.reviewerName}
                      </span>
                      {review.isTiebreaker && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {t('review.session.tiebreaker')}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-sky-700">
                      {review.averageScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Rating Panel */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedMessageId ? (
              <ReviewRatingPanel
                messageId={selectedMessageId}
                currentRating={currentRating}
                criteriaThreshold={criteriaThreshold}
                onSave={handleSaveRating}
                disabled={isSubmitting || submitSuccess}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-neutral-500">
                  {t('review.session.rateMessage')}
                </p>
              </div>
            )}
          </div>

          {/* Submit button */}
          <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4" aria-live="polite">
            {submitSuccess ? (
              <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('review.session.submitted')}
              </div>
            ) : (
              <button
                onClick={handleSubmitReview}
                disabled={!progress.canSubmit || isSubmitting}
                className={`
                  w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white
                  transition-all duration-200
                  ${
                    progress.canSubmit && !isSubmitting
                      ? 'bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
                      : 'cursor-not-allowed bg-neutral-300 text-neutral-500'
                  }
                `}
              >
                {isSubmitting ? t('review.session.submitting') : t('review.session.submitReview')}
              </button>
            )}
            {!progress.canSubmit && progress.total > 0 && (
              <p className="mt-2 text-center text-xs text-neutral-500">
                {t('review.session.rateAll')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Risk Flag Dialog */}
      {sessionId && (
        <RiskFlagDialog
          sessionId={sessionId}
          open={flagDialogOpen}
          onClose={() => setFlagDialogOpen(false)}
        />
      )}
    </div>
  );
}
