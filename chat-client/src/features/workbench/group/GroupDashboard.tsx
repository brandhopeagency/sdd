import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import { groupAdminApi } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';

export default function GroupDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, activeGroupId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [stats, setStats] = useState<{
    usersTotal: number;
    usersActive: number;
    usersBlocked: number;
    sessionsTotal: number;
    sessionsActive: number;
    sessionsPending: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!activeGroupId) {
          setError(t('group.dashboard.noGroup'));
          setStats(null);
          setGroupName('');
          return;
        }
        const resp = await groupAdminApi.dashboard(activeGroupId);
        if (!mounted) return;
        if (!resp.success || !resp.data) {
          setError(resp.error?.message || t('common.error'));
          setStats(null);
          setGroupName('');
          return;
        }

        const { group, stats } = resp.data;
        setGroupName(group?.name || t('group.dashboard.unknownGroup'));
        setStats({
          usersTotal: stats.userCounts.total,
          usersActive: stats.userCounts.active,
          usersBlocked: stats.userCounts.blocked,
          sessionsTotal: stats.sessionCounts.total,
          sessionsActive: stats.sessionCounts.active,
          sessionsPending: stats.sessionCounts.moderation.pending
        });
      } catch (e) {
        console.error('[GroupDashboard] Failed to load:', e);
        if (!mounted) return;
        setError(t('common.error'));
        setStats(null);
        setGroupName('');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeGroupId, t]);

  const displayName = useMemo(() => user?.displayName || '', [user?.displayName]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-800">{t('group.dashboard.title')}</h1>
        <p className="text-neutral-500 mt-1">
          {t('group.dashboard.welcome')}, {displayName} • {t('group.dashboard.groupLabel')}: {groupName}
        </p>
      </div>

      {error && !loading && (
        <div className="mb-6 card p-4 bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-neutral-500">{t('common.loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/workbench/group/users')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('group.dashboard.stats.groupUsers')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{stats?.usersTotal ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary-600" />
                </div>
              </div>
              <div className="mt-3 text-sm text-neutral-500">
                {t('group.dashboard.stats.activeUsers')}: <span className="text-neutral-700 font-medium">{stats?.usersActive ?? 0}</span>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('group.dashboard.stats.blockedUsers')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{stats?.usersBlocked ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-error" />
                </div>
              </div>
            </div>

            <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/workbench/group/sessions')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('group.dashboard.stats.sessionsTotal')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{stats?.sessionsTotal ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <div className="mt-3 text-sm text-neutral-500">
                {t('group.dashboard.stats.activeSessions')}: <span className="text-neutral-700 font-medium">{stats?.sessionsActive ?? 0}</span>
              </div>
            </div>

            <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/workbench/group/sessions?status=pending')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{t('group.dashboard.stats.pendingReview')}</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{stats?.sessionsPending ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">{t('group.dashboard.quickActions.title')}</h2>
              <p className="text-sm text-neutral-500 mb-4">{t('group.dashboard.quickActions.subtitle')}</p>
              <div className="flex flex-col gap-3">
                <button className="btn-primary" onClick={() => navigate('/workbench/group/users')}>
                  {t('group.dashboard.quickActions.manageUsers')}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/workbench/group/sessions')}>
                  {t('group.dashboard.quickActions.viewChats')}
                </button>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">{t('group.dashboard.security.title')}</h2>
              <p className="text-sm text-neutral-500">
                {t('group.dashboard.security.notice')}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

