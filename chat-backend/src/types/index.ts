/**
 * Backend types - re-exports shared types and defines backend-specific types
 */

// Re-export shared types from @mentalhelpglobal/chat-types
export {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
} from '@mentalhelpglobal/chat-types';

export type {
  GroupRole,
  GroupMembershipStatus,
  GroupMembershipSummary,
  AuthenticatedUser,
} from '@mentalhelpglobal/chat-types';

// ── Backend-specific types ──

/**
 * User status
 */
export type UserStatus = 'active' | 'blocked' | 'pending' | 'approval' | 'disapproved' | 'anonymized';

export interface GroupMembership {
  userId: string;
  groupId: string;
  role: import('@mentalhelpglobal/chat-types').GroupRole;
  status: import('@mentalhelpglobal/chat-types').GroupMembershipStatus;
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
  requiresApproval: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface AppSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
  otpLoginDisabledWorkbench: boolean;
}

/**
 * Database User record
 */
export interface DbUser {
  id: string;
  email: string;
  display_name: string;
  role: import('@mentalhelpglobal/chat-types').UserRole;
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
  is_test_user?: boolean;
  google_sub?: string | null;
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
  role: import('@mentalhelpglobal/chat-types').UserRole;
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
  isTestUser?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: import('@mentalhelpglobal/chat-types').UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string;
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
  role?: import('@mentalhelpglobal/chat-types').UserRole;
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
  role?: import('@mentalhelpglobal/chat-types').UserRole | 'all';
  status?: UserStatus | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Comma-separated tag names to filter users by assigned tags */
  tags?: string;
  /** Filter users that have the `functional QA` tag assigned */
  testUsersOnly?: boolean;
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
    isTestUser: (dbUser as any).is_test_user === true,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at
  };
}

/**
 * Convert database user to authenticated user
 */
export function dbUserToAuthUser(
  dbUser: DbUser,
  context?: { activeGroupId?: string | null; groupRole?: import('@mentalhelpglobal/chat-types').GroupRole | null; memberships?: import('@mentalhelpglobal/chat-types').GroupMembershipSummary[] }
): import('@mentalhelpglobal/chat-types').AuthenticatedUser {
  const { ROLE_PERMISSIONS, Permission } = require('@mentalhelpglobal/chat-types');
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
