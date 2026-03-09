/**
 * Dialogflow CX Configuration
 * 
 * This file contains the configuration for connecting to the Dialogflow CX API
 * through the backend proxy server.
 */

// API endpoint for the backend proxy
export const DIALOGFLOW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// API endpoints
export const API_ENDPOINTS = {
  chat: `${DIALOGFLOW_API_URL}/api/chat/message`,
  health: `${DIALOGFLOW_API_URL}/api/health`
};

// Session ID prefix for Dialogflow
export const SESSION_PREFIX = 'mh_';

/**
 * Generate a session ID for Dialogflow
 * Combines a prefix with the provided session ID for namespacing
 */
export function generateDialogflowSessionId(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

