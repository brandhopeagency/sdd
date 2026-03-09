import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import SessionCard from './SessionCard';

const PAGE_SIZE = 20;

interface ExcludedTabProps {
  page: number;
  onPageChange: (page: number) => void;
}

export default function ExcludedTab({ page, onPageChange }: ExcludedTabProps) {
  const { t } = useTranslation();
  const { queue, queueTotal, queueLoading, error } = useReviewStore();

  const totalPages = Math.ceil(queueTotal / PAGE_SIZE);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  // Loading skeleton
  if (queueLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-neutral-200 rounded" />
                  <div className="h-3 w-24 bg-neutral-200 rounded" />
                </div>
                <div className="h-6 w-20 bg-neutral-200 rounded-full" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-neutral-200 rounded-full" />
                <div className="h-5 w-20 bg-neutral-200 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Empty state
  if (queue.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-neutral-900">
          {t('review.tags.excludedSessions')}
        </h3>
        <p className="mt-2 text-sm text-neutral-500">
          {t('review.queue.empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          {t('review.tags.excludedSessions')} — {queueTotal}{' '}
          {queueTotal === 1
            ? t('review.queue.pagination.showing', { start: 1, end: 1, total: 1 })
            : ''}
        </p>
      </div>

      {/* Session cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {queue.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isExcludedView
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
          <p className="text-sm text-neutral-700">
            {t('review.queue.pagination.showing', {
              start: (page - 1) * PAGE_SIZE + 1,
              end: Math.min(page * PAGE_SIZE, queueTotal),
              total: queueTotal,
            })}
          </p>
          <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label={t('review.queue.pagination.ariaLabel')}>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrevious}
              className={`
                relative inline-flex items-center rounded-l-md border border-neutral-300 bg-white px-3 py-2
                text-sm font-medium transition-colors duration-150
                focus:z-10 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                ${hasPrevious ? 'text-neutral-700 hover:bg-neutral-50' : 'cursor-not-allowed text-neutral-400'}
              `}
            >
              <span className="sr-only">{t('review.queue.pagination.previous')}</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span
              className="relative inline-flex items-center border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
              aria-current="page"
            >
              {t('review.queue.pagination.pageInfo', { current: page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext}
              className={`
                relative inline-flex items-center rounded-r-md border border-neutral-300 bg-white px-3 py-2
                text-sm font-medium transition-colors duration-150
                focus:z-10 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                ${hasNext ? 'text-neutral-700 hover:bg-neutral-50' : 'cursor-not-allowed text-neutral-400'}
              `}
            >
              <span className="sr-only">{t('review.queue.pagination.next')}</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
