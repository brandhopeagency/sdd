/**
 * RBAC (Role-Based Access Control) types
 *
 * Defines user roles, permissions, and their mappings for the MHG chat system.
 */

/**
 * User roles within the system
 */
export enum UserRole {
  USER = 'user',
  QA_SPECIALIST = 'qa_specialist',
  RESEARCHER = 'researcher',
  SUPERVISOR = 'supervisor',
  MODERATOR = 'moderator',
  GROUP_ADMIN = 'group_admin',
  OWNER = 'owner'
}

/**
 * Granular permissions for RBAC
 */
export enum Permission {
  // Chat permissions
  CHAT_ACCESS = 'chat:access',
  CHAT_SEND = 'chat:send',
  CHAT_FEEDBACK = 'chat:feedback',
  CHAT_DEBUG = 'chat:debug',

  // Workbench permissions
  WORKBENCH_ACCESS = 'workbench:access',
  WORKBENCH_USER_MANAGEMENT = 'workbench:user_management',
  WORKBENCH_RESEARCH = 'workbench:research',
  WORKBENCH_MODERATION = 'workbench:moderation',
  WORKBENCH_PRIVACY = 'workbench:privacy',

  // Group-scoped workbench permissions (must be enforced server-side by group_id)
  WORKBENCH_GROUP_DASHBOARD = 'workbench:group_dashboard',
  WORKBENCH_GROUP_USERS = 'workbench:group_users',
  WORKBENCH_GROUP_RESEARCH = 'workbench:group_research',

  // Data permissions
  DATA_VIEW_PII = 'data:view_pii',
  DATA_EXPORT = 'data:export',
  DATA_DELETE = 'data:delete',

  // Review permissions
  REVIEW_ACCESS = 'review:access',
  REVIEW_SUBMIT = 'review:submit',
  REVIEW_FLAG = 'review:flag',
  REVIEW_TIEBREAK = 'review:tiebreak',
  REVIEW_TEAM_DASHBOARD = 'review:team_dashboard',
  REVIEW_ESCALATION = 'review:escalation',
  REVIEW_ASSIGN = 'review:assign',
  REVIEW_DEANONYMIZE_REQUEST = 'review:deanonymize_request',
  REVIEW_DEANONYMIZE_APPROVE = 'review:deanonymize_approve',
  REVIEW_COMMANDER_DASHBOARD = 'review:commander_dashboard',
  REVIEW_CONFIGURE = 'review:configure',
  REVIEW_REPORTS = 'review:reports',

  // Supervision permissions
  REVIEW_SUPERVISE = 'review:supervise',
  REVIEW_SUPERVISION_CONFIG = 'review:supervision_config',

  // Tag permissions
  TAG_MANAGE = 'tag:manage',
  TAG_CREATE = 'tag:create',
  TAG_ASSIGN_USER = 'tag:assign_user',
  TAG_ASSIGN_SESSION = 'tag:assign_session',

  // Survey permissions
  SURVEY_SCHEMA_MANAGE = 'survey:schema_manage',
  SURVEY_SCHEMA_ARCHIVE = 'survey:schema_archive',
  SURVEY_INSTANCE_MANAGE = 'survey:instance_manage',
  SURVEY_INSTANCE_VIEW = 'survey:instance_view',
  SURVEY_RESPONSE_VIEW = 'survey:response_view'
}

/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK
  ],
  [UserRole.QA_SPECIALIST]: [
    Permission.CHAT_ACCESS,
    Permission.CHAT_SEND,
    Permission.CHAT_FEEDBACK,
    Permission.CHAT_DEBUG,
    // Review: Reviewer role
    Permission.REVIEW_ACCESS,
    Permission.REVIEW_SUBMIT,
    Permission.REVIEW_FLAG
  ],
  [UserRole.RESEARCHER]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_RESEARCH,
    Permission.WORKBENCH_MODERATION,
    // Review: Senior Reviewer role
    Permission.REVIEW_ACCESS,
    Permission.REVIEW_SUBMIT,
    Permission.REVIEW_FLAG,
    Permission.REVIEW_TIEBREAK,
    Permission.REVIEW_TEAM_DASHBOARD,
    // Survey
    Permission.SURVEY_SCHEMA_MANAGE,
    Permission.SURVEY_INSTANCE_MANAGE,
    Permission.SURVEY_INSTANCE_VIEW,
    Permission.SURVEY_RESPONSE_VIEW
  ],
  [UserRole.SUPERVISOR]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_RESEARCH,
    Permission.WORKBENCH_MODERATION,
    // Inherited Senior Reviewer permissions
    Permission.REVIEW_ACCESS,
    Permission.REVIEW_SUBMIT,
    Permission.REVIEW_FLAG,
    Permission.REVIEW_TIEBREAK,
    Permission.REVIEW_TEAM_DASHBOARD,
    // Supervisor-specific
    Permission.REVIEW_SUPERVISE,
    Permission.REVIEW_SUPERVISION_CONFIG,
    Permission.TAG_CREATE,
    Permission.TAG_ASSIGN_USER,
    Permission.TAG_ASSIGN_SESSION,
    // Survey (read-only)
    Permission.SURVEY_INSTANCE_VIEW
  ],
  [UserRole.MODERATOR]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_USER_MANAGEMENT,
    Permission.WORKBENCH_MODERATION,
    Permission.WORKBENCH_RESEARCH,
    // Review: Moderator role
    Permission.REVIEW_ACCESS,
    Permission.REVIEW_SUBMIT,
    Permission.REVIEW_FLAG,
    Permission.REVIEW_TIEBREAK,
    Permission.REVIEW_TEAM_DASHBOARD,
    Permission.REVIEW_ESCALATION,
    Permission.REVIEW_ASSIGN,
    Permission.REVIEW_DEANONYMIZE_REQUEST,
    // Supervision
    Permission.REVIEW_SUPERVISE,
    // Tag: create + assign
    Permission.TAG_CREATE,
    Permission.TAG_ASSIGN_USER,
    Permission.TAG_ASSIGN_SESSION,
    // Survey (Admin-level)
    Permission.SURVEY_SCHEMA_MANAGE,
    Permission.SURVEY_SCHEMA_ARCHIVE,
    Permission.SURVEY_INSTANCE_MANAGE,
    Permission.SURVEY_INSTANCE_VIEW,
    Permission.SURVEY_RESPONSE_VIEW
  ],
  [UserRole.GROUP_ADMIN]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_GROUP_DASHBOARD,
    Permission.WORKBENCH_GROUP_USERS,
    Permission.WORKBENCH_GROUP_RESEARCH,
    // Review: Commander role
    Permission.REVIEW_ACCESS,
    Permission.REVIEW_SUBMIT,
    Permission.REVIEW_FLAG,
    Permission.REVIEW_TIEBREAK,
    Permission.REVIEW_TEAM_DASHBOARD,
    Permission.REVIEW_ESCALATION,
    Permission.REVIEW_ASSIGN,
    Permission.REVIEW_DEANONYMIZE_REQUEST,
    Permission.REVIEW_DEANONYMIZE_APPROVE,
    Permission.REVIEW_COMMANDER_DASHBOARD,
    // Tag: assign to users and sessions
    Permission.TAG_ASSIGN_USER,
    Permission.TAG_ASSIGN_SESSION
  ],
  [UserRole.OWNER]: Object.values(Permission) // Full access (includes all review permissions)
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[],
  required: Permission
): boolean {
  return userPermissions.includes(required);
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  required: Permission[]
): boolean {
  return required.some(p => userPermissions.includes(p));
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  required: Permission[]
): boolean {
  return required.every(p => userPermissions.includes(p));
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
