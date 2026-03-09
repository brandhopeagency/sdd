import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import type { Session } from '@mentalhelpglobal/chat-types';
import { maskName } from '@mentalhelpglobal/chat-frontend-common';
import { Search, Filter, Calendar, Clock, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ChatHistoryList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { sessions, sessionsLoading, sessionsError, sessionsPagination, fetchSessions, piiMasked } =
    useWorkbenchStore();
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    fetchSessions({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      // backend supports both session "status" and "moderationStatus"; UI currently exposes moderation status.
      moderationStatus: (statusFilter as any) || 'all',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    });
  }, [fetchSessions, page, pageSize, debouncedSearch, statusFilter, dateFrom, dateTo]);

  const total = sessionsPagination?.total ?? 0;
  const limit = sessionsPagination?.limit ?? pageSize;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : (page - 1) * limit + sessions.length;

  const getStatusBadge = (status: Session['moderationStatus']) => {
    switch (status) {
      case 'moderated':
        return <span className="badge-success">{t('research.filters.moderated')}</span>;
      case 'in_review':
        return <span className="badge-warning">{t('research.filters.inReview')}</span>;
      case 'pending':
        return <span className="bg-neutral-100 text-neutral-600 badge">{t('research.filters.pending')}</span>;
      default:
        return null;
    }
  };

  const formatDuration = (session: Session) => {
    const ms = session.duration;
    const capMs = 24 * 60 * 60 * 1000;
    const capped = typeof ms === 'number' && ms > capMs;
    const minutes = typeof ms === 'number' ? Math.max(0, Math.floor(Math.min(ms, capMs) / 60000)) : null;

    const base = minutes === null ? '-' : capped ? '>24h' : `${minutes} min`;
    return session.status === 'active' ? `${base} (${t('research.session.ongoing', 'Ongoing')})` : base;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{t('research.title')}</h1>
          <p className="text-neutral-500 mt-1">{t('research.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('research.search')}
              className="input pl-10"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input w-40"
            >
              <option value="all">{t('research.filters.allStatus')}</option>
              <option value="pending">{t('research.filters.pending')}</option>
              <option value="in_review">{t('research.filters.inReview')}</option>
              <option value="moderated">{t('research.filters.moderated')}</option>
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neutral-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="input w-36"
            />
            <span className="text-neutral-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="input w-36"
            />
          </div>

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="input w-28"
            aria-label={t('users.pageSize.ariaLabel')}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {sessionsError && !sessionsLoading && (
          <div className="card p-4 border border-red-100 bg-red-50 text-red-700 text-sm">
            {sessionsError}
          </div>
        )}
        {sessionsLoading ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.loading')}</div>
        ) : sessions.length === 0 ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.notFound')}</div>
        ) : (
          sessions.map((session) => {
            const hasMessages = session.messageCount > 0;
            return (
              <div
                key={session.id}
                onClick={hasMessages ? () => navigate(`/workbench/research/session/${session.id}`) : undefined}
                className={`card p-5 transition-shadow ${
                  hasMessages ? 'hover:shadow-md cursor-pointer' : 'opacity-70 cursor-not-allowed'
                }`}
                aria-disabled={!hasMessages}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    session.moderationStatus === 'moderated' ? 'bg-secondary-500' :
                    session.moderationStatus === 'in_review' ? 'bg-amber-500' :
                    'bg-neutral-300'
                  }`} />
                  
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-neutral-700">
                        {session.id}
                      </span>
                      {getStatusBadge(session.moderationStatus)}
                      {!hasMessages && (
                        <span className="badge bg-neutral-100 text-neutral-600">
                          {t('research.session.empty', 'No messages')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                      <span>
                        {t('research.session.user')}: {piiMasked && session.userName 
                          ? maskName(session.userName) 
                          : session.userName || t('research.session.anonymous')
                        }
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(session.startedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(session)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {session.messageCount} {t('research.session.messages')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Tags */}
                  {session.tags.length > 0 && (
                    <div className="flex gap-1">
                      {session.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="badge-info text-xs">{tag}</span>
                      ))}
                      {session.tags.length > 3 && (
                        <span className="badge bg-neutral-100 text-neutral-500 text-xs">
                          +{session.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 card px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {t('users.pagination.showing')} {showingFrom}-{showingTo} {t('users.pagination.of')} {total}{' '}
          {t('research.session.total')}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || sessionsLoading}
            className="btn-ghost p-2"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-neutral-600">
            {t('users.pagination.page')} {page} {t('users.pagination.of')} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!sessionsPagination?.hasMore || sessionsLoading}
            className="btn-ghost p-2"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
