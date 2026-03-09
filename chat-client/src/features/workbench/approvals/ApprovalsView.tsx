import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { adminApprovalsApi, type ApprovalRequestDto } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { Permission } from '../../../types';

export default function ApprovalsView() {
  const { t } = useTranslation();
  const { user, activeGroupId } = useAuthStore();
  const [items, setItems] = useState<ApprovalRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentByUserId, setCommentByUserId] = useState<Record<string, string>>({});
  const [selectedGroupByUserId, setSelectedGroupByUserId] = useState<Record<string, string>>({});

  const canManageAll = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!canManageAll && !activeGroupId) {
        setError(t('approvals.noGroup'));
        setItems([]);
        return;
      }
      const resp = await adminApprovalsApi.list(canManageAll ? undefined : activeGroupId || undefined);
      if (!resp.success || !resp.data) {
        setError(resp.error?.message || t('common.error'));
        setItems([]);
        return;
      }
      const data = resp.data;
      setItems(data);
      setSelectedGroupByUserId((prev) => {
        const next = { ...prev };
        for (const item of data) {
          if (!next[item.user.id] && item.pendingGroups?.[0]?.groupId) {
            next[item.user.id] = item.pendingGroups[0].groupId;
          }
        }
        return next;
      });
    } catch (e) {
      console.error('[Approvals] Failed to load:', e);
      setError(t('common.error'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canManageAll, activeGroupId]);

  const handleApprove = async (userId: string) => {
    const comment = commentByUserId[userId] || '';
    const groupId = selectedGroupByUserId[userId] || undefined;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminApprovalsApi.approve(userId, { comment, groupId });
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await load();
    } catch (e) {
      console.error('[Approvals] Approve failed:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisapprove = async (userId: string) => {
    const comment = (commentByUserId[userId] || '').trim();
    const groupId = selectedGroupByUserId[userId] || undefined;
    if (!comment) {
      setError(t('approvals.commentRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await adminApprovalsApi.disapprove(userId, { comment, groupId });
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await load();
    } catch (e) {
      console.error('[Approvals] Disapprove failed:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{t('approvals.title')}</h1>
          <p className="text-neutral-500 mt-1">{t('approvals.subtitle')}</p>
        </div>
        <button onClick={() => void load()} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('approvals.refresh')}
        </button>
      </div>

      {error && <div className="card p-3 mb-4 text-sm text-red-700 bg-red-50">{error}</div>}
      {loading ? (
        <div className="card p-6 text-center text-neutral-500">{t('common.loading')}</div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && <div className="card p-6 text-neutral-500">{t('approvals.empty')}</div>}
          {items.map((item) => {
            const pendingGroups = item.pendingGroups || [];
            const selectedGroupId =
              selectedGroupByUserId[item.user.id] || pendingGroups[0]?.groupId || '';
            return (
              <div key={item.user.id} className="card p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="font-semibold text-neutral-800">{item.user.displayName}</div>
                    <div className="text-sm text-neutral-500">{item.user.email}</div>
                  </div>
                  {pendingGroups.length > 0 && (
                    <select
                      className="input w-56"
                      value={selectedGroupId}
                      onChange={(e) =>
                        setSelectedGroupByUserId((prev) => ({ ...prev, [item.user.id]: e.target.value }))
                      }
                    >
                      {pendingGroups.map((group) => (
                        <option key={group.groupId} value={group.groupId}>
                          {group.groupName || group.groupId}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-xs text-neutral-500 mb-1">{t('approvals.commentLabel')}</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={commentByUserId[item.user.id] || ''}
                    onChange={(e) =>
                      setCommentByUserId((prev) => ({ ...prev, [item.user.id]: e.target.value }))
                    }
                    placeholder={t('approvals.commentPlaceholder')}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 justify-end">
                  <button className="btn-ghost text-error" onClick={() => void handleDisapprove(item.user.id)}>
                    <XCircle className="w-4 h-4 mr-1" />
                    {t('approvals.disapprove')}
                  </button>
                  <button className="btn-primary" onClick={() => void handleApprove(item.user.id)}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('approvals.approve')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

