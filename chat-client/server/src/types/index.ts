/**
 * User roles within the system
 */
export enum UserRole {
  USER = 'user',
  QA_SPECIALIST = 'qa_specialist',
  RESEARCHER = 'researcher',
  MODERATOR = 'moderator',
  GROUP_ADMIN = 'group_admin',
  OWNER = 'owner'
}

/**
 * Per-group membership role (multi-group RBAC)
 */
export type GroupRole = 'member' | 'admin';
export type GroupMembershipStatus = 'active' | 'pending' | 'rejected' | 'removed';

export interface GroupMembershipSummary {
  groupId: string;
  groupName: string;
  role: GroupRole;
  status: GroupMembershipStatus;
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
  DATA_DELETE = 'data:delete'
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
    Permission.CHAT_DEBUG
  ],
  [UserRole.RESEARCHER]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_RESEARCH
  ],
  [UserRole.MODERATOR]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_USER_MANAGEMENT,
    Permission.WORKBENCH_MODERATION,
    Permission.WORKBENCH_RESEARCH
  ],
  [UserRole.GROUP_ADMIN]: [
    Permission.CHAT_ACCESS,
    Permission.WORKBENCH_ACCESS,
    Permission.WORKBENCH_GROUP_DASHBOARD,
    Permission.WORKBENCH_GROUP_USERS,
    Permission.WORKBENCH_GROUP_RESEARCH
  ],
  [UserRole.OWNER]: Object.values(Permission) // Full access
};

/**
 * User status
 */
export type UserStatus = 'active' | 'blocked' | 'pending' | 'approval' | 'disapproved' | 'anonymized';

export interface GroupMembership {
  userId: string;
  groupId: string;
  role: GroupRole;
  status: GroupMembershipStatus;
  createdAt: Date;
  updatedAt: Date;
  groupName?: string | null;
}

export interface GroupInviteCode {
  id: string;
  groupId: string;
  code: string;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  maxUses: number;
  uses: number;
  metadata: Record<string, unknown>;
}

export interface GroupInvitationCode {
  id: string;
  groupId: string;
  code: string;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface AppSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
}

/**
 * Database User record
 */
export interface DbUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  group_id: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  disapproved_at: Date | null;
  disapproval_comment: string | null;
  disapproval_count: number | null;
  active_group_id?: string | null;
  session_count: number;
  last_login_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * User for API responses (camelCase)
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  groupId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  disapprovedAt: Date | null;
  disapprovalComment: string | null;
  disapprovalCount: number;
  activeGroupId?: string | null;
  sessionCount: number;
  lastLoginAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authenticated user with permissions
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: Permission[];
  groupId: string | null;
  status: UserStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  disapprovedAt?: Date | null;
  disapprovalComment?: string | null;
  disapprovalCount?: number;
  activeGroupId?: string | null;
  groupRole?: GroupRole | null;
  memberships?: GroupMembershipSummary[];
  createdAt: Date;
  lastLoginAt: Date;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string; // user id
  tokenId: string;
  iat?: number;
  exp?: number;
}

/**
 * OTP record
 */
export interface OtpRecord {
  id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  created_at: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * API response types
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Request types
 */
export interface SendOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  groupId?: string | null;
}

export interface BlockUserRequest {
  reason: string;
}

export interface EraseUserRequest {
  reason: string;
  confirmationCode: string;
}

/**
 * Pagination query params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | 'all';
  status?: UserStatus | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Convert database user to API user
 */
export function dbUserToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.display_name,
    role: dbUser.role,
    status: dbUser.status,
    groupId: dbUser.group_id ?? null,
    approvedBy: dbUser.approved_by ?? null,
    approvedAt: dbUser.approved_at ?? null,
    disapprovedAt: dbUser.disapproved_at ?? null,
    disapprovalComment: dbUser.disapproval_comment ?? null,
    disapprovalCount: dbUser.disapproval_count ?? 0,
    activeGroupId: (dbUser as any).active_group_id ?? null,
    sessionCount: dbUser.session_count,
    lastLoginAt: dbUser.last_login_at,
    metadata: dbUser.metadata,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at
  };
}

/**
 * Convert database user to authenticated user
 */
export function dbUserToAuthUser(
  dbUser: DbUser,
  context?: { activeGroupId?: string | null; groupRole?: GroupRole | null; memberships?: GroupMembershipSummary[] }
): AuthenticatedUser {
  const basePermissions = ROLE_PERMISSIONS[dbUser.role] || [];
  const groupPermissions =
    context?.groupRole === 'admin'
      ? [
          Permission.WORKBENCH_GROUP_DASHBOARD,
          Permission.WORKBENCH_GROUP_USERS,
          Permission.WORKBENCH_GROUP_RESEARCH
        ]
      : [];

  const activeGroupId = context?.activeGroupId ?? (dbUser as any).active_group_id ?? null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.display_name,
    role: dbUser.role,
    permissions: Array.from(new Set([...basePermissions, ...groupPermissions])),
    status: dbUser.status,
    groupId: activeGroupId ?? dbUser.group_id ?? null,
    activeGroupId,
    groupRole: context?.groupRole ?? null,
    memberships: context?.memberships ?? [],
    approvedBy: dbUser.approved_by ?? null,
    approvedAt: dbUser.approved_at ?? null,
    disapprovedAt: dbUser.disapproved_at ?? null,
    disapprovalComment: dbUser.disapproval_comment ?? null,
    disapprovalCount: dbUser.disapproval_count ?? 0,
    createdAt: dbUser.created_at,
    lastLoginAt: dbUser.last_login_at || dbUser.created_at
  };
}

