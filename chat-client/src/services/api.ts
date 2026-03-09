/**
 * API Service
 * Centralized API client for backend communication
 */

import { API_BASE_URL as CONFIG_API_BASE_URL } from '@/config';

const API_BASE_URL = (import.meta.env.VITE_API_URL || CONFIG_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

// Exported for unit tests; treated as an internal helper for URL normalization.
export function buildUrl(endpoint: string, baseUrl: string = API_BASE_URL): string {
  const normalizedEndpoint =
    endpoint.startsWith('/api') && baseUrl.endsWith('/api')
      ? endpoint.replace(/^\/api/, '')
      : endpoint;
  return `${baseUrl}${normalizedEndpoint}`;
}
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface AdminPiiRevealAuditPayload {
  context?: string;
  path?: string;
  visible?: boolean;
}

export interface AdminSessionDto {
  id: string;
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  languageCode: string;
  gcsPath: string | null;
  moderationStatus: 'pending' | 'in_review' | 'moderated';
  tags: string[];
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagDto {
  id: string;
  name: string;
  category: 'session' | 'message';
  color: string;
  description: string;
  isCustom: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationDto {
  id: string;
  sessionId: string;
  messageId: string | null;
  authorId: string | null;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  goldenReference: string | null;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettingsDto {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
}

export interface GroupInvitationCodeDto {
  id: string;
  groupId: string;
  code: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestDto {
  user: import('../types').User;
  pendingGroups: Array<{
    groupId: string;
    groupName: string | null;
    role: string;
  }>;
}

// Token storage
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
  }
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('accessToken');
}

/**
 * Make an API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = buildUrl(endpoint);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add auth token if available
  const token = getAccessToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for refresh token
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[API] Request failed:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server'
      }
    };
  }
}

// ============================================
// Auth API
// ============================================

export const authApi = {
  sendOtp: (email: string) =>
    apiRequest<{ message: string; email: string; devCode?: string }>('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  verifyOtp: (email: string, code: string, invitationCode?: string) =>
    apiRequest<{
      accessToken: string;
      user: import('../types').AuthenticatedUser;
      isNewUser: boolean;
    }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, invitationCode })
    }),

  refresh: () =>
    apiRequest<{
      accessToken: string;
      user: import('../types').AuthenticatedUser;
    }>('/api/auth/refresh', {
      method: 'POST'
    }),

  logout: () =>
    apiRequest<{ message: string }>('/api/auth/logout', {
      method: 'POST'
    }),

  getMe: () =>
    apiRequest<import('../types').AuthenticatedUser>('/api/auth/me')
};

// ============================================
// Users API
// ============================================

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const usersApi = {
  list: (params: UsersListParams = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.role && params.role !== 'all') queryParams.set('role', params.role);
    if (params.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    
    const query = queryParams.toString();
    return apiRequest<import('../types').User[]>(`/api/admin/users${query ? `?${query}` : ''}`);
  },

  getById: (userId: string) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}`),

  create: (userData: { email: string; displayName: string; role?: string; status?: string }) =>
    apiRequest<import('../types').User>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  update: (userId: string, updates: { displayName?: string; role?: string; status?: string }) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),

  block: (userId: string, reason: string) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  unblock: (userId: string) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}/unblock`, {
      method: 'POST'
    }),

  changeRole: (userId: string, role: string) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify({ role })
    }),

  requestExport: (userId: string) =>
    apiRequest<{ jobId: string; estimatedMinutes: number }>(`/api/admin/users/${userId}/export`, {
      method: 'POST'
    }),

  eraseData: (userId: string, reason: string) =>
    apiRequest<import('../types').User>(`/api/admin/users/${userId}/erase`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  getStats: () =>
    apiRequest<{
      total: number;
      byStatus: Record<string, number>;
      byRole: Record<string, number>;
    }>('/api/admin/users/stats')
};

// ============================================
// Public Settings API
// ============================================

export const settingsApi = {
  getPublic: () => apiRequest<AppSettingsDto>('/api/settings')
};

// ============================================
// Admin Settings API
// ============================================

export const adminSettingsApi = {
  get: () => apiRequest<AppSettingsDto>('/api/admin/settings'),
  update: (payload: Partial<AppSettingsDto>) =>
    apiRequest<AppSettingsDto>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
};

// ============================================
// Sessions (Admin / Research) API
// ============================================

export interface SessionsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'ended' | 'expired' | 'all';
  moderationStatus?: 'pending' | 'in_review' | 'moderated' | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export const sessionsAdminApi = {
  list: (params: SessionsListParams = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params.moderationStatus && params.moderationStatus !== 'all') queryParams.set('moderationStatus', params.moderationStatus);
    if (params.dateFrom) queryParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.set('dateTo', params.dateTo);
    const query = queryParams.toString();

    return apiRequest<AdminSessionDto[]>(`/api/admin/sessions${query ? `?${query}` : ''}`);
  },

  getStats: () =>
    apiRequest<{
      total: number;
      byStatus: { active: number; ended: number; expired: number };
      byModerationStatus: { pending: number; in_review: number; moderated: number };
    }>(`/api/admin/sessions/stats`),

  getById: (sessionId: string) => apiRequest<AdminSessionDto>(`/api/admin/sessions/${sessionId}`),

  getConversation: (sessionId: string) =>
    apiRequest<import('../types/conversation').StoredConversation>(`/api/admin/sessions/${sessionId}/conversation`),

  updateModerationStatus: (sessionId: string, moderationStatus: 'pending' | 'in_review' | 'moderated') =>
    apiRequest<AdminSessionDto>(`/api/admin/sessions/${sessionId}/moderation`, {
      method: 'PATCH',
      body: JSON.stringify({ moderationStatus })
    }),

  addTag: (sessionId: string, tagName: string) =>
    apiRequest<AdminSessionDto>(`/api/admin/sessions/${sessionId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagName })
    }),

  removeTag: (sessionId: string, tagName: string) =>
    apiRequest<AdminSessionDto>(`/api/admin/sessions/${sessionId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE'
    }),

  listAnnotations: (sessionId: string) =>
    apiRequest<AnnotationDto[]>(`/api/admin/sessions/${sessionId}/annotations`),

  createAnnotation: (
    sessionId: string,
    payload: {
      messageId?: string | null;
      qualityRating: 1 | 2 | 3 | 4 | 5;
      goldenReference?: string | null;
      notes?: string;
      tags?: string[];
    }
  ) =>
    apiRequest<AnnotationDto>(`/api/admin/sessions/${sessionId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

// ============================================
// Group-scoped (Group Admin) API
// ============================================

export interface GroupDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDashboardDto {
  group: GroupDto | null;
  stats: {
    groupId: string;
    userCounts: { total: number; active: number; blocked: number; pending: number; anonymized: number };
    sessionCounts: {
      total: number;
      active: number;
      ended: number;
      expired: number;
      moderation: { pending: number; in_review: number; moderated: number };
    };
  };
}

export interface GroupMeDto {
  groupId: string;
  group: GroupDto | null;
}

export interface GroupInviteDto {
  code: string;
  groupId: string;
  maxUses: number;
  expiresAt: string | null;
}

export interface GroupPendingRequestDto {
  userId: string;
  email: string;
  displayName: string;
  requestedAt: string;
  source: 'invite' | 'manual' | 'unknown';
}

export interface GroupUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GroupSessionsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'ended' | 'expired' | 'all';
  moderationStatus?: 'pending' | 'in_review' | 'moderated' | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export const groupAdminApi = {
  me: (groupId: string) => apiRequest<GroupMeDto>(`/api/group/me?groupId=${encodeURIComponent(groupId)}`),

  dashboard: (groupId: string) => apiRequest<GroupDashboardDto>(`/api/group/dashboard?groupId=${encodeURIComponent(groupId)}`),

  setActiveGroup: (groupId: string) =>
    apiRequest<{ activeGroupId: string }>('/api/group/active', {
      method: 'POST',
      body: JSON.stringify({ groupId })
    }),

  createInvite: (groupId: string, payload: { maxUses?: number; expiresAt?: string | null } = {}) =>
    apiRequest<GroupInviteDto>(`/api/group/invites?groupId=${encodeURIComponent(groupId)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  listRequests: (groupId: string) =>
    apiRequest<GroupPendingRequestDto[]>(`/api/group/requests?groupId=${encodeURIComponent(groupId)}`),

  approveRequest: (groupId: string, userId: string) =>
    apiRequest<{ ok: true }>(
      `/api/group/requests/${encodeURIComponent(userId)}/approve?groupId=${encodeURIComponent(groupId)}`,
      { method: 'POST' }
    ),

  rejectRequest: (groupId: string, userId: string) =>
    apiRequest<{ ok: true }>(
      `/api/group/requests/${encodeURIComponent(userId)}/reject?groupId=${encodeURIComponent(groupId)}`,
      { method: 'POST' }
    ),

  listUsers: (groupId: string, params: GroupUsersListParams = {}) => {
    const queryParams = new URLSearchParams();
    queryParams.set('groupId', groupId);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.role && params.role !== 'all') queryParams.set('role', params.role);
    if (params.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    const query = queryParams.toString();
    return apiRequest<import('../types').User[]>(`/api/group/users${query ? `?${query}` : ''}`);
  },

  addUser: (groupId: string, payload: { userId?: string; email?: string }) =>
    apiRequest<import('../types').User>(`/api/group/users?groupId=${encodeURIComponent(groupId)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  removeUser: (groupId: string, userId: string) =>
    apiRequest<import('../types').User>(`/api/group/users/${userId}?groupId=${encodeURIComponent(groupId)}`, {
      method: 'DELETE'
    }),

  listSessions: (groupId: string, params: GroupSessionsListParams = {}) => {
    const queryParams = new URLSearchParams();
    queryParams.set('groupId', groupId);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params.moderationStatus && params.moderationStatus !== 'all')
      queryParams.set('moderationStatus', params.moderationStatus);
    if (params.dateFrom) queryParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.set('dateTo', params.dateTo);
    const query = queryParams.toString();
    return apiRequest<AdminSessionDto[]>(`/api/group/sessions${query ? `?${query}` : ''}`);
  },

  getSession: (groupId: string, sessionId: string) =>
    apiRequest<AdminSessionDto>(`/api/group/sessions/${sessionId}?groupId=${encodeURIComponent(groupId)}`),

  getConversation: (groupId: string, sessionId: string) =>
    apiRequest<import('../types/conversation').StoredConversation>(
      `/api/group/sessions/${sessionId}/conversation?groupId=${encodeURIComponent(groupId)}`
    )
};

// ============================================
// Admin Groups (global)
// ============================================

export const adminGroupsApi = {
  list: () => apiRequest<GroupDto[]>('/api/admin/groups'),
  create: (name: string) =>
    apiRequest<GroupDto>('/api/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),
  update: (groupId: string, name: string) =>
    apiRequest<GroupDto>(`/api/admin/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    }),
  listMembers: (groupId: string, params: GroupUsersListParams = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.role && params.role !== 'all') queryParams.set('role', params.role);
    if (params.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    const query = queryParams.toString();
    return apiRequest<Array<import('../types').User & { membershipRole: string; membershipStatus: string }>>(
      `/api/admin/groups/${groupId}/members${query ? `?${query}` : ''}`
    );
  },
  addMember: (groupId: string, payload: { userId?: string; email?: string }) =>
    apiRequest<import('../types').User>(`/api/admin/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  removeMember: (groupId: string, userId: string) =>
    apiRequest<import('../types').User>(`/api/admin/groups/${groupId}/members/${userId}`, {
      method: 'DELETE'
    }),
  setMemberRole: (groupId: string, userId: string, role: 'member' | 'admin') =>
    apiRequest<{ ok: true }>(`/api/admin/groups/${groupId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    }),
  listInvites: (groupId: string) =>
    apiRequest<GroupInvitationCodeDto[]>(`/api/admin/groups/${groupId}/invites`),
  createInvite: (groupId: string, payload: { code?: string; expiresAt?: string }) =>
    apiRequest<GroupInvitationCodeDto>(`/api/admin/groups/${groupId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deactivateInvite: (groupId: string, codeId: string) =>
    apiRequest<GroupInvitationCodeDto>(`/api/admin/groups/${groupId}/invites/${codeId}/deactivate`, {
      method: 'POST'
    })
};

// ============================================
// Admin Approvals API
// ============================================

export const adminApprovalsApi = {
  list: (groupId?: string) =>
    apiRequest<ApprovalRequestDto[]>(`/api/admin/approvals${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''}`),
  approve: (userId: string, payload: { groupId?: string; comment?: string } = {}) =>
    apiRequest<import('../types').User>(`/api/admin/approvals/${userId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  disapprove: (userId: string, payload: { groupId?: string; comment: string }) =>
    apiRequest<import('../types').User>(`/api/admin/approvals/${userId}/disapprove`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

// ============================================
// Tags (Admin / Research) API
// ============================================

export const tagsAdminApi = {
  list: (category?: 'session' | 'message') => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiRequest<TagDto[]>(`/api/admin/tags${query}`);
  }
};

// ============================================
// Audit (Admin) API
// ============================================

export const adminAuditApi = {
  logPiiReveal: (payload: AdminPiiRevealAuditPayload = {}) =>
    apiRequest<{ ok: true }>(`/api/admin/audit/pii-reveal`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

export default {
  auth: authApi,
  users: usersApi,
  settings: settingsApi,
  adminSettings: adminSettingsApi,
  adminApprovals: adminApprovalsApi,
  adminGroups: adminGroupsApi,
  sessions: sessionsAdminApi,
  tags: tagsAdminApi,
  audit: adminAuditApi,
  group: groupAdminApi,
  setAccessToken,
  getAccessToken,
  clearTokens
};

