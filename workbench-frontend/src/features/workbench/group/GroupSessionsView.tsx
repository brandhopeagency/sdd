import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, Clock, MessageSquare, ChevronRight } from 'lucide-react';
import { groupAdminApi } from '@/services/adminApi';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission, UserRole, type Session } from '@mentalhelpglobal/chat-types';

function toDate(value: any): Date {
  if (!value) return new Date(0);
  return value instanceof Date ? value : new Date(value);
}

function apiSessionToSession(apiSession: any): Session {
  const startedAt = toDate(apiSession.startedAt);
  const endedAt = apiSession.endedAt ? toDate(apiSession.endedAt) : null;
  const duration =
    endedAt
      ? endedAt.getTime() - startedAt.getTime()
      : apiSession.status === 'active'
        ? Date.now() - startedAt.getTime()
        : undefined;

  return {
    id: apiSession.id,
    userId: apiSession.userId ?? null,
    dialogflowSessionId: apiSession.dialogflowSessionId,
    status: apiSession.status,
    startedAt,
    endedAt,
    messageCount: apiSession.messageCount ?? 0,
    moderationStatus: apiSession.moderationStatus ?? 'pending',
    tags: Array.isArray(apiSession.tags) ? apiSession.tags : [],
    userName: undefined,
    duration,
    createdAt: toDate(apiSession.createdAt),
    updatedAt: toDate(apiSession.updatedAt)
  };
}

export default function GroupSessionsView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, activeGroupId } = useAuthStore();
  const resolvedGroupId = activeGroupId ?? user?.activeGroupId ?? null;

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
  const canAccessGroupModeration = user?.role === UserRole.OWNER || canManageUsers;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        if (!resolvedGroupId) {
          setError(t('group.sessions.noGroup'));
          setSessions([]);
          return;
        }
        const resp = await groupAdminApi.listSessions(resolvedGroupId, { limit: 200 });
        if (!resp.success || !resp.data) {
          setError(resp.error?.message || t('common.error'));
          setSessions([]);
          return;
        }
        setSessions(resp.data.map(apiSessionToSession));
      } catch (e) {
        console.error('[GroupSessions] Failed to load:', e);
        setError(t('common.error'));
        setSessions([]);
      } finally {
        setLoading(false);
      }
    },
    [resolvedGroupId, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.moderationStatus === statusFilter;
    let matchesDate = true;
    if (dateFrom) matchesDate = matchesDate && new Date(session.startedAt) >= new Date(dateFrom);
    if (dateTo) matchesDate = matchesDate && new Date(session.startedAt) <= new Date(dateTo);
    return matchesSearch && matchesStatus && matchesDate;
  });

  const formatDuration = (ms?: number) => {
    const capMs = 24 * 60 * 60 * 1000;
    const capped = typeof ms === 'number' && ms > capMs;
    if (ms === undefined || ms === null) return '-';
    if (capped) return '>24h';
    const minutes = Math.max(0, Math.floor(ms / 60000));
    return `${minutes} min`;
  };

  const getStatusBadge = (status: Session['moderationStatus']) => {
    switch (status) {
      case 'moderated':
        return <span className="badge-success">{t('research.filters.moderated')}</span>;
      case 'in_review':
        return <span className="badge-warning">{t('research.filters.inReview')}</span>;
      case 'pending':
      default:
        return <span className="bg-neutral-100 text-neutral-600 badge">{t('research.filters.pending')}</span>;
    }
  };

  if (!canAccessGroupModeration) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card p-8 text-center text-neutral-500">{t('common.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{t('group.sessions.title')}</h1>
          <p className="text-neutral-500 mt-1">{t('group.sessions.subtitle')}</p>
        </div>
      </div>

      {error && !loading && (
        <div className="mb-6 card p-4 bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('group.sessions.search')}
              className="input pl-10"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-40">
            <option value="all">{t('research.filters.allStatus')}</option>
            <option value="pending">{t('research.filters.pending')}</option>
            <option value="in_review">{t('research.filters.inReview')}</option>
            <option value="moderated">{t('research.filters.moderated')}</option>
          </select>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neutral-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input w-36" />
            <span className="text-neutral-400">-</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input w-36" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.loading')}</div>
        ) : filteredSessions.length === 0 ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.notFound')}</div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => navigate(`/workbench/group/sessions/${session.id}`)}
              className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      session.moderationStatus === 'moderated'
                        ? 'bg-secondary-500'
                        : session.moderationStatus === 'in_review'
                          ? 'bg-amber-500'
                          : 'bg-neutral-300'
                    }`}
                  />

                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-neutral-700">{session.id}</span>
                      {getStatusBadge(session.moderationStatus)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(session.startedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(session.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {session.messageCount} {t('research.session.messages')}
                      </span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

