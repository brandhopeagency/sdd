import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Trash2, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { groupAdminApi } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import type { User } from '../../../types';

export default function GroupUsersView() {
  const { t } = useTranslation();
  const { user, activeGroupId } = useAuthStore();

  const canEditMembership = !!activeGroupId && (user?.groupRole === 'admin' || user?.role === 'owner');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<
    { userId: string; email: string; displayName: string; requestedAt: string; source: string }[]
  >([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, hasMore: false });

  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        if (!activeGroupId) {
          setError(t('group.users.noGroup'));
          setUsers([]);
          return;
        }
        const resp = await groupAdminApi.listUsers(activeGroupId, {
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          sortBy: 'created_at',
          sortOrder: 'desc'
        });
        if (!resp.success || !resp.data) {
          setError(resp.error?.message || t('common.error'));
          setUsers([]);
          return;
        }
        setUsers(resp.data);
        setPagination({
          page: resp.meta?.page || page,
          limit: resp.meta?.limit || pageSize,
          total: resp.meta?.total || resp.data.length,
          hasMore: resp.meta?.hasMore || false
        });
      } catch (e) {
        console.error('[GroupUsers] Failed to load:', e);
        setError(t('common.error'));
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [activeGroupId, debouncedSearch, page, pageSize, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canEditMembership) return;
    let mounted = true;
    void (async () => {
      setRequestsLoading(true);
      try {
        const resp = await groupAdminApi.listRequests(activeGroupId);
        if (!mounted) return;
        if (!resp.success || !resp.data) {
          setRequests([]);
          return;
        }
        setRequests(resp.data);
      } finally {
        if (mounted) setRequestsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canEditMembership]);

  const total = pagination.total ?? 0;
  const limit = pagination.limit ?? pageSize;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : (page - 1) * limit + users.length;

  const onAdd = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      if (!activeGroupId) {
        setError(t('group.users.noGroup'));
        return;
      }
      const resp = await groupAdminApi.addUser(activeGroupId, { email: addEmail.trim() });
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      setAddEmail('');
      await load();
    } catch (e) {
      console.error('[GroupUsers] Failed to add:', e);
      setError(t('common.error'));
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (userId: string) => {
    setError(null);
    try {
      if (!activeGroupId) {
        setError(t('group.users.noGroup'));
        return;
      }
      const resp = await groupAdminApi.removeUser(activeGroupId, userId);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await load();
    } catch (e) {
      console.error('[GroupUsers] Failed to remove:', e);
      setError(t('common.error'));
    }
  };

  const onGenerateInvite = async () => {
    setError(null);
    setInviteCopied(false);
    try {
      if (!activeGroupId) return;
      const resp = await groupAdminApi.createInvite(activeGroupId);
      if (!resp.success || !resp.data) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      setInviteCode(resp.data.code);
    } catch (e) {
      console.error('[GroupUsers] Failed to generate invite:', e);
      setError(t('common.error'));
    }
  };

  const onCopyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const refreshRequests = async () => {
    if (!canEditMembership) return;
    setRequestsLoading(true);
    try {
      if (!activeGroupId) return;
      const resp = await groupAdminApi.listRequests(activeGroupId);
      if (resp.success && resp.data) setRequests(resp.data);
    } finally {
      setRequestsLoading(false);
    }
  };

  const onApprove = async (userId: string) => {
    setError(null);
    try {
      if (!activeGroupId) return;
      const resp = await groupAdminApi.approveRequest(activeGroupId, userId);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await refreshRequests();
      await load();
    } catch (e) {
      console.error('[GroupUsers] Failed to approve:', e);
      setError(t('common.error'));
    }
  };

  const onReject = async (userId: string) => {
    setError(null);
    try {
      if (!activeGroupId) return;
      const resp = await groupAdminApi.rejectRequest(activeGroupId, userId);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await refreshRequests();
    } catch (e) {
      console.error('[GroupUsers] Failed to reject:', e);
      setError(t('common.error'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{t('group.users.title')}</h1>
          <p className="text-neutral-500 mt-1">{t('group.users.subtitle')}</p>
        </div>
      </div>

      {canEditMembership && (
        <div className="card p-4 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-800">{t('group.users.invites.title')}</h2>
                <p className="text-sm text-neutral-500">{t('group.users.invites.subtitle')}</p>
              </div>
              <button className="btn-secondary" onClick={() => void onGenerateInvite()}>
                {t('group.users.invites.generate')}
              </button>
            </div>

            {inviteCode && (
              <div className="flex items-center justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
                <div className="font-mono text-sm text-neutral-800 break-all">{inviteCode}</div>
                <button className="btn-ghost flex items-center gap-2" onClick={() => void onCopyInvite()}>
                  {inviteCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {inviteCopied ? t('group.users.invites.copied') : t('group.users.invites.copy')}
                </button>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-4">
              <h2 className="font-semibold text-neutral-800">{t('group.users.requests.title')}</h2>
              <p className="text-sm text-neutral-500">{t('group.users.requests.subtitle')}</p>
              {requestsLoading ? (
                <div className="mt-3 text-sm text-neutral-500">{t('common.loading')}</div>
              ) : requests.length === 0 ? (
                <div className="mt-3 text-sm text-neutral-500">{t('group.users.requests.empty')}</div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border border-neutral-200">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                          {t('users.table.email')}
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                          {t('users.table.name')}
                        </th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                          {t('users.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {requests.map((r) => (
                        <tr key={r.userId}>
                          <td className="px-4 py-3 text-sm text-neutral-700">{r.email}</td>
                          <td className="px-4 py-3 text-sm text-neutral-700">{r.displayName}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button className="btn-secondary" onClick={() => void onApprove(r.userId)}>
                                {t('group.users.requests.approve')}
                              </button>
                              <button className="btn-ghost text-error" onClick={() => void onReject(r.userId)}>
                                {t('group.users.requests.reject')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canEditMembership && (
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">{t('group.users.addByEmail')}</label>
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
                className="input"
              />
            </div>
            <button
              className="btn-primary flex items-center gap-2 md:self-end"
              onClick={() => void onAdd()}
              disabled={adding || !addEmail.trim()}
            >
              <UserPlus className="w-5 h-5" />
              {t('group.users.add')}
            </button>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('group.users.search')}
              className="input pl-10"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="input w-28"
            aria-label={t('users.pageSize.ariaLabel')}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {error && !loading && (
          <div className="p-4 border-b border-neutral-100 bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center text-neutral-500">{t('common.loading')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.name')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.email')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.role')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.status')}
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-neutral-500" colSpan={5}>
                        {t('users.empty')}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-neutral-900">{u.displayName}</span>
                        </td>
                        <td className="px-6 py-4 text-neutral-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="badge badge-info">{t(`roles.${u.role}`)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="badge bg-neutral-100 text-neutral-600">{t(`users.filters.${u.status}`)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canEditMembership ? (
                            <button
                              className="btn-ghost text-sm text-error"
                              onClick={() => void onRemove(u.id)}
                              title={t('group.users.remove')}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {t('group.users.remove')}
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-400">{t('group.users.readOnly')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                {t('users.pagination.showing')} {showingFrom}-{showingTo} {t('users.pagination.of')} {total}{' '}
                {t('users.pagination.users')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="btn-ghost p-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-neutral-600">
                  {t('users.pagination.page')} {page} {t('users.pagination.of')} {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasMore || loading}
                  className="btn-ghost p-2"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

