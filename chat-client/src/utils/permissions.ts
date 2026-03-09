import { Permission, UserRole, ROLE_PERMISSIONS } from '../types';

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some(p => userPermissions.includes(p));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every(p => userPermissions.includes(p));
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role can access the Workbench
 */
export function canAccessWorkbench(role: UserRole): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(Permission.WORKBENCH_ACCESS);
}

/**
 * Check if a role can use debug mode
 */
export function canUseDebugMode(role: UserRole): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(Permission.CHAT_DEBUG);
}

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    [UserRole.USER]: 'User',
    [UserRole.QA_SPECIALIST]: 'QA Specialist',
    [UserRole.RESEARCHER]: 'Researcher',
    [UserRole.MODERATOR]: 'Moderator',
    [UserRole.GROUP_ADMIN]: 'Group Admin',
    [UserRole.OWNER]: 'Owner'
  };
  return names[role] || role;
}

/**
 * Get role badge color class
 */
export function getRoleBadgeClass(role: UserRole): string {
  const classes: Record<UserRole, string> = {
    [UserRole.USER]: 'badge-info',
    [UserRole.QA_SPECIALIST]: 'badge-warning',
    [UserRole.RESEARCHER]: 'badge-success',
    [UserRole.MODERATOR]: 'badge-warning',
    [UserRole.GROUP_ADMIN]: 'badge-info',
    [UserRole.OWNER]: 'bg-purple-100 text-purple-800'
  };
  return classes[role] || 'badge-info';
}

