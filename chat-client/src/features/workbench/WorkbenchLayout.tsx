import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useWorkbenchStore } from '../../stores/workbenchStore';
import { Permission } from '../../types';
import { adminAuditApi, adminGroupsApi, groupAdminApi } from '../../services/api';
import { maskName } from '../../utils/piiMasking';
import {
  Heart,
  LayoutDashboard,
  Users,
  Microscope,
  Shield,
  Settings,
  LogOut,
  MessageCircle,
  Eye,
  EyeOff,
  ChevronDown,
  User,
  CheckCircle
} from 'lucide-react';
import LanguageSelector from '../../components/LanguageSelector';

interface NavItemConfig {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  permission?: Permission;
  anyPermissions?: Permission[];
}

const navItems: NavItemConfig[] = [
  { 
    path: '/workbench', 
    labelKey: 'workbench.nav.dashboard', 
    icon: <LayoutDashboard className="w-5 h-5" /> 
  },
  {
    path: '/workbench/group',
    labelKey: 'workbench.nav.groupDashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    permission: Permission.WORKBENCH_GROUP_DASHBOARD
  },
  {
    path: '/workbench/group/users',
    labelKey: 'workbench.nav.groupUsers',
    icon: <Users className="w-5 h-5" />,
    permission: Permission.WORKBENCH_GROUP_USERS
  },
  {
    path: '/workbench/group/sessions',
    labelKey: 'workbench.nav.groupChats',
    icon: <Microscope className="w-5 h-5" />,
    permission: Permission.WORKBENCH_GROUP_RESEARCH
  },
  { 
    path: '/workbench/users', 
    labelKey: 'workbench.nav.users', 
    icon: <Users className="w-5 h-5" />,
    permission: Permission.WORKBENCH_USER_MANAGEMENT
  },
  {
    path: '/workbench/groups',
    labelKey: 'workbench.nav.groups',
    icon: <Users className="w-5 h-5" />,
    permission: Permission.WORKBENCH_USER_MANAGEMENT
  },
  {
    path: '/workbench/approvals',
    labelKey: 'workbench.nav.approvals',
    icon: <CheckCircle className="w-5 h-5" />,
    anyPermissions: [Permission.WORKBENCH_USER_MANAGEMENT, Permission.WORKBENCH_GROUP_USERS]
  },
  { 
    path: '/workbench/research', 
    labelKey: 'workbench.nav.research', 
    icon: <Microscope className="w-5 h-5" />,
    permission: Permission.WORKBENCH_RESEARCH
  },
  { 
    path: '/workbench/privacy', 
    labelKey: 'workbench.nav.privacy', 
    icon: <Shield className="w-5 h-5" />,
    permission: Permission.WORKBENCH_PRIVACY
  },
  { 
    path: '/workbench/settings', 
    labelKey: 'workbench.nav.settings', 
    icon: <Settings className="w-5 h-5" /> 
  },
];

export default function WorkbenchLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout, activeGroupId, setActiveGroupId, initializeAuth } = useAuthStore();
  const { piiMasked, togglePIIMask, setPIIMasked } = useWorkbenchStore();
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [managedGroups, setManagedGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingManagedGroups, setLoadingManagedGroups] = useState(false);

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
  const canViewPii = user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;
  const displayName = user?.displayName ? (piiMasked ? maskName(user.displayName) : user.displayName) : '';

  const resolvedGroupId = canManageUsers ? activeGroupId : activeGroupId ?? user?.activeGroupId ?? user?.groupId ?? null;
  const activeMemberships = useMemo(
    () => (user?.memberships || []).filter((m) => m.status === 'active'),
    [user?.memberships]
  );
  const adminMemberships = useMemo(
    () => activeMemberships.filter((m) => m.role === 'admin'),
    [activeMemberships]
  );
  const hasGroupMembership = activeMemberships.length > 0;
  const isGlobalScope = canManageUsers && !resolvedGroupId;

  const selectableGroups = useMemo(() => {
    if (canManageUsers) {
      return [{ id: 'global', name: t('workbench.scopeSelector.global') }, ...managedGroups.map((g) => ({ id: g.id, name: g.name }))];
    }
    return activeMemberships.map((m) => ({ id: m.groupId, name: m.groupName }));
  }, [canManageUsers, managedGroups, activeMemberships, t]);

  const scopeSelectorValue = canManageUsers ? resolvedGroupId ?? 'global' : resolvedGroupId ?? '';
  const shouldShowGroupSelector =
    canManageUsers || adminMemberships.length > 1 || activeMemberships.length > 1;

  // If user lacks permission, always force masked in UI state
  useEffect(() => {
    if (!canViewPii && !piiMasked) setPIIMasked(true);
  }, [canViewPii, piiMasked, setPIIMasked]);

  useEffect(() => {
    if (canManageUsers) {
      let mounted = true;
      void (async () => {
        setLoadingManagedGroups(true);
        try {
          const resp = await adminGroupsApi.list();
          if (!mounted) return;
          if (!resp.success || !resp.data) {
            setManagedGroups([]);
            return;
          }
          setManagedGroups(resp.data.map((g) => ({ id: g.id, name: g.name })));
        } catch (e) {
          console.error('[WorkbenchLayout] Failed to load managed groups:', e);
          if (mounted) setManagedGroups([]);
        } finally {
          if (mounted) setLoadingManagedGroups(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, [canManageUsers]);

  useEffect(() => {
    const memberships = user?.memberships || [];
    if (canManageUsers) {
      if (!resolvedGroupId) return;
      if (managedGroups.length === 0) return;
      if (managedGroups.some((g) => g.id === resolvedGroupId)) return;
      const nextGroupId = managedGroups[0].id;
      setActiveGroupId(nextGroupId);
      void groupAdminApi.setActiveGroup(nextGroupId).catch(() => {
        // Best-effort: keep local selection even if backend rejects it.
      });
      return;
    }
    if (memberships.length === 0) return;
    if (resolvedGroupId && memberships.some((m) => m.groupId === resolvedGroupId)) return;
    setActiveGroupId(memberships[0].groupId);
  }, [canManageUsers, managedGroups, resolvedGroupId, setActiveGroupId, user?.memberships]);

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission && !item.anyPermissions) return true;
    if (item.permission) return user?.permissions.includes(item.permission);
    if (item.anyPermissions) return item.anyPermissions.some((perm) => user?.permissions.includes(perm));
    return false;
  }).filter((item) => {
    const isGroupItem = item.path.startsWith('/workbench/group');
    if (canManageUsers) {
      return !isGlobalScope || !isGroupItem;
    }
    if (hasGroupMembership) return true;
    return !isGroupItem && item.path !== '/workbench/approvals';
  });

  const groupNavItems = visibleNavItems.filter((item) => item.path.startsWith('/workbench/group'));
  const mainNavItems = visibleNavItems.filter((item) => !item.path.startsWith('/workbench/group'));

  const isActive = (path: string) => {
    if (path === '/workbench') {
      return location.pathname === '/workbench';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen flex bg-neutral-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-500 rounded-xl flex items-center justify-center shadow-soft">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-neutral-800">{t('workbench.title')}</h1>
              <p className="text-xs text-neutral-500">{t('workbench.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-3">
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  isActive(item.path)
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                {item.icon}
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
          {groupNavItems.length > 0 && (
            <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 p-2">
              <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                {t('workbench.nav.groupSection')}
              </p>
              <div className="space-y-1">
                {groupNavItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-neutral-600 hover:bg-white hover:text-neutral-900'
                    }`}
                  >
                    {item.icon}
                    <span>{t(item.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Back to chat */}
        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={() => navigate('/chat')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t('workbench.nav.backToChat')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
          {/* PII Toggle */}
          {canViewPii ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (piiMasked) {
                    void adminAuditApi.logPiiReveal({
                      context: 'workbench',
                      path: location.pathname,
                      visible: true
                    });
                  }
                  togglePIIMask();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  piiMasked
                    ? 'bg-secondary-100 text-secondary-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {piiMasked ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {t('workbench.pii.label')} {piiMasked ? t('workbench.pii.masked') : t('workbench.pii.visible')}
                </span>
              </button>
              {piiMasked && (
                <span className="text-xs text-neutral-500">
                  {t('workbench.pii.safeForSharing')}
                </span>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <LanguageSelector variant="dropdown" className="w-40" />

            {/* Group/global scope selector */}
            {shouldShowGroupSelector && (
              <div className="flex items-center gap-2">
                <label
                  className="text-xs text-neutral-500"
                  htmlFor="workbench-scope-selector"
                >
                  {t('workbench.scopeSelector.label')}
                </label>
                <select
                  id="workbench-scope-selector"
                  className="input h-10 w-56"
                  value={scopeSelectorValue}
                  disabled={switchingGroup || loadingManagedGroups}
                  onChange={async (e) => {
                    const nextGroupId = e.target.value;
                    if (!nextGroupId || nextGroupId === scopeSelectorValue) return;
                    setSwitchingGroup(true);
                    try {
                      if (canManageUsers && nextGroupId === 'global') {
                        setActiveGroupId(null);
                        navigate('/workbench');
                        return;
                      }
                      await groupAdminApi.setActiveGroup(nextGroupId);
                      setActiveGroupId(nextGroupId);
                      await initializeAuth(); // re-fetch /me to update memberships + permissions
                      navigate('/workbench/group');
                    } finally {
                      setSwitchingGroup(false);
                    }
                  }}
                  aria-label={t('workbench.scopeSelector.ariaLabel')}
                >
                  {selectableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* User menu */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-neutral-700">{displayName}</p>
                <p className="text-xs text-neutral-500">{t(`roles.${user?.role}`)}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="p-2 text-neutral-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
              title={t('common.signOut')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
