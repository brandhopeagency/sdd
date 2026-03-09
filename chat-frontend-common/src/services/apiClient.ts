/**
 * Surface-aware API base URL.
 *
 * URLs are resolved at runtime via `configureApi()` called by the consuming app.
 */

import { getConfiguredApiUrl, getConfiguredWorkbenchApiUrl } from '../config';

function getSurface(): 'chat' | 'workbench' {
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('workbench.')) {
    return 'workbench';
  }
  return 'chat';
}

export function getApiBaseUrl(): string {
  return getSurface() === 'workbench' ? getConfiguredWorkbenchApiUrl() : getConfiguredApiUrl();
}

/**
 * Callback invoked when a 401 is received and the refresh attempt fails.
 * Consuming apps register this to clear auth state and redirect to login.
 */
let onUnauthenticatedCallback: (() => void) | null = null;

export function setOnUnauthenticated(cb: (() => void) | null): void {
  onUnauthenticatedCallback = cb;
}

export function fireOnUnauthenticated(): void {
  if (onUnauthenticatedCallback) {
    onUnauthenticatedCallback();
  }
}
