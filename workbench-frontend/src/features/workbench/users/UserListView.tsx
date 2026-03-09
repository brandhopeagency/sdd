import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import type { User } from '@mentalhelpglobal/chat-types';
import { UserRole, Permission } from '@mentalhelpglobal/chat-types';
import { maskEmail, maskName } from '@mentalhelpglobal/chat-frontend-common';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, UserPlus } from 'lucide-react';
import CreateUserModal from './CreateUserModal';

type SortOption =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'display_name_asc'
  | 'email_asc'
  | 'last_login_at_desc'
  | 'session_count_desc';

export default function UserListView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { users, usersLoading, usersError, usersPagination, fetchUsers, piiMasked } = useWorkbenchStore();
  const { user: currentUser } = useAuthStore();
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [testUsersOnly, setTestUsersOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<SortOption>('created_at_desc');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canManageUsers = currentUser?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const sortParams = useMemo(() => {
    switch (sort) {
      case 'created_at_asc':
        return { sortBy: 'created_at', sortOrder: 'asc' as const };
      case 'display_name_asc':
        return { sortBy: 'display_name', sortOrder: 'asc' as const };
      case 'email_asc':
        return { sortBy: 'email', sortOrder: 'asc' as const };
      case 'last_login_at_desc':
        return { sortBy: 'last_login_at', sortOrder: 'desc' as const };
      case 'session_count_desc':
        return { sortBy: 'session_count', sortOrder: 'desc' as const };
      case 'created_at_desc':
      default:
        return { sortBy: 'created_at', sortOrder: 'desc' as const };
    }
  }, [sort]);

  useEffect(() => {
    fetchUsers({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      role: roleFilter,
      status: statusFilter,
      testUsersOnly,
      ...sortParams
    });
  }, [fetchUsers, page, pageSize, debouncedSearch, roleFilter, statusFilter, testUsersOnly, sortParams]);

  const total = usersPagination.total ?? 0;
  const limit = usersPagination.limit ?? pageSize;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : (page - 1) * limit + users.length;

  const displayUser = (user: User) => ({
    ...user,
    displayName: piiMasked ? maskName(user.displayName) : user.displayName,
    email: piiMasked ? maskEmail(user.email) : user.email,
  });

  const getStatusBadgeClass = (status: User['status']) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'blocked': return 'badge-error';
      case 'pending': return 'badge-warning';
      case 'approval': return 'badge-warning';
      case 'disapproved': return 'badge-error';
      case 'anonymized': return 'bg-neutral-100 text-neutral-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  const handleUserCreated = () => {
    setPage(1);
    fetchUsers({
      page: 1,
      limit: pageSize,
      search: search.trim() || undefined,
      role: roleFilter,
      status: statusFilter,
      testUsersOnly,
      ...sortParams
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">{t('users.title')}</h1>
          <p className="text-neutral-500 mt-1 text-sm">{t('users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {canManageUsers && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2 w-full sm:w-auto"
            >
              <UserPlus className="w-5 h-5" />
              {t('users.createUser.button')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder={t('users.search')}
              className="input pl-10"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-neutral-400 flex-shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as UserRole | 'all');
                setPage(1);
              }}
              className="input w-full md:w-40"
            >
              <option value="all">{t('users.filters.allRoles')}</option>
              {Object.values(UserRole).map(role => (
                <option key={role} value={role}>{t(`roles.${role}`)}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full md:w-40"
          >
            <option value="all">{t('users.filters.allStatus')}</option>
            <option value="active">{t('users.filters.active')}</option>
            <option value="blocked">{t('users.filters.blocked')}</option>
            <option value="pending">{t('users.filters.pending')}</option>
            <option value="approval">{t('users.filters.approval')}</option>
            <option value="disapproved">{t('users.filters.disapproved')}</option>
            <option value="anonymized">{t('users.filters.anonymized')}</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortOption);
              setPage(1);
            }}
            className="input w-full md:w-56"
            aria-label={t('users.sort.ariaLabel')}
          >
            <option value="created_at_desc">{t('users.sort.newest')}</option>
            <option value="created_at_asc">{t('users.sort.oldest')}</option>
            <option value="display_name_asc">{t('users.sort.nameAsc')}</option>
            <option value="email_asc">{t('users.sort.emailAsc')}</option>
            <option value="last_login_at_desc">{t('users.sort.lastActive')}</option>
            <option value="session_count_desc">{t('users.sort.mostSessions')}</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-neutral-700 select-none">
            <input
              type="checkbox"
              checked={testUsersOnly}
              onChange={(e) => {
                setTestUsersOnly(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            {t('users.filters.testUsersOnly')}
          </label>

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
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {usersError && !usersLoading && (
          <div className="p-4 border-b border-neutral-100 bg-red-50 text-red-700 text-sm">
            {usersError}
          </div>
        )}
        {usersLoading ? (
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
                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.lastActive')}
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('users.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-neutral-500" colSpan={6}>
                        {t('users.empty')}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const display = displayUser(user);
                      return (
                        <tr 
                          key={user.id} 
                          className="hover:bg-neutral-50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/workbench/users/${user.id}`)}
                        >
                          <td className="px-6 py-4">
                            <span
                              className="font-medium text-neutral-900"
                              title={piiMasked ? display.displayName : user.displayName}
                            >
                              {display.displayName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-600">
                            {display.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className="badge badge-info">
                              {t(`roles.${user.role}`)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`badge ${getStatusBadgeClass(user.status)}`}>
                                {t(`users.filters.${user.status}`)}
                              </span>
                              {(user as any).isTestUser && (
                                <span className="badge bg-primary-100 text-primary-700">
                                  {t('users.table.testUserBadge')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-neutral-500 text-sm">
                            {user.lastLoginAt 
                              ? new Date(user.lastLoginAt).toLocaleDateString() 
                              : t('users.table.never')
                            }
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/workbench/users/${user.id}`);
                              }}
                              className="btn-ghost text-sm"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              {t('users.table.view')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 sm:px-6 py-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-neutral-500">
                {t('users.pagination.showing')} {showingFrom}-{showingTo} {t('users.pagination.of')} {total} {t('users.pagination.users')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || usersLoading}
                  className="btn-ghost p-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-neutral-600">
                  {t('users.pagination.page')} {page} {t('users.pagination.of')} {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!usersPagination.hasMore || usersLoading}
                  className="btn-ghost p-2"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onSuccess={handleUserCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
