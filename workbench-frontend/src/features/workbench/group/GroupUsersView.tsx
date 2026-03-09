import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Trash2, ChevronLeft, ChevronRight, Copy, Check, AlertCircle } from 'lucide-react';
import { groupAdminApi } from '@/services/adminApi';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import type { User } from '@mentalhelpglobal/chat-types';

type EmailCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; userId: string; displayName: string }
  | { status: 'not_found' };

export default function GroupUsersView() {
  const { t } = useTranslation();
  const { user, activeGroupId } = useAuthStore();
  const resolvedGroupId = activeGroupId ?? user?.activeGroupId ?? null;

  const canEditMembership = !!resolvedGroupId && (user?.groupRole === 'admin' || user?.role === 'owner');

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
  const [emailCheck, setEmailCheck] = useState<EmailCheckState>({ status: 'idle' });
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

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
        if (!resolvedGroupId) {
          setError(t('group.users.noGroup'));
          setUsers([]);
          return;
        }
        const resp = await groupAdminApi.listUsers(resolvedGroupId, {
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
    [resolvedGroupId, debouncedSearch, page, pageSize, t]
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
        const resp = await groupAdminApi.listRequests(resolvedGroupId);
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
  }, [canEditMembership, resolvedGroupId]);

  const total = pagination.total ?? 0;
  const limit = pagination.limit ?? pageSize;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : (page - 1) * limit + users.length;

  const onCheckEmail = async () => {
    const email = addEmail.trim();
    if (!email || !resolvedGroupId) return;
    setEmailCheck({ status: 'checking' });
    setError(null);
    try {
      const resp = await groupAdminApi.checkEmail(resolvedGroupId, email);
      if (!resp.success || !resp.data) {
        setEmailCheck({ status: 'idle' });
        setError(resp.error?.message || t('common.error'));
        return;
      }
      if (resp.data.exists && resp.data.userId) {
        setEmailCheck({ status: 'found', userId: resp.data.userId, displayName: resp.data.displayName || '' });
      } else {
        setEmailCheck({ status: 'not_found' });
        setNewUserName('');
        setNewUserRole('user');
      }
    } catch (e) {
      console.error('[GroupUsers] Email check failed:', e);
      setEmailCheck({ status: 'idle' });
      setError(t('common.error'));
    }
  };

  const onAdd = async () => {
    if (!addEmail.trim() || !resolvedGroupId) return;
    setAdding(true);
    setError(null);
    try {
      if (emailCheck.status === 'found') {
        const resp = await groupAdminApi.addUser(resolvedGroupId, { userId: emailCheck.userId });
        if (!resp.success) {
          setError(resp.error?.message || t('common.error'));
          return;
        }
      } else if (emailCheck.status === 'not_found') {
        if (!newUserName.trim()) {
          setError(t('groupUserCreation.nameRequired'));
          return;
        }
        const resp = await groupAdminApi.addUser(resolvedGroupId, {
          email: addEmail.trim(),
          displayName: newUserName.trim(),
          role: newUserRole,
          createNew: true
        });
        if (!resp.success) {
          setError(resp.error?.message || t('common.error'));
          return;
        }
      } else {
        const resp = await groupAdminApi.addUser(resolvedGroupId, { email: addEmail.trim() });
        if (!resp.success) {
          setError(resp.error?.message || t('common.error'));
          return;
        }
      }
      setAddEmail('');
      setEmailCheck({ status: 'idle' });
      setNewUserName('');
      setNewUserRole('user');
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
      if (!resolvedGroupId) {
        setError(t('group.users.noGroup'));
        return;
      }
      const resp = await groupAdminApi.removeUser(resolvedGroupId, userId);
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
      if (!resolvedGroupId) return;
      const resp = await groupAdminApi.createInvite(resolvedGroupId);
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
      if (!resolvedGroupId) return;
      const resp = await groupAdminApi.listRequests(resolvedGroupId);
      if (resp.success && resp.data) setRequests(resp.data);
    } finally {
      setRequestsLoading(false);
    }
  };

  const onApprove = async (userId: string) => {
    setError(null);
    try {
      if (!resolvedGroupId) return;
      const resp = await groupAdminApi.approveRequest(resolvedGroupId, userId);
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
      if (!resolvedGroupId) return;
      const resp = await groupAdminApi.rejectRequest(resolvedGroupId, userId);
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">{t('group.users.addByEmail')}</label>
                <input
                  value={addEmail}
                  onChange={(e) => { setAddEmail(e.target.value); setEmailCheck({ status: 'idle' }); }}
                  placeholder="user@example.com"
                  className="input"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onCheckEmail(); } }}
                />
              </div>
              {emailCheck.status === 'idle' || emailCheck.status === 'checking' ? (
                <button
                  className="btn-secondary flex items-center gap-2"
                  onClick={() => void onCheckEmail()}
                  disabled={emailCheck.status === 'checking' || !addEmail.trim()}
                >
                  <Search className="w-4 h-4" />
                  {emailCheck.status === 'checking' ? t('common.loading') : t('groupUserCreation.checkEmail')}
                </button>
              ) : (
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={() => void onAdd()}
                  disabled={adding || (emailCheck.status === 'not_found' && !newUserName.trim())}
                >
                  <UserPlus className="w-5 h-5" />
                  {t('group.users.add')}
                </button>
              )}
            </div>

            {emailCheck.status === 'found' && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  {t('groupUserCreation.userFound', { name: emailCheck.displayName || addEmail })}
                </p>
              </div>
            )}

            {emailCheck.status === 'not_found' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">{t('groupUserCreation.notFound')}</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-neutral-500 mb-1">{t('groupUserCreation.displayName')}</label>
                    <input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder={t('groupUserCreation.namePlaceholder')}
                      className="input"
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-xs text-neutral-500 mb-1">{t('groupUserCreation.role')}</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="input w-full"
                    >
                      <option value="user">{t('roles.user')}</option>
                      <option value="qa_specialist">{t('roles.qa_specialist')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
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

