import { useAuthStore } from '../../stores/authStore';
import { Permission } from '../../types';
import Dashboard from './Dashboard';
import GroupDashboard from './group/GroupDashboard';

/**
 * Workbench landing page that adapts to the user's permission set.
 * - Global roles keep the existing dashboard.
 * - Group admins get a dedicated group dashboard (and avoid calling global admin APIs).
 */
export default function WorkbenchHome() {
  const { user } = useAuthStore();

  const canManageUsers = user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
  const canResearch = user?.permissions.includes(Permission.WORKBENCH_RESEARCH) ?? false;
  const canGroupDashboard = user?.permissions.includes(Permission.WORKBENCH_GROUP_DASHBOARD) ?? false;
  const hasGroupMembership = (user?.memberships || []).some((m) => m.status === 'active');

  if (canGroupDashboard && hasGroupMembership && !canManageUsers && !canResearch) {
    return <GroupDashboard />;
  }

  return <Dashboard />;
}

