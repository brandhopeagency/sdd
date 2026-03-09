import { create } from 'zustand';
import type {
  SurveySchema,
  SurveySchemaListItem,
  SurveyInstance,
  SurveyInstanceListItem,
  SurveyQuestionInput,
  SurveyResponse,
} from '@mentalhelpglobal/chat-types';
import { surveySchemaApi, surveyInstanceApi, surveyResponseApi } from '@/services/surveyApi';

interface SurveyState {
  schemas: SurveySchemaListItem[];
  schemasLoading: boolean;
  schemasError: string | null;

  currentSchema: SurveySchema | null;
  currentSchemaLoading: boolean;

  instances: SurveyInstanceListItem[];
  instancesLoading: boolean;
  instancesError: string | null;

  currentInstance: SurveyInstance | null;
  currentInstanceLoading: boolean;

  responses: SurveyResponse[];
  responsesLoading: boolean;

  fetchSchemas: (status?: string) => Promise<void>;
  fetchSchema: (id: string) => Promise<void>;
  createSchema: (title: string, description?: string, questions?: SurveyQuestionInput[]) => Promise<SurveySchema | null>;
  updateSchema: (id: string, updates: { title?: string; description?: string; questions?: SurveyQuestionInput[] }) => Promise<SurveySchema | null>;
  publishSchema: (id: string) => Promise<boolean>;
  archiveSchema: (id: string) => Promise<boolean>;
  restoreSchema: (id: string) => Promise<boolean>;
  cloneSchema: (id: string) => Promise<SurveySchema | null>;
  deleteSchema: (id: string) => Promise<boolean>;

  fetchInstances: (status?: string, schemaId?: string) => Promise<void>;
  fetchInstance: (id: string) => Promise<void>;
  createInstance: (data: {
    schemaId: string;
    groupIds: string[];
    addToMemory?: boolean;
    publicHeader?: string;
    showReview?: boolean;
    startDate: string;
    expirationDate: string;
  }) => Promise<SurveyInstance | null>;
  closeInstance: (id: string) => Promise<boolean>;
  fetchResponses: (instanceId: string) => Promise<void>;
  invalidateInstance: (instanceId: string, reason?: string) => Promise<boolean>;
  invalidateGroup: (instanceId: string, groupId: string, reason?: string) => Promise<boolean>;
  invalidateResponse: (responseId: string, reason?: string) => Promise<boolean>;
}

export const useSurveyStore = create<SurveyState>((set) => ({
  schemas: [],
  schemasLoading: false,
  schemasError: null,
  currentSchema: null,
  currentSchemaLoading: false,
  instances: [],
  instancesLoading: false,
  instancesError: null,
  currentInstance: null,
  currentInstanceLoading: false,
  responses: [],
  responsesLoading: false,

  fetchSchemas: async (status) => {
    set({ schemasLoading: true, schemasError: null });
    const res = await surveySchemaApi.list(status);
    set({
      schemas: res.success ? res.data ?? [] : [],
      schemasLoading: false,
      schemasError: res.success ? null : res.error?.message ?? 'Failed to load schemas',
    });
  },

  fetchSchema: async (id) => {
    set({ currentSchemaLoading: true });
    const res = await surveySchemaApi.get(id);
    set({ currentSchema: res.success ? res.data ?? null : null, currentSchemaLoading: false });
  },

  createSchema: async (title, description, questions) => {
    const res = await surveySchemaApi.create(title, description, questions);
    return res.success ? res.data ?? null : null;
  },

  updateSchema: async (id, updates) => {
    const res = await surveySchemaApi.update(id, updates);
    if (res.success && res.data) set({ currentSchema: res.data });
    return res.success ? res.data ?? null : null;
  },

  publishSchema: async (id) => {
    const res = await surveySchemaApi.publish(id);
    if (res.success && res.data) set({ currentSchema: res.data });
    return res.success;
  },

  archiveSchema: async (id) => {
    const res = await surveySchemaApi.archive(id);
    return res.success;
  },

  restoreSchema: async (id) => {
    const res = await surveySchemaApi.restore(id);
    return res.success;
  },

  cloneSchema: async (id) => {
    const res = await surveySchemaApi.clone(id);
    return res.success ? res.data ?? null : null;
  },

  deleteSchema: async (id) => {
    const res = await surveySchemaApi.delete(id);
    return res.success;
  },

  fetchInstances: async (status, schemaId) => {
    set({ instancesLoading: true, instancesError: null });
    const res = await surveyInstanceApi.list(status, schemaId);
    set({
      instances: res.success ? res.data ?? [] : [],
      instancesLoading: false,
      instancesError: res.success ? null : res.error?.message ?? 'Failed to load instances',
    });
  },

  fetchInstance: async (id) => {
    set({ currentInstanceLoading: true });
    const res = await surveyInstanceApi.get(id);
    set({ currentInstance: res.success ? res.data ?? null : null, currentInstanceLoading: false });
  },

  createInstance: async (data) => {
    const res = await surveyInstanceApi.create(data);
    return res.success ? res.data ?? null : null;
  },

  closeInstance: async (id) => {
    const res = await surveyInstanceApi.close(id);
    return res.success;
  },

  fetchResponses: async (instanceId) => {
    set({ responsesLoading: true });
    const res = await surveyInstanceApi.listResponses(instanceId);
    set({ responses: res.success ? res.data ?? [] : [], responsesLoading: false });
  },

  invalidateInstance: async (instanceId, reason) => {
    const res = await surveyInstanceApi.invalidateInstance(instanceId, reason);
    return res.success;
  },

  invalidateGroup: async (instanceId, groupId, reason) => {
    const res = await surveyInstanceApi.invalidateGroup(instanceId, groupId, reason);
    return res.success;
  },

  invalidateResponse: async (responseId, reason) => {
    const res = await surveyResponseApi.invalidate(responseId, reason);
    return res.success;
  },
}));
