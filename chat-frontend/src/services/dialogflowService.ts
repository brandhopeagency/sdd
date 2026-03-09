/**
 * Dialogflow CX Service
 * 
 * This service handles communication with the Dialogflow CX API
 * through the backend proxy server.
 */

import { API_ENDPOINTS, generateDialogflowSessionId } from '../config/dialogflow';
import { apiFetch } from './api';

export interface DialogflowResponse {
  messages: string[];
  intent: string;
  confidence: number;
  parameters: Record<string, unknown>;
  responseTime: number;
}

export interface ChatRequest {
  sessionId: string;
  text: string;
  languageCode: string;
}

/**
 * Send a message to Dialogflow CX and get a response
 */
export async function sendMessage(
  sessionId: string,
  text: string,
  languageCode: string = 'uk'
): Promise<DialogflowResponse> {
  const dialogflowSessionId = generateDialogflowSessionId(sessionId);
  
  const response = await apiFetch(API_ENDPOINTS.chat, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: dialogflowSessionId,
      text,
      languageCode
    } as ChatRequest)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check the health of the backend proxy
 */
export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
  dialogflow: {
    projectId: string;
    location: string;
    agentId: string;
  };
}> {
  const response = await apiFetch(API_ENDPOINTS.health, { method: 'GET' }, false);
  
  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }
  
  return response.json();
}

