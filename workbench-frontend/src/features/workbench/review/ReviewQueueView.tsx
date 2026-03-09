import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuthStore, hasPermission } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import { adminGroupsApi } from '@/services/adminApi';
import type { GroupDto } from '@/services/adminApi';
import SessionCard from './components/SessionCard';
import TagFilter from './components/TagFilter';
import ExcludedTab from './components/ExcludedTab';
import SupervisorQueueTab from './components/SupervisorQueueTab';
import AwaitingFeedbackTab from './components/AwaitingFeedbackTab';

const PAGE_SIZE = 20;

type QueueTab = 'pending' | 'flagged' | 'in_progress' | 'completed' | 'excluded' | 'supervision' | 'awaiting';
type QueueScopeMode = 'all' | string;

const BASE_TABS: { key: QueueTab; labelKey: string; permission?: string }[] = [
  { key: 'pending', labelKey: 'review.queue.tabs.pending' },
  { key: 'flagged', labelKey: 'review.queue.tabs.flagged' },
  { key: 'in_progress', labelKey: 'review.queue.tabs.in_progress' },
  { key: 'completed', labelKey: 'review.queue.tabs.completed' },
  { key: 'excluded', labelKey: 'review.tags.excluded' },
  { key: 'supervision', labelKey: 'supervision.queue', permission: 'review:supervise' },
  { key: 'awaiting', labelKey: 'supervision.awaitingFeedback' },
];

export default function ReviewQueueView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canAssign = Boolean(user?.permissions && hasPermission(user.permissions, Permission.REVIEW_ASSIGN));
  const canSupervise = Boolean(user?.permissions && hasPermission(user.permissions, Permission.REVIEW_SUPERVISE));

  const TABS = BASE_TABS.filter((tab) => {
    if (tab.permission === 'review:supervise') return canSupervise;
    return true;
  });
  const {
    queue,
    queueTotal,
    queueCounts,
    queueLoading,
    queueTab,
    queuePage,
    queueFilters,
    selectedTags,
    showExcluded,
    fetchQueue,
    setQueueTab,
    setQueuePage,
    setQueueFilters,
    setSelectedTags,
    setQueueScopeGroupId,
    assignSession,
    error,
    clearError,
  } = useReviewStore();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<QueueScopeMode>('all');
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(null);
  const [assignReviewerInput, setAssignReviewerInput] = useState('');
  const [allGroups, setAllGroups] = useState<GroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    adminGroupsApi.list().then((res) => {
      if (res.success && res.data) {
        setAllGroups(res.data);
      }
      setGroupsLoading(false);
    }).catch(() => {
      setGroupsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (scopeMode === 'all') {
      setQueueScopeGroupId(undefined);
    } else {
      setQueueScopeGroupId(scopeMode);
    }
  }, [scopeMode, setQueueScopeGroupId]);

  useEffect(() => {
    fetchQueue();
  }, [queueTab, queuePage, queueFilters, selectedTags, showExcluded, fetchQueue]);

  const handleSessionClick = (sessionId: string) => {
    navigate(`/workbench/review/session/${sessionId}`);
  };

  const handleTabChange = (tab: QueueTab) => {
    setQueueTab(tab);
  };

  const handlePreviousPage = () => {
    if (queuePage > 1) {
      setQueuePage(queuePage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(queueTotal / PAGE_SIZE);
    if (queuePage < totalPages) {
      setQueuePage(queuePage + 1);
    }
  };

  const handleRetry = () => {
    clearError();
    fetchQueue();
  };

  const handleFilterChange = useCallback(
    (key: string, value: string | boolean | undefined) => {
      setQueueFilters({ [key]: value || undefined });
    },
    [setQueueFilters],
  );

  const handleClearFilters = useCallback(() => {
    setQueueFilters({
      riskLevel: undefined,
      language: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      assignedToMe: undefined,
      sortBy: undefined,
      tags: undefined,
    });
    setSelectedTags([]);
  }, [setQueueFilters, setSelectedTags]);

  const handleAssignClick = (sessionId: string) => {
    setAssigningSessionId(sessionId);
    setAssignReviewerInput('');
  };

  const handleAssignSubmit = async () => {
    if (assigningSessionId && assignReviewerInput.trim()) {
      await assignSession(assigningSessionId, assignReviewerInput.trim());
      setAssigningSessionId(null);
      setAssignReviewerInput('');
    }
  };

  const handleAssignCancel = () => {
    setAssigningSessionId(null);
    setAssignReviewerInput('');
  };

  const getCountForTab = (tab: QueueTab): number | null => {
    switch (tab) {
      case 'pending': return queueCounts.pending;
      case 'flagged': return queueCounts.flagged;
      case 'in_progress': return queueCounts.inProgress;
      case 'completed': return queueCounts.completed;
      case 'excluded': return null; // No pre-fetched count for excluded
      default: return 0;
    }
  };

  const hasActiveFilters = Boolean(
    queueFilters.riskLevel ||
    queueFilters.language ||
    queueFilters.dateFrom ||
    queueFilters.dateTo ||
    queueFilters.assignedToMe ||
    queueFilters.sortBy ||
    selectedTags.length > 0,
  );

  const totalPages = Math.ceil(queueTotal / PAGE_SIZE);
  const hasPrevious = queuePage > 1;
  const hasNext = queuePage < totalPages;

  // Loading skeleton
  const LoadingSkeleton = () => (
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
            <div className="flex gap-4">
              <div className="h-3 w-16 bg-neutral-200 rounded" />
              <div className="h-3 w-20 bg-neutral-200 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full bg-neutral-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-neutral-800">
            {t('review.queue.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t('review.queue.subtitle')}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="queue-scope-select" className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t('review.queue.scope.label')}
            </label>
            <select
              id="queue-scope-select"
              value={scopeMode}
              onChange={(e) => setScopeMode(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
            >
              <option value="all">{t('review.queue.scope.allSpaces')}</option>
              {groupsLoading
                ? <option disabled value="">{t('review.queue.scope.loadingSpaces')}</option>
                : allGroups.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))
              }
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`
            inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
            ${
              hasActiveFilters
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }
          `}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {t('review.queue.filters.toggle')}
          {hasActiveFilters && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs text-white">
              !
            </span>
          )}
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Collapsible Filter Panel */}
      {filtersOpen && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Risk Level */}
            <div>
              <label htmlFor="queue-filter-risk" className="mb-1 block text-xs font-medium text-neutral-600">
                {t('review.queue.filters.riskLevel')}
              </label>
              <select
                id="queue-filter-risk"
                value={queueFilters.riskLevel ?? ''}
                onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700
                  focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
              >
                <option value="">{t('review.queue.filters.allRiskLevels')}</option>
                <option value="high">{t('review.riskLevels.high')}</option>
                <option value="medium">{t('review.riskLevels.medium')}</option>
                <option value="low">{t('review.riskLevels.low')}</option>
                <option value="none">{t('review.riskLevels.none')}</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label htmlFor="queue-filter-language" className="mb-1 block text-xs font-medium text-neutral-600">
                {t('review.queue.filters.language')}
              </label>
              <select
                id="queue-filter-language"
                value={queueFilters.language ?? ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700
                  focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
              >
                <option value="">{t('review.queue.filters.allLanguages')}</option>
                <option value="en">{t('review.queue.filters.languageEn')}</option>
                <option value="uk">{t('review.queue.filters.languageUk')}</option>
                <option value="ru">{t('review.queue.filters.languageRu')}</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="queue-filter-dateFrom" className="mb-1 block text-xs font-medium text-neutral-600">
                {t('review.queue.filters.dateFrom')}
              </label>
              <input
                id="queue-filter-dateFrom"
                type="date"
                value={queueFilters.dateFrom ?? ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700
                  focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="queue-filter-dateTo" className="mb-1 block text-xs font-medium text-neutral-600">
                {t('review.queue.filters.dateTo')}
              </label>
              <input
                id="queue-filter-dateTo"
                type="date"
                value={queueFilters.dateTo ?? ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700
                  focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="queue-sort">
                {t('review.queue.filters.sortBy')}
              </label>
              <select
                id="queue-sort"
                value={queueFilters.sortBy ?? 'priority'}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                aria-label={t('review.queue.filters.sortBy')}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700
                  focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
              >
                <option value="priority">{t('review.queue.filters.sortPriority')}</option>
                <option value="oldest">{t('review.queue.filters.sortOldest')}</option>
                <option value="newest">{t('review.queue.filters.sortNewest')}</option>
              </select>
            </div>

            {/* Assigned to Me Toggle */}
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={queueFilters.assignedToMe ?? false}
                  onChange={(e) => handleFilterChange('assignedToMe', e.target.checked || undefined)}
                  className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-300"
                />
                <span className="text-neutral-700">{t('review.queue.filters.assignedToMe')}</span>
              </label>
            </div>

            {/* Tag Filter */}
            <TagFilter
              selectedTags={selectedTags}
              onChange={setSelectedTags}
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-medium text-sky-600 hover:text-sky-700 focus:outline-none"
              >
                {t('review.queue.filters.clearAll')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs with count badges */}
      <div className="border-b border-neutral-200">
        <div className="-mb-px flex space-x-1" role="tablist" aria-label={t('review.queue.tabsAriaLabel')}>
          {TABS.map(({ key, labelKey }) => {
            const count = getCountForTab(key);
            const isActive = key === 'excluded' ? showExcluded : (!showExcluded && queueTab === key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(key)}
                className={`
                  inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                  ${
                    isActive
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                  }
                `}
              >
                {t(labelKey)}
                {count !== null && (
                  <span
                    className={`
                      inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold
                      ${
                        isActive
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Excluded Tab Content */}
      {showExcluded && (
        <ExcludedTab
          page={queuePage}
          onPageChange={setQueuePage}
        />
      )}

      {/* Supervision Queue Tab */}
      {queueTab === 'supervision' && !showExcluded && (
        <SupervisorQueueTab />
      )}

      {/* Awaiting Feedback Tab */}
      {queueTab === 'awaiting' && !showExcluded && (
        <AwaitingFeedbackTab />
      )}

      {/* Normal Queue Content — hidden when excluded tab or special tabs are active */}
      {!showExcluded && queueTab !== 'supervision' && queueTab !== 'awaiting' && (
        <>

      {/* Assignment Modal */}
      {assigningSessionId && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-sm font-medium text-sky-800">
              {t('review.queue.assign.title')}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              value={assignReviewerInput}
              onChange={(e) => setAssignReviewerInput(e.target.value)}
              placeholder={t('review.queue.assign.placeholder')}
              className="flex-1 rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-neutral-700
                placeholder:text-neutral-400
                focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
            />
            <button
              type="button"
              onClick={handleAssignSubmit}
              disabled={!assignReviewerInput.trim()}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white
                transition-colors duration-150
                hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('review.queue.assign.confirm')}
            </button>
            <button
              type="button"
              onClick={handleAssignCancel}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700
                transition-colors duration-150
                hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2"
            >
              {t('review.queue.assign.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-600 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  {t('review.queue.error.title')}
                </h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="
                rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800
                transition-colors duration-150
                hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-300
              "
            >
              {t('review.queue.error.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {queueLoading && <LoadingSkeleton />}

      {/* Empty State */}
      {!queueLoading && !error && queue.length === 0 && (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-neutral-900">
            {t('review.queue.empty.title')}
          </h3>
          <p className="mt-2 text-sm text-neutral-500">
            {t('review.queue.empty.description')}
          </p>
        </div>
      )}

      {/* Session Cards Grid */}
      {!queueLoading && !error && queue.length > 0 && (
        <>
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            role="region"
            aria-label={t('review.queue.title')}
            aria-sort={
              (queueFilters.sortBy ?? 'priority') === 'oldest'
                ? 'ascending'
                : (queueFilters.sortBy ?? 'priority') === 'newest'
                  ? 'descending'
                  : 'other'
            }
          >
            {queue.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={handleSessionClick}
                onAssign={handleAssignClick}
                showAssign={canAssign}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
              <div className="flex flex-1 items-center justify-between sm:hidden">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={!hasPrevious}
                  className={`
                    rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium
                    transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-sky-300
                    ${
                      hasPrevious
                        ? 'text-neutral-700 hover:bg-neutral-50'
                        : 'cursor-not-allowed text-neutral-400'
                    }
                  `}
                >
                  {t('review.queue.pagination.previous')}
                </button>
                <span className="text-sm text-neutral-700">
                  {t('review.queue.pagination.pageInfo', {
                    current: queuePage,
                    total: totalPages,
                  })}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!hasNext}
                  className={`
                    rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium
                    transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-sky-300
                    ${
                      hasNext
                        ? 'text-neutral-700 hover:bg-neutral-50'
                        : 'cursor-not-allowed text-neutral-400'
                    }
                  `}
                >
                  {t('review.queue.pagination.next')}
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-neutral-700">
                    {t('review.queue.pagination.showing', {
                      start: (queuePage - 1) * PAGE_SIZE + 1,
                      end: Math.min(queuePage * PAGE_SIZE, queueTotal),
                      total: queueTotal,
                    })}
                  </p>
                </div>
                <div>
                  <nav
                    className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label={t('review.queue.pagination.ariaLabel')}
                  >
                    <button
                      type="button"
                      onClick={handlePreviousPage}
                      disabled={!hasPrevious}
                      className={`
                        relative inline-flex items-center rounded-l-md border border-neutral-300 bg-white px-3 py-2
                        text-sm font-medium transition-colors duration-150
                        focus:z-10 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                        ${
                          hasPrevious
                            ? 'text-neutral-700 hover:bg-neutral-50'
                            : 'cursor-not-allowed text-neutral-400'
                        }
                      `}
                    >
                      <span className="sr-only">{t('review.queue.pagination.previous')}</span>
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
                    </button>
                    <span
                      className="relative inline-flex items-center border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
                      aria-current="page"
                    >
                      {t('review.queue.pagination.pageInfo', {
                        current: queuePage,
                        total: totalPages,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!hasNext}
                      className={`
                        relative inline-flex items-center rounded-r-md border border-neutral-300 bg-white px-3 py-2
                        text-sm font-medium transition-colors duration-150
                        focus:z-10 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2
                        ${
                          hasNext
                            ? 'text-neutral-700 hover:bg-neutral-50'
                            : 'cursor-not-allowed text-neutral-400'
                        }
                      `}
                    >
                      <span className="sr-only">{t('review.queue.pagination.next')}</span>
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}

        </>
      )}
    </div>
  );
}
