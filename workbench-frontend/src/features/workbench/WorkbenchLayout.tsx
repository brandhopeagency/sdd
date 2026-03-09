import { useEffect, useMemo, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, LanguageSelector } from '@mentalhelpglobal/chat-frontend-common';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import { Permission, UserRole } from '@mentalhelpglobal/chat-types';
import { adminAuditApi } from '@/services/adminApi';
import { CHAT_URL } from '@/config';
import { maskName } from '@mentalhelpglobal/chat-frontend-common';
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
  ChevronRight,
  User,
  CheckCircle,
  FileBarChart,
  Tag,
  Menu,
  X,
} from 'lucide-react';
import GroupScopeSelector from './components/GroupScopeSelector';
import InstallBanner from '@/components/InstallBanner';

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
    anyPermissions: [Permission.WORKBENCH_GROUP_RESEARCH, Permission.WORKBENCH_USER_MANAGEMENT]
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
    permission: Permission.WORKBENCH_USER_MANAGEMENT
  },
  { 
    path: '/workbench/review', 
    labelKey: 'workbench.nav.research', 
    icon: <Microscope className="w-5 h-5" />,
    permission: Permission.REVIEW_ACCESS
  },
  { 
    path: '/workbench/privacy', 
    labelKey: 'workbench.nav.privacy', 
    icon: <Shield className="w-5 h-5" />,
    permission: Permission.WORKBENCH_PRIVACY
  },
  {
    path: '/workbench/review/reports',
    labelKey: 'workbench.nav.reviewReports',
    icon: <FileBarChart className="w-5 h-5" />,
    permission: Permission.REVIEW_REPORTS
  },
  {
    path: '/workbench/review/tags',
    labelKey: 'workbench.nav.tagManagement',
    icon: <Tag className="w-5 h-5" />,
    permission: Permission.TAG_MANAGE
  },
  {
    path: '/workbench/surveys/schemas',
    labelKey: 'workbench.nav.surveySchemas',
    icon: <FileBarChart className="w-5 h-5" />,
    permission: Permission.SURVEY_SCHEMA_MANAGE
  },
  {
    path: '/workbench/surveys/instances',
    labelKey: 'workbench.nav.surveyInstances',
    icon: <FileBarChart className="w-5 h-5" />,
    anyPermissions: [Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW]
  },
  { 
    path: '/workbench/settings', 
    labelKey: 'workbench.nav.settings', 
    icon: <Settings className="w-5 h-5" /> 
  },
];

const isGroupScopedPath = (path: string) =>
  path === '/workbench/group' || path.startsWith('/workbench/group/');

export default function WorkbenchLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout, activeGroupId, setActiveGroupId } = useAuthStore();
  const { piiMasked, togglePIIMask, setPIIMasked } = useWorkbenchStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [researchExpanded, setResearchExpanded] = useState(true);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
  const canViewPii = user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;
  const displayName = user?.displayName ? (piiMasked ? maskName(user.displayName) : user.displayName) : '';

  const resolvedGroupId = activeGroupId ?? user?.activeGroupId ?? null;
  const activeMemberships = useMemo(
    () => (user?.memberships || []).filter((m) => m.status === 'active'),
    [user?.memberships]
  );
  const hasGroupMembership = activeMemberships.length > 0;
  const isOwner = user?.role === UserRole.OWNER;
  const canAccessGroupModeration = !!(isOwner || canManageUsers);

  // If user lacks permission, always force masked in UI state
  useEffect(() => {
    if (!canViewPii && !piiMasked) setPIIMasked(true);
  }, [canViewPii, piiMasked, setPIIMasked]);

  useEffect(() => {
    if (canManageUsers) return;
    const memberships = user?.memberships || [];
    if (memberships.length === 0) return;
    if (resolvedGroupId && memberships.some((m) => m.groupId === resolvedGroupId)) return;
    setActiveGroupId(memberships[0].groupId);
  }, [canManageUsers, resolvedGroupId, setActiveGroupId, user?.memberships]);

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission && !item.anyPermissions) return true;
    if (item.permission) return user?.permissions.includes(item.permission);
    if (item.anyPermissions) return item.anyPermissions.some((perm) => user?.permissions.includes(perm));
    return false;
  }).filter((item) => {
    const isGroupItem = isGroupScopedPath(item.path);
    if (item.path === '/workbench/group/sessions' && !canAccessGroupModeration) return false;
    if (isGroupItem && !resolvedGroupId) return false;
    if (canManageUsers) return true;
    if (hasGroupMembership) return true;
    return !isGroupItem && item.path !== '/workbench/approvals';
  });

  const isActive = (path: string) => {
    if (path === '/workbench') {
      return location.pathname === '/workbench';
    }
    return location.pathname.startsWith(path);
  };

  const researchPaths = new Set(['/workbench/review', '/workbench/review/reports', '/workbench/review/tags']);
  const groupNavItems = visibleNavItems.filter((item) => isGroupScopedPath(item.path));
  const mainNavItems = visibleNavItems.filter((item) => !isGroupScopedPath(item.path) && !researchPaths.has(item.path));
  const researchNavItems = visibleNavItems.filter((item) => researchPaths.has(item.path));
  const isResearchActive = researchNavItems.some((item) => isActive(item.path));

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-500 rounded-xl flex items-center justify-center shadow-soft flex-shrink-0">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-neutral-800 truncate">{t('workbench.title')}</h1>
            <p className="text-xs text-neutral-500">{t('workbench.subtitle')}</p>
          </div>
          <button
            onClick={closeSidebar}
            className="ml-auto md:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left min-h-[44px] ${
                isActive(item.path)
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
          {researchNavItems.length > 0 && (
            <>
              <button
                onClick={() => setResearchExpanded((v) => !v)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left min-h-[44px] ${
                  isResearchActive && !researchExpanded
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <Microscope className="w-5 h-5" />
                <span className="flex-1">{t('workbench.nav.researchSection', 'Research')}</span>
                {researchExpanded ? (
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                )}
              </button>
              {researchExpanded && (
                <div className="ml-4 space-y-0.5">
                  {researchNavItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left min-h-[40px] text-sm ${
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
              )}
            </>
          )}
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left min-h-[44px] ${
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
          onClick={() => { window.location.href = CHAT_URL; }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors min-h-[44px]"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{t('workbench.nav.backToChat')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-neutral-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — off-canvas on mobile, static on md+ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-neutral-200 flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:static md:translate-x-0 md:w-64 md:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <InstallBanner />
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
          {/* Left side: hamburger + PII toggle */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {canViewPii ? (
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
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                  piiMasked
                    ? 'bg-secondary-100 text-secondary-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
                title={piiMasked
                  ? t('workbench.pii.clickToReveal', 'Click to reveal personal information')
                  : t('workbench.pii.clickToMask', 'Click to mask personal information')
                }
              >
                {piiMasked ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">
                  {t('workbench.pii.label')} {piiMasked ? t('workbench.pii.masked') : t('workbench.pii.visible')}
                </span>
                <span className={`ml-1 w-2 h-2 rounded-full hidden sm:block ${piiMasked ? 'bg-secondary-500' : 'bg-amber-500'}`} />
              </button>
            ) : (
              <div />
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSelector variant="dropdown" className="w-28 sm:w-40 hidden sm:block" />
            <div className="hidden lg:block">
              <GroupScopeSelector />
            </div>
            <div className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-neutral-50">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="text-sm hidden sm:block min-w-0">
                <p className="font-medium text-neutral-700 max-w-[200px] truncate">{displayName}</p>
                <p className="text-xs text-neutral-500">{t(`roles.${user?.role}`)}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 hidden sm:block" />
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="p-2 text-neutral-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t('common.signOut')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
