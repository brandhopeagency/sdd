/**
 * Tag API Service
 * API client for the tag system (tag definitions, user tags, session tags)
 */

import type {
  TagDefinition,
  UserTag,
  SessionTag,
  CreateTagDefinitionInput,
  UpdateTagDefinitionInput,
} from '@mentalhelpglobal/chat-types';
import { apiFetch } from '@mentalhelpglobal/chat-frontend-common';

const ADMIN_BASE = '/api/admin';
const REVIEW_BASE = '/api/review';

// ── Internal helpers ──

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    const payload = await response.clone().json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  }
  return response;
}

// Admin API helpers
async function adminGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${ADMIN_BASE}${path}`);
  const json = await res.json();
  return json.data ?? json;
}

async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${ADMIN_BASE}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return json.data ?? json;
}

async function adminPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(`${ADMIN_BASE}${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json.data ?? json;
}

async function adminDelete<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${ADMIN_BASE}${path}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  return json.data ?? json;
}

// Review API helpers
async function reviewGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${REVIEW_BASE}${path}`);
  const json = await res.json();
  return json.data ?? json;
}

async function reviewPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${REVIEW_BASE}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return json.data ?? json;
}

async function reviewDelete<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${REVIEW_BASE}${path}`, {
    method: 'DELETE',
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
// Tag Definition CRUD (admin)
// ============================================

export interface ListTagDefinitionsParams {
  category?: string;
  active?: boolean;
}

export async function listTagDefinitions(
  params?: ListTagDefinitionsParams
): Promise<TagDefinition[]> {
  return adminGet(`/tags${toQuery(params as Record<string, unknown> || {})}`);
}

export async function createTagDefinition(
  input: CreateTagDefinitionInput
): Promise<TagDefinition> {
  return adminPost('/tags', input);
}

export async function updateTagDefinition(
  id: string,
  input: UpdateTagDefinitionInput
): Promise<TagDefinition> {
  return adminPut(`/tags/${id}`, input);
}

export async function deleteTagDefinition(id: string): Promise<{
  affectedUsers: number;
  affectedSessions: number;
}> {
  return adminDelete(`/tags/${id}`);
}

// ============================================
// User Tags (admin)
// ============================================

export async function listUserTags(userId: string): Promise<UserTag[]> {
  return adminGet(`/users/${userId}/tags`);
}

export async function assignUserTag(
  userId: string,
  tagDefinitionId: string
): Promise<UserTag> {
  return adminPost(`/users/${userId}/tags`, { tagDefinitionId });
}

export async function removeUserTag(userId: string, tagId: string): Promise<void> {
  return adminDelete(`/users/${userId}/tags/${tagId}`);
}

// ============================================
// Session Tags (review)
// ============================================

export async function listSessionTags(sessionId: string): Promise<SessionTag[]> {
  return reviewGet(`/sessions/${sessionId}/tags`);
}

export async function addSessionTag(
  sessionId: string,
  payload: { tagDefinitionId: string } | { tagName: string }
): Promise<{
  sessionTag: SessionTag;
  tagDefinitionCreated: boolean;
}> {
  return reviewPost(`/sessions/${sessionId}/tags`, payload);
}

export async function removeSessionTag(
  sessionId: string,
  tagId: string
): Promise<void> {
  return reviewDelete(`/sessions/${sessionId}/tags/${tagId}`);
}

// ============================================
// Filter Tags (review)
// ============================================

export interface FilterTag {
  id: string;
  name: string;
  category: string;
  sessionCount: number;
}

export async function listFilterTags(): Promise<FilterTag[]> {
  return reviewGet('/tags');
}
