import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useReviewStore } from '@/stores/reviewStore';
import type { ReviewNotification } from '@mentalhelpglobal/chat-types';

const POLL_INTERVAL_MS = 30_000;

/** Map event types to navigation targets */
function getNavigationPath(notification: ReviewNotification): string | null {
  const data = notification.data as Record<string, unknown> | null;
  switch (notification.eventType) {
    case 'review_assigned':
    case 'assignment_expiring':
    case 'assignment_expired':
      return data?.sessionId
        ? `/workbench/review/session/${data.sessionId}`
        : '/workbench/review';
    case 'high_risk_flag':
    case 'medium_risk_flag':
      return '/workbench/review/escalations';
    case 'deanonymization_requested':
    case 'deanonymization_resolved':
      return '/workbench/review/deanonymization';
    case 'dispute_detected':
      return data?.sessionId
        ? `/workbench/review/session/${data.sessionId}`
        : '/workbench/review';
    case 'review_complete':
      return data?.sessionId
        ? `/workbench/review/session/${data.sessionId}`
        : '/workbench/review';
    default:
      return '/workbench/review';
  }
}

/** Format a relative time string (e.g. "2m ago", "3h ago") */
function timeAgo(dateStr: string | Date): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markNotificationRead,
    markAllRead,
  } = useReviewStore();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch on mount and poll
  useEffect(() => {
    fetchNotifications({ page: 1, limit: 20 });
    const timer = setInterval(() => {
      fetchNotifications({ page: 1, limit: 20 });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleNotificationClick = useCallback(
    async (notification: ReviewNotification) => {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
      }
      const path = getNavigationPath(notification);
      if (path) {
        navigate(path);
      }
      setOpen(false);
    },
    [markNotificationRead, navigate],
  );

  const handleMarkAllRead = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await markAllRead();
    },
    [markAllRead],
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
        aria-label={t('review.notifications.title')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-800">
              {t('review.notifications.title')}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('review.notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-50">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-neutral-400">
                {t('review.notifications.empty')}
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = !!n.readAt;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${
                      isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-1.5 flex-shrink-0">
                        {isRead ? (
                          <Check className="w-3.5 h-3.5 text-neutral-300" />
                        ) : (
                          <span className="block w-2.5 h-2.5 bg-primary-500 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm leading-snug ${
                            isRead
                              ? 'text-neutral-500 font-normal'
                              : 'text-neutral-800 font-medium'
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[11px] text-neutral-300 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
