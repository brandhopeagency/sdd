import { apiFetch } from '@mentalhelpglobal/chat-frontend-common';
import type {
  SurveySchema,
  SurveySchemaListItem,
  SurveyInstance,
  SurveyInstanceListItem,
  SurveyQuestionInput,
  SurveyResponse,
  SchemaExportFormat,
} from '@mentalhelpglobal/chat-types';

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
    console.error('[SurveyApi] Request failed:', error);
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Failed to connect' } };
  }
}

// ── Schema endpoints ──

export const surveySchemaApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return apiRequest<SurveySchemaListItem[]>(`/api/workbench/survey-schemas${qs}`);
  },

  get: (id: string) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}`),

  create: (title: string, description?: string, questions?: SurveyQuestionInput[]) =>
    apiRequest<SurveySchema>('/api/workbench/survey-schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, questions: questions ?? [] }),
    }),

  update: (id: string, updates: { title?: string; description?: string; questions?: SurveyQuestionInput[] }) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),

  publish: (id: string) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}/publish`, { method: 'POST' }),

  archive: (id: string) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}/archive`, { method: 'POST' }),

  restore: (id: string) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}/restore`, { method: 'POST' }),

  clone: (id: string) =>
    apiRequest<SurveySchema>(`/api/workbench/survey-schemas/${id}/clone`, { method: 'POST' }),

  delete: (id: string) =>
    apiRequest<{ deleted: boolean }>(`/api/workbench/survey-schemas/${id}`, { method: 'DELETE' }),

  import: (data: SchemaExportFormat) =>
    apiRequest<SurveySchema>('/api/workbench/survey-schemas/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ── Instance endpoints ──

export const surveyInstanceApi = {
  list: (status?: string, schemaId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (schemaId) params.set('schemaId', schemaId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<SurveyInstanceListItem[]>(`/api/workbench/survey-instances${qs}`);
  },

  get: (id: string) =>
    apiRequest<SurveyInstance>(`/api/workbench/survey-instances/${id}`),

  create: (data: {
    schemaId: string;
    groupIds: string[];
    addToMemory?: boolean;
    publicHeader?: string;
    showReview?: boolean;
    startDate: string;
    expirationDate: string;
  }) =>
    apiRequest<SurveyInstance>('/api/workbench/survey-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  close: (id: string) =>
    apiRequest<SurveyInstance>(`/api/workbench/survey-instances/${id}/close`, { method: 'POST' }),

  listResponses: (instanceId: string) =>
    apiRequest<SurveyResponse[]>(`/api/workbench/survey-instances/${instanceId}/responses`),

  invalidateInstance: (instanceId: string, reason?: string) =>
    apiRequest<{ affected: number }>(`/api/workbench/survey-instances/${instanceId}/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),

  invalidateGroup: (instanceId: string, groupId: string, reason?: string) =>
    apiRequest<{ affected: number }>(`/api/workbench/survey-instances/${instanceId}/invalidate-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, reason }),
    }),
};

export const surveyResponseApi = {
  invalidate: (responseId: string, reason?: string) =>
    apiRequest<{ affected: number }>(`/api/workbench/survey-responses/${responseId}/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
};

// ── Group survey endpoints ──

interface GroupSurveyOrderItem {
  instanceId: string;
  title: string;
  publicHeader: string | null;
  status: string;
  displayOrder: number;
  startDate: string;
  expirationDate: string;
  completedCount: number;
  showReview: boolean;
}

export const groupSurveyApi = {
  list: (groupId: string) =>
    apiRequest<GroupSurveyOrderItem[]>(`/api/workbench/groups/${groupId}/surveys`),

  updateOrder: (groupId: string, instanceIds: string[]) =>
    apiRequest<void>(`/api/workbench/groups/${groupId}/surveys/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds }),
    }),

  downloadResponses: async (instanceId: string, groupId: string, format: 'json' | 'csv') => {
    try {
      const response = await apiFetch(
        `/api/workbench/survey-instances/${instanceId}/responses/download?groupId=${groupId}&format=${format}`,
      );
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `responses.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true as const };
    } catch (error) {
      console.error('[SurveyApi] Download failed:', error);
      return { success: false as const, error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download' } };
    }
  },
};
