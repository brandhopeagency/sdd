import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueueSession } from '@mentalhelpglobal/chat-types';
import { TagBadge } from './TagBadge';

interface SessionCardProps {
  session: QueueSession;
  onClick?: (sessionId: string) => void;
  onAssign?: (sessionId: string) => void;
  showAssign?: boolean;
  /** When true, renders exclusion reason badges with distinct styling */
  isExcludedView?: boolean;
}

/** Risk level to badge styling map — enhanced with ring/border for prominence */
const RISK_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  high:   { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-600',     border: 'border-red-300' },
  medium: { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500',  border: 'border-orange-300' },
  low:    { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-300' },
  none:   { bg: 'bg-neutral-100', text: 'text-neutral-600', dot: 'bg-neutral-400', border: 'border-neutral-200' },
};

/** Card border accent for high-risk sessions */
const CARD_RISK_BORDER: Record<string, string> = {
  high:   'border-l-red-500',
  medium: 'border-l-orange-400',
  low:    'border-l-emerald-400',
  none:   'border-l-transparent',
};

function formatRelativeTime(date: Date, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return t('review.time.daysAgo', { count: diffDays });
  }
  if (diffHours > 0) {
    return t('review.time.hoursAgo', { count: diffHours });
  }
  if (diffMinutes > 0) {
    return t('review.time.minutesAgo', { count: diffMinutes });
  }
  return t('review.time.justNow');
}

/**
 * Format a countdown duration as "Xh Ym" or "Xm" or "Expired"
 */
function formatCountdown(expiresAt: Date, t: (key: string, opts?: Record<string, unknown>) => string): {
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
} {
  const now = new Date();
  const diffMs = new Date(expiresAt).getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: t('review.sessionCard.expired'), isUrgent: true, isExpired: true };
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  const isUrgent = diffHours < 2;

  if (diffHours > 0) {
    return {
      text: t('review.sessionCard.expiresIn', { hours: diffHours, minutes: remainingMinutes }),
      isUrgent,
      isExpired: false,
    };
  }
  return {
    text: t('review.sessionCard.expiresInMinutes', { minutes: diffMinutes }),
    isUrgent,
    isExpired: false,
  };
}

export default function SessionCard({
  session,
  onClick,
  onAssign,
  showAssign = false,
  isExcludedView = false,
}: SessionCardProps) {
  const { t } = useTranslation();

  const riskStyle = RISK_STYLES[session.riskLevel] ?? RISK_STYLES.none;
  const cardBorder = CARD_RISK_BORDER[session.riskLevel] ?? CARD_RISK_BORDER.none;

  const progressPercent = useMemo(() => {
    if (session.reviewsRequired === 0) return 0;
    return Math.min(100, Math.round((session.reviewCount / session.reviewsRequired) * 100));
  }, [session.reviewCount, session.reviewsRequired]);

  const relativeTime = useMemo(
    () => formatRelativeTime(session.startedAt, t),
    [session.startedAt, t],
  );

  // Expiration countdown — ticks every minute
  const [countdown, setCountdown] = useState<{ text: string; isUrgent: boolean; isExpired: boolean } | null>(null);

  useEffect(() => {
    if (!session.assignedExpiresAt) {
      setCountdown(null);
      return;
    }

    const update = () => setCountdown(formatCountdown(session.assignedExpiresAt!, t));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [session.assignedExpiresAt, t]);

  const isAssigned = Boolean(session.assignedReviewerId);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(session.id)}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(session.id);
        }
      }}
      aria-label={t('review.sessionCard.ariaLabel', {
        sessionId: session.anonymousSessionId,
      })}
      className={`
        rounded-xl border border-l-4 ${cardBorder} border-neutral-200 bg-white p-4 shadow-sm
        transition-all duration-150
        ${onClick ? 'cursor-pointer hover:border-sky-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-1' : ''}
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Session ID */}
          <h3 className="truncate text-sm font-semibold text-neutral-800">
            {session.anonymousSessionId}
          </h3>
          {/* User ID */}
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {session.anonymousUserId}
          </p>
        </div>

        {/* Risk badge — enhanced with border */}
        <span
          className={`
            inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold
            ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}
          `}
          aria-label={t('review.sessionCard.riskLevel', {
            level: t(`review.riskLevels.${session.riskLevel}`),
          })}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${riskStyle.dot}`} aria-hidden="true" />
          {t(`review.riskLevels.${session.riskLevel}`)}
        </span>
      </div>

      {/* Assignment indicator */}
      {isAssigned && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 border border-violet-200">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('review.sessionCard.assignedTo')}
          </span>
          {countdown && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border ${
                countdown.isExpired
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : countdown.isUrgent
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200'
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {countdown.text}
            </span>
          )}
        </div>
      )}

      {/* Session tags */}
      {session.tags && session.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.tags.map((tag) => (
            <TagBadge
              key={tag.id ?? tag.tagDefinitionId}
              name={tag.tagDefinition?.name ?? ''}
              category={tag.tagDefinition?.category as 'user' | 'chat' | undefined}
            />
          ))}
        </div>
      )}

      {/* Exclusion reason badges (shown in excluded view) */}
      {isExcludedView && session.exclusions && session.exclusions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.exclusions.map((exclusion) => (
            <span
              key={exclusion.id}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
              aria-label={`${t('review.tags.exclusionReason')}: ${exclusion.reason}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {exclusion.reason}
              <span className="text-amber-500">({exclusion.reasonSource === 'user_tag' ? t('review.tags.categoryUser') : t('review.tags.categoryChat')})</span>
            </span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
        {/* Message count */}
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {t('review.sessionCard.messageCount', { count: session.messageCount })}
        </span>

        {/* Timestamp */}
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {relativeTime}
        </span>

        {/* Auto-flagged indicator */}
        {session.autoFlagged && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {t('review.sessionCard.autoFlagged')}
          </span>
        )}
      </div>

      {/* Review progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-neutral-600">
            {t('review.sessionCard.reviewProgress', {
              completed: session.reviewCount,
              required: session.reviewsRequired,
            })}
          </span>
          <span className="font-medium text-neutral-500">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPercent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
            }`}
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={session.reviewCount}
            aria-valuemin={0}
            aria-valuemax={session.reviewsRequired}
            aria-label={t('review.sessionCard.progressAriaLabel', {
              completed: session.reviewCount,
              required: session.reviewsRequired,
            })}
          />
        </div>
      </div>

      {/* Assign button */}
      {showAssign && onAssign && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(session.id);
            }}
            className="
              inline-flex items-center gap-1.5 rounded-md bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700
              border border-primary-200
              transition-colors duration-150
              hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-300
            "
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {t('review.sessionCard.assign')}
          </button>
        </div>
      )}
    </div>
  );
}
