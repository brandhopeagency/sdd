/**
 * API base URL for the chat application.
 */

const CHAT_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export function getApiBaseUrl(): string {
  return CHAT_API_URL;
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
