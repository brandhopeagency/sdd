/**
 * API Service
 * Centralized API client for backend communication
 */

import { API_BASE_URL as CONFIG_API_BASE_URL } from '@/config';
import { getApiBaseUrl, fireOnUnauthenticated } from '@/services/apiClient';

const API_BASE_URL = (import.meta.env.VITE_API_URL || CONFIG_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

/**
 * Resolve the effective API base URL.
 * In production builds the surface-aware helper may return a different base
 * for workbench vs chat; in tests / SSR the static constant is used as fallback.
 */
function resolveBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    return API_BASE_URL;
  }
}

// Exported for unit tests; treated as an internal helper for URL normalization.
export function buildUrl(endpoint: string, baseUrl: string = resolveBaseUrl()): string {
  const normalizedEndpoint =
    endpoint.startsWith('/api') && baseUrl.endsWith('/api')
      ? endpoint.replace(/^\/api/, '')
      : endpoint;
  return `${baseUrl}${normalizedEndpoint}`;
}
export interface ApiResponse<T> {
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

type ApiErrorPayload = ApiResponse<unknown> | { error?: { code?: string; message?: string } } | null;

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function withNoCacheParam(endpoint: string): string {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}_ts=${Date.now()}`;
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function resolveRequestUrl(endpoint: string): string {
  return isAbsoluteUrl(endpoint) ? endpoint : buildUrl(endpoint);
}

function extractErrorCode(payload: ApiErrorPayload): string {
  const maybeCode = (payload as ApiResponse<unknown> | null)?.error?.code;
  if (typeof maybeCode === 'string' && maybeCode.length > 0) return maybeCode;
  const rootCode = (payload as { code?: string } | null)?.code;
  if (typeof rootCode === 'string' && rootCode.length > 0) return rootCode;
  return '';
}

function isAuthOrAuthzCode(code: string): boolean {
  const normalized = code.toUpperCase();
  if (!normalized) return false;
  return [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'FORBIDDEN_ORIGIN',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'NO_REFRESH_TOKEN',
    'INVALID_REFRESH_TOKEN',
  ].includes(normalized);
}

function shouldAttemptRefresh(endpoint: string, responseStatus: number, payload: ApiErrorPayload): boolean {
  if (endpoint === '/api/auth/refresh' || endpoint === '/api/auth/logout') return false;
  if (responseStatus === 401 || responseStatus === 403) return true;
  return isAuthOrAuthzCode(extractErrorCode(payload));
}

export interface AppSettingsDto {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
  otpLoginDisabledWorkbench: boolean;
  googleOAuthAvailable: boolean;
}

export interface GoogleConfigDto {
  clientId: string | null;
  available: boolean;
}

// Circuit breaker for consecutive auth failures
let consecutiveAuthFailures = 0;
const CIRCUIT_BREAK_THRESHOLD = 3;

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
  options: RequestInit = {},
  allowRefresh = true
): Promise<ApiResponse<T>> {
  try {
    const response = await apiFetch(endpoint, options, allowRefresh);
    const data = await parseJsonSafe<ApiResponse<T>>(response);

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After')) || 60;
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: data?.error?.message || 'Too many attempts. Please wait before trying again.',
          retryAfter,
        },
      } as ApiResponse<T>;
    }

    if (data) {
      return data;
    }

    return {
      success: response.ok,
      error: response.ok
        ? undefined
        : {
            code: `HTTP_${response.status}`,
            message: 'Request failed',
          },
    };
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

/**
 * Shared low-level fetch wrapper used by all API modules.
 * Handles cache busting, auth/authz refresh attempts, and absolute/relative URLs.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<Response> {
  const isAuthEndpoint = endpoint.startsWith('/api/auth/');

  let token = getAccessToken();
  // Reload recovery path: when access token is missing but refresh cookie is valid,
  // refresh before the first protected API call to avoid initial 401 bursts.
  if (!token && allowRefresh && !isAuthEndpoint) {
    try {
      const { useAuthStore } = await import('../stores/authStore');
      const authState = useAuthStore.getState();
      if (authState.isAuthenticated && !authState.isGuest) {
        const refreshed = await authState.refreshSession();
        if (refreshed) {
          token = getAccessToken();
        }
      }
    } catch {
      // Keep request path resilient; regular 401 handling remains below.
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...options.headers
  };

  // Add auth token if available
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    let response = await fetch(resolveRequestUrl(endpoint), {
      ...options,
      headers,
      credentials: 'include', // Include cookies for refresh token
      cache: 'no-store'
    });

    // Defensive retry for stale cache validators returning 304 w/o body.
    if (response.status === 304) {
      response = await fetch(resolveRequestUrl(withNoCacheParam(endpoint)), {
        ...options,
        headers,
        credentials: 'include',
        cache: 'reload',
      });
    }

    if (response.ok) {
      consecutiveAuthFailures = 0;
    }

    const errorPayload = response.ok
      ? null
      : await parseJsonSafe<ApiResponse<unknown>>(
          typeof response.clone === 'function' ? response.clone() : response
        );

    if (allowRefresh && shouldAttemptRefresh(endpoint, response.status, errorPayload)) {
      if (consecutiveAuthFailures >= CIRCUIT_BREAK_THRESHOLD) {
        console.log(JSON.stringify({
          event: 'resilience.circuit_break',
          endpoint,
          failures: consecutiveAuthFailures,
          action: 'force_reauth',
        }));
        consecutiveAuthFailures = 0;
        clearTokens();
        fireOnUnauthenticated();
        return response;
      }

      const errorCode = extractErrorCode(errorPayload) || (response.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');
      const errorMessage =
        errorPayload?.error?.message ||
        (response.status === 403 ? 'Authorization failed' : 'Authentication required');
      const { useAuthStore } = await import('../stores/authStore');
      const refreshed = await useAuthStore.getState().handleApiError({
        code: errorCode,
        message: errorMessage,
      });

      if (refreshed) {
        consecutiveAuthFailures = 0;
        const persistedToken = localStorage.getItem('accessToken');
        if (persistedToken && persistedToken !== getAccessToken()) {
          setAccessToken(persistedToken);
        }
        return apiFetch(endpoint, options, false);
      }

      consecutiveAuthFailures++;

      if (response.status === 401) {
        clearTokens();
        fireOnUnauthenticated();
      }
    }

    return response;
  } catch (error) {
    console.error('[API] Request failed:', error);
    throw error;
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
    apiRequest<import('../types').AuthenticatedUser>('/api/auth/me'),

  googleLogin: (credential: string, surface: 'chat' | 'workbench', invitationCode?: string) =>
    apiRequest<{
      accessToken: string;
      user: import('../types').AuthenticatedUser;
      isNewUser: boolean;
      status?: string;
      message?: string;
    }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, surface, invitationCode })
    }),

  getGoogleConfig: () =>
    apiRequest<GoogleConfigDto>('/api/auth/google/config')
};

// ============================================
// Public Settings API
// ============================================

export const settingsApi = {
  getPublic: () => apiRequest<AppSettingsDto>('/api/settings')
};

export default {
  auth: authApi,
  settings: settingsApi,
  setAccessToken,
  getAccessToken,
  clearTokens
};

