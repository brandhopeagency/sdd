import { KeyboardEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import { usersApi, sessionsAdminApi, adminApprovalsApi } from '@/services/adminApi';
import { Permission } from '@mentalhelpglobal/chat-types';
import { maskEmail, maskName } from '@mentalhelpglobal/chat-frontend-common';
import { Users, MessageSquare, Clock, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { users, sessions, fetchUsers, fetchSessions, piiMasked } = useWorkbenchStore();
  const displayName = user?.displayName ? (piiMasked ? maskName(user.displayName) : user.displayName) : '';

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT);
  const canResearch = user?.permissions.includes(Permission.WORKBENCH_RESEARCH);

  const [usersStats, setUsersStats] = useState<{
    total: number;
    byStatus: Record<string, number>;
    byRole: Record<string, number>;
  } | null>(null);
  const [sessionsStats, setSessionsStats] = useState<{
    total: number;
    byStatus: { active: number; ended: number; expired: number };
    byModerationStatus: { pending: number; in_review: number; moderated: number };
  } | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers({ page: 1, limit: 5 });
    }
    if (canResearch) {
      fetchSessions({ page: 1, limit: 5 });
    }
  }, [canManageUsers, canResearch, fetchUsers, fetchSessions]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (canManageUsers) {
        const [usersResp, approvalsResp] = await Promise.all([
          usersApi.getStats(),
          adminApprovalsApi.list()
        ]);
        if (mounted) {
          setUsersStats(usersResp.success ? usersResp.data ?? null : null);
          setPendingApprovals(approvalsResp.success ? approvalsResp.data?.length ?? 0 : null);
        }
      } else if (mounted) {
        setUsersStats(null);
        setPendingApprovals(null);
      }

      if (canResearch) {
        const resp = await sessionsAdminApi.getStats();
        if (mounted) setSessionsStats(resp.success ? resp.data ?? null : null);
      } else if (mounted) {
        setSessionsStats(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canManageUsers, canResearch]);

  const activeUsers = usersStats?.byStatus?.active ?? users.filter(u => u.status === 'active').length;
  const blockedUsers = usersStats?.byStatus?.blocked ?? users.filter(u => u.status === 'blocked').length;
  const pendingSessions =
    sessionsStats?.byModerationStatus?.pending ?? sessions.filter(s => s.moderationStatus === 'pending').length;
  const activeSessions = sessionsStats?.byStatus?.active ?? sessions.filter(s => s.status === 'active').length;

  const moderatedCount =
    sessionsStats?.byModerationStatus?.moderated ?? sessions.filter(s => s.moderationStatus === 'moderated').length;
  const sessionsTotal = sessionsStats?.total ?? sessions.length;
  const onCardKeyDown = (path: string) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    navigate(path);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-800">{t('dashboard.title')}</h1>
        <p className="text-neutral-500 mt-1">{t('dashboard.welcome')}, {displayName}</p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 ${
        canManageUsers && canResearch ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      }`}>
        {canManageUsers && (
          <>
            <div 
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/workbench/users')}
              role="button"
              tabIndex={0}
              onKeyDown={onCardKeyDown('/workbench/users')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('dashboard.stats.activeUsers')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{activeUsers}</p>
                </div>
                <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-secondary-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>{t('dashboard.stats.thisWeek')}</span>
              </div>
            </div>

            <div 
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/workbench/approvals')}
              role="button"
              tabIndex={0}
              onKeyDown={onCardKeyDown('/workbench/approvals')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('dashboard.stats.pendingApprovals')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingApprovals ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-neutral-500">
                <span>{t('dashboard.stats.awaitingApproval')}</span>
              </div>
            </div>

            <div 
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/workbench/users?status=blocked')}
              role="button"
              tabIndex={0}
              onKeyDown={onCardKeyDown('/workbench/users?status=blocked')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('dashboard.stats.blockedUsers')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{blockedUsers}</p>
                </div>
                <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-error" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-neutral-500">
                <span>{t('dashboard.stats.requiresAttention')}</span>
              </div>
            </div>
          </>
        )}

        {canResearch && (
          <>
            <div 
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/workbench/research?status=pending')}
              role="button"
              tabIndex={0}
              onKeyDown={onCardKeyDown('/workbench/research?status=pending')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('dashboard.stats.pendingReview')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingSessions}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-amber-600">
                <span>{t('dashboard.stats.awaitingModeration')}</span>
              </div>
            </div>

            <div 
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/workbench/research')}
              role="button"
              tabIndex={0}
              onKeyDown={onCardKeyDown('/workbench/research')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('dashboard.stats.activeSessions')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{activeSessions}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-primary-600">
                <span>{t('dashboard.stats.inProgress')}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canResearch && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('dashboard.recentSessions')}</h2>
            <div className="space-y-3">
              {sessions.slice(0, 5).map(session => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/workbench/research/session/${session.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={onCardKeyDown(`/workbench/research/session/${session.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      session.moderationStatus === 'moderated' ? 'bg-secondary-500' :
                      session.moderationStatus === 'in_review' ? 'bg-amber-500' :
                      'bg-neutral-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-neutral-700">
                        Session {session.id.slice(-6)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {session.messageCount} {t('dashboard.messages')} • {new Date(session.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${
                    session.moderationStatus === 'moderated' ? 'badge-success' :
                    session.moderationStatus === 'in_review' ? 'badge-warning' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {session.moderationStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageUsers && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('dashboard.recentUsers')}</h2>
            <div className="space-y-3">
              {users.slice(0, 5).map(u => (
                <div 
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/workbench/users/${u.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={onCardKeyDown(`/workbench/users/${u.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      u.status === 'active' ? 'bg-secondary-100' :
                      u.status === 'blocked' ? 'bg-error/10' :
                      'bg-neutral-100'
                    }`}>
                      <Users className={`w-4 h-4 ${
                        u.status === 'active' ? 'text-secondary-600' :
                        u.status === 'blocked' ? 'text-error' :
                        'text-neutral-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-700">
                        <span title={piiMasked ? maskName(u.displayName) : u.displayName}>
                          {piiMasked ? maskName(u.displayName) : u.displayName}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500">
                        {piiMasked ? maskEmail(u.email) : u.email}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${
                    u.status === 'active' ? 'badge-success' :
                    u.status === 'blocked' ? 'badge-error' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {u.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Completion Stats */}
      <div className="mt-6 card p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('dashboard.moderationProgress')}</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-secondary-500 to-secondary-400"
              style={{ 
                width: `${sessionsTotal ? (moderatedCount / sessionsTotal) * 100 : 0}%` 
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <CheckCircle className="w-4 h-4 text-secondary-500" />
            <span>
              {moderatedCount} / {sessionsTotal} {t('dashboard.reviewed')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
