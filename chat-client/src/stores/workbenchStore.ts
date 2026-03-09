import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Session, ChatMessage, Tag, Annotation, UserRole, Permission } from '../types';
import { usersApi, UsersListParams, sessionsAdminApi, tagsAdminApi, SessionsListParams } from '../services/api';
import { useAuthStore } from './authStore';

/**
 * Helper function to retry API calls after token refresh
 */
async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  response: T & { success?: boolean; error?: { code?: string; message?: string } }
): Promise<T> {
  // Check if response indicates auth error
  if (!response.success && response.error) {
    const refreshed = await useAuthStore.getState().handleApiError(response.error);
    
    if (refreshed) {
      // Token refreshed successfully, retry the API call
      return await apiCall();
    }
  }
  
  return response;
}

interface WorkbenchState {
  // PII Masking
  piiMasked: boolean;
  togglePIIMask: () => void;
  setPIIMasked: (masked: boolean) => void;
  
  // Users
  users: User[];
  selectedUser: User | null;
  usersLoading: boolean;
  usersError: string | null;
  usersPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  fetchUsers: (params?: UsersListParams) => Promise<void>;
  selectUser: (userId: string | null) => void;
  blockUser: (userId: string, reason?: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<boolean>;
  changeUserRole: (userId: string, role: UserRole) => Promise<boolean>;
  
  // Sessions
  sessions: Session[];
  selectedSession: Session | null;
  sessionsLoading: boolean;
  sessionsError: string | null;
  sessionsPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  fetchSessions: (params?: SessionsListParams) => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  updateSessionStatus: (sessionId: string, status: Session['moderationStatus']) => void;
  
  // Messages (for selected session)
  sessionMessages: ChatMessage[];
  fetchSessionMessages: (sessionId: string) => Promise<void>;
  
  // Tags
  tags: Tag[];
  fetchTags: () => Promise<void>;
  addTagToSession: (sessionId: string, tagName: string) => void;
  removeTagFromSession: (sessionId: string, tagName: string) => void;
  
  // Annotations
  annotations: Annotation[];
  fetchAnnotations: (sessionId: string) => Promise<void>;
  saveAnnotation: (annotation: Partial<Annotation>) => void;
  
  // GDPR Actions
  exportUserData: (userId: string) => Promise<{ jobId: string }>;
  eraseUserData: (userId: string, reason: string) => Promise<boolean>;
}

function toDate(value: any): Date {
  if (!value) return new Date(0);
  return value instanceof Date ? value : new Date(value);
}

function apiSessionToSession(apiSession: any): Session {
  const startedAt = toDate(apiSession.startedAt);
  const endedAt = apiSession.endedAt ? toDate(apiSession.endedAt) : null;
  const duration =
    endedAt
      ? endedAt.getTime() - startedAt.getTime()
      : apiSession.status === 'active'
        ? Date.now() - startedAt.getTime()
        : undefined;

  return {
    id: apiSession.id,
    userId: apiSession.userId ?? null,
    dialogflowSessionId: apiSession.dialogflowSessionId,
    status: apiSession.status,
    startedAt,
    endedAt,
    messageCount: apiSession.messageCount ?? 0,
    moderationStatus: apiSession.moderationStatus ?? 'pending',
    tags: Array.isArray(apiSession.tags) ? apiSession.tags : [],
    userName: apiSession.userName ?? undefined,
    duration,
    createdAt: toDate(apiSession.createdAt),
    updatedAt: toDate(apiSession.updatedAt)
  };
}

function storedConversationToChatMessages(conversation: import('../types/conversation').StoredConversation): ChatMessage[] {
  return conversation.messages.map((m) => {
    const ts = new Date(m.timestamp);
    return {
      id: m.id,
      sessionId: conversation.sessionId,
      role: m.role,
      content: m.content,
      timestamp: ts,
      feedback: m.feedback
        ? {
            rating: m.feedback.rating,
            comment: m.feedback.comment,
            submittedAt: new Date(m.feedback.submittedAt)
          }
        : null,
      metadata: {
        intent: m.intent?.displayName,
        confidence: m.intent?.confidence,
        responseTimeMs: m.responseTimeMs,
        parameters: m.match?.parameters,
        intentInfo: m.intent as any,
        match: m.match as any,
        generativeInfo: m.generativeInfo as any,
        webhookStatuses: m.webhookStatuses as any,
        diagnosticInfo: m.diagnosticInfo as any,
        sentiment: m.sentiment as any,
        flowInfo: m.flowInfo as any,
        systemPrompts: (m as any).systemPrompts
      },
      tags: [],
      createdAt: ts,
      updatedAt: ts
    };
  });
}

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get) => ({
      // PII Masking - default to ON for safety
      piiMasked: true,
      togglePIIMask: () =>
        set((state) => {
          const canViewPii =
            useAuthStore.getState().user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;

          // Without permission, always force masked to avoid accidental reveal
          if (!canViewPii) return { piiMasked: true };

          return { piiMasked: !state.piiMasked };
        }),
      setPIIMasked: (masked: boolean) => set({ piiMasked: masked }),
      
      // Users
      users: [],
      selectedUser: null,
      usersLoading: false,
      usersError: null,
      usersPagination: {
        page: 1,
        limit: 10,
        total: 0,
        hasMore: false
      },
      
      fetchUsers: async (params: UsersListParams = {}) => {
        set({ usersLoading: true, usersError: null });
        
        try {
          let response = await usersApi.list(params);
          response = await retryApiCall(() => usersApi.list(params), response);
          
          if (response.success && response.data) {
            set({ 
              users: response.data,
              usersLoading: false,
              usersPagination: {
                page: response.meta?.page || 1,
                limit: response.meta?.limit || 10,
                total: response.meta?.total || response.data.length,
                hasMore: response.meta?.hasMore || false
              }
            });
          } else {
            set({ 
              usersError: response.error?.message || 'Failed to fetch users',
              usersLoading: false 
            });
          }
        } catch (error) {
          console.error('Error fetching users:', error);
          set({ 
            usersError: 'Failed to fetch users',
            usersLoading: false 
          });
        }
      },
      
      selectUser: async (userId: string | null) => {
        if (!userId) {
          set({ selectedUser: null });
          return;
        }
        
        // First check if user is in current list
        const cachedUser = get().users.find(u => u.id === userId);
        if (cachedUser) {
          set({ selectedUser: cachedUser });
          return;
        }
        
        // Fetch from API
        try {
          let response = await usersApi.getById(userId);
          response = await retryApiCall(() => usersApi.getById(userId), response);
          
          if (response.success && response.data) {
            set({ selectedUser: response.data });
          } else {
            set({ selectedUser: null });
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          set({ selectedUser: null });
        }
      },
      
      blockUser: async (userId: string, reason: string = 'Blocked by administrator') => {
        try {
          let response = await usersApi.block(userId, reason);
          response = await retryApiCall(() => usersApi.block(userId, reason), response);
          
          if (response.success && response.data) {
            set(state => ({
              users: state.users.map(u =>
                u.id === userId ? response.data! : u
              ),
              selectedUser: state.selectedUser?.id === userId
                ? response.data
                : state.selectedUser
            }));
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error blocking user:', error);
          return false;
        }
      },
      
      unblockUser: async (userId: string) => {
        try {
          let response = await usersApi.unblock(userId);
          response = await retryApiCall(() => usersApi.unblock(userId), response);
          
          if (response.success && response.data) {
            set(state => ({
              users: state.users.map(u =>
                u.id === userId ? response.data! : u
              ),
              selectedUser: state.selectedUser?.id === userId
                ? response.data
                : state.selectedUser
            }));
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error unblocking user:', error);
          return false;
        }
      },
      
      changeUserRole: async (userId: string, role: UserRole) => {
        try {
          let response = await usersApi.changeRole(userId, role);
          response = await retryApiCall(() => usersApi.changeRole(userId, role), response);
          
          if (response.success && response.data) {
            set(state => ({
              users: state.users.map(u =>
                u.id === userId ? response.data! : u
              ),
              selectedUser: state.selectedUser?.id === userId
                ? response.data
                : state.selectedUser
            }));
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error changing user role:', error);
          return false;
        }
      },
      
      // Sessions (still using mocks for now)
      sessions: [],
      selectedSession: null,
      sessionsLoading: false,
      sessionsError: null,
      sessionsPagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false
      },
      
      fetchSessions: async (params: SessionsListParams = {}) => {
        // Historical: dashboard expects a larger sample; keep default higher unless UI passes a specific limit.
        const effectiveParams: SessionsListParams = { limit: 100, ...params };
        set({ sessionsLoading: true, sessionsError: null });
        try {
          let response = await sessionsAdminApi.list(effectiveParams);
          response = await retryApiCall(() => sessionsAdminApi.list(effectiveParams), response as any);

          if (response.success && response.data) {
            const sessions = response.data.map(apiSessionToSession);
            set({
              sessions,
              sessionsLoading: false,
              sessionsPagination: {
                page: response.meta?.page || 1,
                limit: response.meta?.limit || (effectiveParams.limit ?? 20),
                total: response.meta?.total || response.data.length,
                hasMore: response.meta?.hasMore || false
              }
            });
          } else {
            console.warn('[Workbench] Failed to fetch sessions:', response.error);
            set({
              sessions: [],
              sessionsLoading: false,
              sessionsError: response.error?.message || 'Failed to fetch sessions',
              sessionsPagination: {
                page: effectiveParams.page ?? 1,
                limit: effectiveParams.limit ?? 20,
                total: 0,
                hasMore: false
              }
            });
          }
        } catch (error) {
          console.error('[Workbench] Error fetching sessions:', error);
          set({
            sessions: [],
            sessionsLoading: false,
            sessionsError: 'Failed to fetch sessions',
            sessionsPagination: {
              page: effectiveParams.page ?? 1,
              limit: effectiveParams.limit ?? 20,
              total: 0,
              hasMore: false
            }
          });
        }
      },
      
      selectSession: (sessionId: string | null) => {
        if (!sessionId) {
          set({ selectedSession: null, sessionMessages: [], annotations: [] });
          return;
        }
        const cached = get().sessions.find(s => s.id === sessionId);
        if (cached) {
          set({ selectedSession: cached });
          get().fetchSessionMessages(cached.id);
          get().fetchAnnotations(cached.id);
          return;
        }

        // Fallback: fetch session by id (don't block UI)
        void (async () => {
          try {
            let response = await sessionsAdminApi.getById(sessionId);
            response = await retryApiCall(() => sessionsAdminApi.getById(sessionId), response as any);

            if (response.success && response.data) {
              const session = apiSessionToSession(response.data);
              set(state => ({
                sessions: state.sessions.some(s => s.id === session.id) ? state.sessions : [session, ...state.sessions],
                selectedSession: session
              }));
              get().fetchSessionMessages(session.id);
              get().fetchAnnotations(session.id);
            } else {
              set({ selectedSession: null, sessionMessages: [], annotations: [] });
            }
          } catch (error) {
            console.error('[Workbench] Error selecting session:', error);
            set({ selectedSession: null, sessionMessages: [], annotations: [] });
          }
        })();
      },
      
      updateSessionStatus: (sessionId: string, status: Session['moderationStatus']) => {
        void (async () => {
          try {
            let response = await sessionsAdminApi.updateModerationStatus(sessionId, status);
            response = await retryApiCall(() => sessionsAdminApi.updateModerationStatus(sessionId, status), response as any);

            if (response.success && response.data) {
              const updated = apiSessionToSession(response.data);
              set(state => ({
                sessions: state.sessions.map(s => (s.id === sessionId ? updated : s)),
                selectedSession: state.selectedSession?.id === sessionId ? updated : state.selectedSession
              }));
            }
          } catch (error) {
            console.error('[Workbench] Error updating session status:', error);
          }
        })();
      },
      
      // Messages
      sessionMessages: [],
      
      fetchSessionMessages: async (sessionId: string) => {
        try {
          let response = await sessionsAdminApi.getConversation(sessionId);
          response = await retryApiCall(() => sessionsAdminApi.getConversation(sessionId), response as any);

          if (response.success && response.data) {
            set({ sessionMessages: storedConversationToChatMessages(response.data) });
          } else {
            set({ sessionMessages: [] });
          }
        } catch (error) {
          console.error('[Workbench] Error fetching session messages:', error);
          set({ sessionMessages: [] });
        }
      },
      
      // Tags
      tags: [],
      
      fetchTags: async () => {
        try {
          let response = await tagsAdminApi.list();
          response = await retryApiCall(() => tagsAdminApi.list(), response as any);
          if (response.success && response.data) {
            // API returns dates as strings -> normalize
            const tags: Tag[] = response.data.map((t: any) => ({
              ...t,
              createdAt: toDate(t.createdAt),
              updatedAt: toDate(t.updatedAt)
            }));
            set({ tags });
          } else {
            set({ tags: [] });
          }
        } catch (error) {
          console.error('[Workbench] Error fetching tags:', error);
          set({ tags: [] });
        }
      },
      
      addTagToSession: (sessionId: string, tagName: string) => {
        if (!tagName.trim()) return;
        void (async () => {
          try {
            let response = await sessionsAdminApi.addTag(sessionId, tagName);
            response = await retryApiCall(() => sessionsAdminApi.addTag(sessionId, tagName), response as any);
            if (response.success && response.data) {
              const updated = apiSessionToSession(response.data);
              set(state => ({
                sessions: state.sessions.map(s => (s.id === sessionId ? updated : s)),
                selectedSession: state.selectedSession?.id === sessionId ? updated : state.selectedSession
              }));
            }
          } catch (error) {
            console.error('[Workbench] Error adding tag:', error);
          }
        })();
      },
      
      removeTagFromSession: (sessionId: string, tagName: string) => {
        void (async () => {
          try {
            let response = await sessionsAdminApi.removeTag(sessionId, tagName);
            response = await retryApiCall(() => sessionsAdminApi.removeTag(sessionId, tagName), response as any);
            if (response.success && response.data) {
              const updated = apiSessionToSession(response.data);
              set(state => ({
                sessions: state.sessions.map(s => (s.id === sessionId ? updated : s)),
                selectedSession: state.selectedSession?.id === sessionId ? updated : state.selectedSession
              }));
            }
          } catch (error) {
            console.error('[Workbench] Error removing tag:', error);
          }
        })();
      },
      
      // Annotations
      annotations: [],
      
      fetchAnnotations: async (sessionId: string) => {
        try {
          let response = await sessionsAdminApi.listAnnotations(sessionId);
          response = await retryApiCall(() => sessionsAdminApi.listAnnotations(sessionId), response as any);
          if (response.success && response.data) {
            const annotations: Annotation[] = response.data.map((a: any) => ({
              ...a,
              createdAt: toDate(a.createdAt),
              updatedAt: toDate(a.updatedAt)
            }));
            set({ annotations });
          } else {
            set({ annotations: [] });
          }
        } catch (error) {
          console.error('[Workbench] Error fetching annotations:', error);
          set({ annotations: [] });
        }
      },
      
      saveAnnotation: (annotation: Partial<Annotation>) => {
        const sessionId = annotation.sessionId;
        if (!sessionId) return;
        const qualityRating = (annotation.qualityRating || 3) as 1 | 2 | 3 | 4 | 5;

        void (async () => {
          try {
            let response = await sessionsAdminApi.createAnnotation(sessionId, {
              messageId: annotation.messageId || null,
              qualityRating,
              goldenReference: annotation.goldenReference || null,
              notes: annotation.notes || '',
              tags: annotation.tags || []
            });
            response = await retryApiCall(
              () =>
                sessionsAdminApi.createAnnotation(sessionId, {
                  messageId: annotation.messageId || null,
                  qualityRating,
                  goldenReference: annotation.goldenReference || null,
                  notes: annotation.notes || '',
                  tags: annotation.tags || []
                }),
              response as any
            );

            if (response.success) {
              await get().fetchAnnotations(sessionId);
            }
          } catch (error) {
            console.error('[Workbench] Error saving annotation:', error);
          }
        })();
      },
      
      // GDPR Actions
      exportUserData: async (userId: string) => {
        try {
          let response = await usersApi.requestExport(userId);
          response = await retryApiCall(() => usersApi.requestExport(userId), response);
          
          if (response.success && response.data) {
            return { jobId: response.data.jobId };
          }
          
          throw new Error(response.error?.message || 'Export failed');
        } catch (error) {
          console.error('[GDPR] Export error:', error);
          // Fallback to mock for now
          const jobId = `export_${userId}_${Date.now()}`;
          return { jobId };
        }
      },
      
      eraseUserData: async (userId: string, reason: string) => {
        try {
          let response = await usersApi.eraseData(userId, reason);
          response = await retryApiCall(() => usersApi.eraseData(userId, reason), response);
          
          if (response.success && response.data) {
            // Update local state with anonymized user
            set(state => ({
              users: state.users.map(u =>
                u.id === userId ? response.data! : u
              ),
              selectedUser: state.selectedUser?.id === userId
                ? response.data
                : state.selectedUser
            }));
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('[GDPR] Erase error:', error);
          return false;
        }
      }
    }),
    {
      name: 'workbench-storage',
      partialize: (state) => ({ piiMasked: state.piiMasked })
    }
  )
);
