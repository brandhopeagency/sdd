/**
 * Review API Service
 * API client for the chat moderation review system
 */

import type {
  QueueSession, SessionReview, MessageRating, RiskFlag,
  DeanonymizationRequest, ReviewConfiguration, ReviewNotification,
  BannerAlerts, ReviewerDashboardStats, TeamDashboardStats,
  RevealedIdentity, ReportMetadata
} from '@mentalhelpglobal/chat-types';
import { apiFetch } from './api';

const API_BASE = '/api/review';
const ADMIN_REVIEW_BASE = '/api/admin/review';

// ── Internal helpers ──

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    const payload = await response
      .clone()
      .json()
      .catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  }
  return response;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}${path}`);
  const json = await res.json();
  return json.data ?? json;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return json.data ?? json;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json.data ?? json;
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return json.data ?? json;
}

// ── Query-string builder ──

function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

// ============================================
// Queue
// ============================================

export interface QueueParams {
  /** Maps to backend 'tab' query param */
  status?: string;
  riskLevel?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedToMe?: boolean;
  sortBy?: string;
  page?: number;
  limit?: number;
  /** Comma-separated tag names to filter by */
  tags?: string;
  /** When true, show only excluded sessions */
  excluded?: boolean;
  /** Optional selected group scope */
  groupId?: string;
}

export async function getReviewQueue(params: QueueParams = {}): Promise<{
  items: QueueSession[];
  total: number;
  counts: { pending: number; flagged: number; inProgress: number; completed: number };
}> {
  // Map 'status' to backend 'tab' query param
  const { status, ...rest } = params;
  const queryParams = { ...rest, ...(status ? { tab: status } : {}) };
  const res = await fetchWithAuth(`${API_BASE}/queue${toQuery(queryParams)}`);
  const json = await res.json();
  return {
    items: json.data ?? [],
    total: json.meta?.total ?? 0,
    counts: json.counts ?? { pending: 0, flagged: 0, inProgress: 0, completed: 0 },
  };
}

// ============================================
// Sessions
// ============================================

export async function getReviewSession(sessionId: string, groupId?: string) {
  const payload = await apiGet<{
    session: QueueSession;
    messages: unknown[];
    reviews: SessionReview[];
    flags: RiskFlag[];
    myReview?: SessionReview | null;
    allReviews?: unknown[];
    scoreRange?: { min: number; max: number } | null;
    isCurrentUserTiebreaker?: boolean;
  }>(`/sessions/${sessionId}${toQuery({ groupId })}`);

  // Backend currently returns a flattened session payload (`data: { ...session, messages, myReview }`)
  // while some frontend callers expect `{ session, messages, reviews, flags }`.
  // Normalize both shapes so session loading works across deployments.
  if ('session' in payload && payload.session) {
    return {
      session: payload.session,
      messages: payload.messages ?? [],
      reviews: payload.reviews ?? [],
      flags: payload.flags ?? [],
    };
  }

  const flattened = payload as unknown as QueueSession & {
    messages?: unknown[];
    myReview?: SessionReview | null;
  };
  return {
    session: flattened as QueueSession,
    messages: flattened.messages ?? [],
    reviews: flattened.myReview ? [flattened.myReview] : [],
    flags: [],
  };
}

export async function startReview(sessionId: string): Promise<SessionReview> {
  return apiPost(`/sessions/${sessionId}/reviews`);
}

export async function saveRating(
  sessionId: string,
  reviewId: string,
  input: Partial<MessageRating>
): Promise<MessageRating> {
  const payload = await apiPut<Partial<MessageRating> | { success: boolean }>(
    `/sessions/${sessionId}/reviews/${reviewId}/ratings`,
    input,
  );
  // Backend currently returns `{ success: true }` without rating payload.
  // Synthesize a stable client-side object so UI progress and local state update reliably.
  const rawCreatedAt = (payload as Partial<MessageRating>)?.createdAt;
  const rawUpdatedAt = (payload as Partial<MessageRating>)?.updatedAt;
  const createdAt = rawCreatedAt instanceof Date ? rawCreatedAt : new Date();
  const updatedAt = rawUpdatedAt instanceof Date ? rawUpdatedAt : new Date();

  const payloadMessageIdValue = (payload as Partial<MessageRating>)?.messageId;
  const payloadMessageId =
    typeof payloadMessageIdValue === 'string'
      ? payloadMessageIdValue.trim()
      : '';
  const fallbackMessageId =
    input.messageId != null ? String(input.messageId).trim() : '';
  const effectiveMessageId = payloadMessageId || fallbackMessageId;

  return {
    id: (payload as Partial<MessageRating>)?.id ?? `${reviewId}:${input.messageId ?? 'message'}`,
    reviewId,
    messageId: effectiveMessageId,
    score: (payload as Partial<MessageRating>)?.score ?? Number(input.score ?? 0),
    comment:
      (payload as Partial<MessageRating>)?.comment ??
      (typeof input.comment === 'string' ? input.comment : null),
    criteriaFeedback:
      (payload as Partial<MessageRating>)?.criteriaFeedback ??
      (Array.isArray(input.criteriaFeedback) ? input.criteriaFeedback : []),
    createdAt,
    updatedAt,
  };
}

export async function submitReview(
  sessionId: string,
  reviewId: string,
  input?: { overallComment?: string }
): Promise<SessionReview> {
  return apiPost(`/sessions/${sessionId}/reviews/${reviewId}/submit`, input);
}

export async function assignSession(
  sessionId: string,
  reviewerId: string
): Promise<void> {
  return apiPost(`/sessions/${sessionId}/assign`, { reviewerId });
}

// ============================================
// Flags
// ============================================

export async function getSessionFlags(sessionId: string): Promise<RiskFlag[]> {
  return apiGet(`/sessions/${sessionId}/flags`);
}

export async function createFlag(
  sessionId: string,
  input: {
    severity: string;
    reasonCategory: string;
    details: string;
    requestDeanonymization?: boolean;
    deanonymizationJustification?: string;
  }
): Promise<RiskFlag> {
  return apiPost(`/sessions/${sessionId}/flags`, input);
}

export async function resolveFlag(
  sessionId: string,
  flagId: string,
  input: { resolution: string; notes: string }
): Promise<RiskFlag> {
  return apiPost(`/sessions/${sessionId}/flags/${flagId}/resolve`, {
    newStatus: input.resolution,
    resolutionNotes: input.notes,
  });
}

export interface EscalationParams {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export async function getEscalationQueue(params: EscalationParams = {}): Promise<{
  items: RiskFlag[];
  total: number;
}> {
  return apiGet(`/sessions/escalations${toQuery(params as Record<string, unknown>)}`);
}

// ============================================
// Deanonymization
// ============================================

export interface DeanonymizationListParams {
  status?: string;
  page?: number;
  limit?: number;
}

export async function getDeanonymizationRequests(
  params: DeanonymizationListParams = {}
): Promise<{ items: DeanonymizationRequest[]; total: number }> {
  return apiGet(`/deanonymization${toQuery(params as Record<string, unknown>)}`);
}

export async function createDeanonymizationRequest(
  input: {
    sessionId: string;
    flagId?: string;
    justificationCategory: string;
    justificationDetails: string;
  }
): Promise<DeanonymizationRequest> {
  return apiPost('/deanonymization', input);
}

export async function approveDeanonymization(
  requestId: string,
  input?: { notes?: string }
): Promise<DeanonymizationRequest> {
  return apiPost(`/deanonymization/${requestId}/approve`, input);
}

export async function denyDeanonymization(
  requestId: string,
  input: { denialNotes: string }
): Promise<DeanonymizationRequest> {
  return apiPost(`/deanonymization/${requestId}/deny`, input);
}

export async function getRevealedIdentity(
  requestId: string
): Promise<RevealedIdentity> {
  return apiGet(`/deanonymization/${requestId}/identity`);
}

// ============================================
// Dashboard
// ============================================

export async function getMyDashboard(
  period?: string
): Promise<ReviewerDashboardStats> {
  return apiGet(`/dashboard/me${toQuery({ period })}`);
}

export async function getTeamDashboard(
  period?: string
): Promise<TeamDashboardStats> {
  return apiGet(`/dashboard/team${toQuery({ period })}`);
}

// ============================================
// Notifications
// ============================================

export interface NotificationParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function getNotifications(
  params: NotificationParams = {}
): Promise<{ items: ReviewNotification[]; total: number; unreadCount: number }> {
  return apiGet(`/notifications${toQuery(params as Record<string, unknown>)}`);
}

export async function getBannerAlerts(): Promise<BannerAlerts> {
  return apiGet('/notifications/banners');
}

export async function markNotificationRead(id: string): Promise<void> {
  return apiPatch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiPost('/notifications/read-all');
}

// ============================================
// Configuration (admin endpoint: /api/admin/review/config)
// ============================================

export async function getReviewConfig(): Promise<ReviewConfiguration> {
  const res = await fetchWithAuth(`${ADMIN_REVIEW_BASE}/config`);
  const json = await res.json();
  return json.data ?? json;
}

export async function updateReviewConfig(
  input: Partial<ReviewConfiguration>
): Promise<ReviewConfiguration> {
  const res = await fetchWithAuth(`${ADMIN_REVIEW_BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  const json = await res.json();
  return json.data ?? json;
}

// ============================================
// Reports
// ============================================

export async function getReportTypes(): Promise<{
  reportTypes: string[];
  formats: string[];
}> {
  const res = await fetchWithAuth(`${API_BASE}/reports`);
  const json = await res.json();
  return json.data ?? json;
}

export async function generateReport(
  type: string,
  from: string,
  to: string,
  format: string = 'json'
): Promise<Blob | ReportMetadata> {
  const query = toQuery({ type, from, to, format } as Record<string, unknown>);

  if (format === 'pdf' || format === 'csv') {
    const res = await fetchWithAuth(`${API_BASE}/reports/generate${query}`);
    return res.blob();
  }

  return apiGet<ReportMetadata>(`/reports/generate${query}`);
}
