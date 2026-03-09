import { apiFetch } from './api';
import type { PendingSurvey, SurveyResponse, SurveyAnswer } from '@mentalhelpglobal/chat-types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await apiFetch(endpoint, options);
    return (await response.json()) as ApiResponse<T>;
  } catch (error) {
    console.error('[SurveyGateApi] Request failed:', error);
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Failed to connect' } };
  }
}

export const surveyGateApi = {
  gateCheck: () =>
    apiRequest<PendingSurvey[]>('/api/chat/gate-check'),

  getResponse: (instanceId: string) =>
    apiRequest<SurveyResponse>(`/api/chat/survey-responses/${instanceId}`),

  submitResponse: (instanceId: string, answers: SurveyAnswer[], isComplete: boolean) =>
    apiRequest<SurveyResponse>('/api/chat/survey-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, answers, isComplete }),
    }),

  savePartial: (responseId: string, answers: SurveyAnswer[]) =>
    apiRequest<SurveyResponse>(`/api/chat/survey-responses/${responseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }),
};
