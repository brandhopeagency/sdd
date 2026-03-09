import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { adminGroupsApi, groupAdminApi } from '@/services/adminApi';
import { Permission } from '@mentalhelpglobal/chat-types';

export default function GroupScopeSelector() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, activeGroupId, setActiveGroupId, initializeAuth } = useAuthStore();
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [managedGroups, setManagedGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingManagedGroups, setLoadingManagedGroups] = useState(false);

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
  const resolvedGroupId = activeGroupId ?? user?.activeGroupId ?? null;

  const activeMemberships = useMemo(
    () => (user?.memberships || []).filter((m) => m.status === 'active'),
    [user?.memberships]
  );
  const adminMemberships = useMemo(
    () => activeMemberships.filter((m) => m.role === 'admin'),
    [activeMemberships]
  );

  const selectableGroups = useMemo(() => {
    const groups = canManageUsers
      ? managedGroups.map((g) => ({ id: g.id, name: g.name }))
      : activeMemberships.map((m) => ({ id: m.groupId, name: m.groupName }));
    const base = !resolvedGroupId
      ? [{ id: '', name: t('workbench.scopeSelector.placeholder') }, ...groups]
      : groups;
    if (resolvedGroupId && !base.some((group) => group.id === resolvedGroupId)) {
      const membership = (user?.memberships || []).find((m) => m.groupId === resolvedGroupId);
      return [...base, { id: resolvedGroupId, name: membership?.groupName || resolvedGroupId }];
    }
    return base;
  }, [activeMemberships, canManageUsers, managedGroups, resolvedGroupId, t, user?.memberships]);

  const scopeSelectorValue = resolvedGroupId ?? '';
  const shouldShowGroupSelector = canManageUsers || adminMemberships.length > 1 || activeMemberships.length > 1;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const formatGroupLabel = (group: { id: string; name?: string | null }) => {
    const rawName = (group.name ?? '').trim();
    if (rawName && !uuidPattern.test(rawName)) return rawName;
    const shortId = group.id.slice(0, 8);
    return `${t('workbench.scopeSelector.label')} ${shortId}`;
  };

  useEffect(() => {
    if (!canManageUsers) return;
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
        console.error('[GroupScopeSelector] Failed to load managed groups:', e);
        if (mounted) setManagedGroups([]);
      } finally {
        if (mounted) setLoadingManagedGroups(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    if (!resolvedGroupId) return;
    if (managedGroups.length === 0) return;
    if (managedGroups.some((g) => g.id === resolvedGroupId)) return;
    const nextGroupId = managedGroups[0].id;
    setActiveGroupId(nextGroupId);
    void groupAdminApi.setActiveGroup(nextGroupId).catch(() => {
      // Best-effort: keep local selection even if backend rejects it.
    });
  }, [canManageUsers, managedGroups, resolvedGroupId, setActiveGroupId]);

  if (!shouldShowGroupSelector) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-neutral-500" htmlFor="workbench-scope-selector">
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
            await groupAdminApi.setActiveGroup(nextGroupId);
            setActiveGroupId(nextGroupId);
            await initializeAuth();
            navigate('/workbench/group');
          } finally {
            setSwitchingGroup(false);
          }
        }}
        aria-label={t('workbench.scopeSelector.ariaLabel')}
      >
        {selectableGroups.map((group) => (
          <option key={group.id} value={group.id} disabled={!group.id} title={group.id}>
            {formatGroupLabel(group)}
          </option>
        ))}
      </select>
    </div>
  );
}
