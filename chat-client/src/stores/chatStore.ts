import { create } from 'zustand';
import { ChatMessage, Session, MessageFeedback } from '../types';
import type { StoredMessage } from '../types/conversation';
import type { AgentMemorySystemMessage } from '../types/agentMemory';
import i18n from '@/i18n';
import { API_BASE_URL } from '@/config';
import { getAccessToken } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

type MemoryUpdateStatus = 'idle' | 'pending' | 'updated' | 'failed';

/**
 * Helper function to convert headers to plain object
 */
function headersToObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  
  // If it's already a plain object
  if (typeof headers === 'object' && !(headers instanceof Headers) && !Array.isArray(headers)) {
    return headers as Record<string, string>;
  }
  
  // If it's a Headers instance
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  
  // If it's an array of tuples
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    headers.forEach(([key, value]) => {
      obj[key] = value;
    });
    return obj;
  }
  
  return {};
}

/**
 * Helper function to handle API errors and retry with token refresh
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOnAuth: boolean = true
): Promise<Response> {
  const response = await fetch(url, options);
  
  // If 401 and retry is enabled, try to refresh token and retry
  if (response.status === 401 && retryOnAuth) {
    const errorData = await response.clone().json().catch(() => ({ error: { code: 'UNAUTHORIZED' } }));
    const refreshed = await useAuthStore.getState().handleApiError(errorData.error || { code: 'UNAUTHORIZED' });
    
    if (refreshed) {
      // Token refreshed successfully, retry the request with new token
      const token = getAccessToken();
      if (!token) {
        console.warn('[Chat] Token refresh succeeded but no token available for retry');
        return response; // Return original 401 response
      }
      
      // Properly merge headers preserving existing headers
      const existingHeaders = headersToObject(options.headers);
      const retryOptions = {
        ...options,
        headers: {
          ...existingHeaders,
          'Authorization': `Bearer ${token}`
        }
      };
      
      return fetch(url, retryOptions);
    }
  }
  
  return response;
}

interface ChatState {
  // Current session
  session: Session | null;
  messages: ChatMessage[];
  isTyping: boolean;

  // Current user's agent memory (debug/extended access only)
  agentMemory: AgentMemorySystemMessage[] | null;
  agentMemoryLoadedAt: Date | null;
  agentMemoryPrincipalId: string | null;

  // Background memory update watcher (non-blocking UX)
  memoryUpdateStatus: MemoryUpdateStatus;
  memoryUpdateStartedAt: Date | null;
  memoryUpdateError: string | null;
  /**
   * Internal: last watcher params (used to resume polling after circuit breaker).
   */
  memoryWatcherLast: { sessionId: string; baselineUpdatedAt: string | null } | null;
  
  // Actions
  startSession: (userId?: string | null) => Promise<void>;
  endSession: () => Promise<void>;
  endSessionInBackground: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  retryFailedMessage: (messageId: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 1 | 2 | 3 | 4 | 5, comment?: string) => Promise<void>;
  bindSessionToUser: (userId: string) => void;
  fetchCurrentUserMemory: (opts?: { force?: boolean }) => Promise<AgentMemorySystemMessage[]>;
  refreshSessionMemory: (sessionId: string) => Promise<{ memoryCount: number; memoryUpdatedAt: string | null }>;
  beginMemoryUpdateWatcher: (opts: { sessionId: string; baselineUpdatedAt: string | null }) => void;
  resumeMemoryUpdateWatcher: () => void;
}

// Fallback responses if Dialogflow is unavailable
const fallbackResponses: Record<string, string[]> = {
  uk: [
    "Дякую за ваше повідомлення. Чим я можу вам допомогти?",
    "Я вас розумію. Будь ласка, розкажіть більше.",
    "Мені шкода, що сталася технічна помилка. Спробуйте ще раз."
  ],
  en: [
    "Thank you for your message. How can I help you?",
    "I understand. Please tell me more.",
    "I'm sorry, a technical error occurred. Please try again."
  ],
  ru: [
    "Спасибо за ваше сообщение. Чем я могу вам помочь?",
    "Я вас понимаю. Пожалуйста, расскажите подробнее.",
    "Извините, произошла техническая ошибка. Попробуйте еще раз."
  ]
};

const generateSessionId = () => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const isLocalOnlySessionId = (sessionId: string) => sessionId.startsWith('sess_');

let memoryWatcherSeq = 0;

function hasUserMessages(messages: ChatMessage[]): boolean {
  return (messages || []).some((m) => m?.role === 'user');
}

function canShowMemorySnapshot(): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  return ['qa_specialist', 'researcher', 'moderator', 'owner'].includes(user.role);
}

function buildMemorySnapshotText(memory: AgentMemorySystemMessage[]): string {
  const blocks = (memory || [])
    .map((m) => (m?.content || '').trim())
    .filter((t) => t.length > 0);
  return blocks.join('\n\n');
}

// Get initial greeting based on current language
function getGreeting(): string {
  const lang = i18n.language || 'uk';
  const greetings: Record<string, string> = {
    uk: "Вітаю! Я тут, щоб вас підтримати. Це безпечний простір, де ви можете поділитися будь-чим. Як ви себе почуваєте сьогодні?",
    en: "Hello! I'm here to support you. This is a safe space to share whatever is on your mind. How are you feeling today?",
    ru: "Здравствуйте! Я здесь, чтобы поддержать вас. Это безопасное пространство, где вы можете поделиться чем угодно. Как вы себя чувствуете сегодня?"
  };
  return greetings[lang] || greetings.uk;
}

// Get fallback response based on current language
function getFallbackResponse(): string {
  const lang = i18n.language || 'uk';
  const responses = fallbackResponses[lang] || fallbackResponses.uk;
  return responses[Math.floor(Math.random() * responses.length)];
}

export const useChatStore = create<ChatState>((set, get) => ({
  session: null,
  messages: [],
  isTyping: false,
  agentMemory: null,
  agentMemoryLoadedAt: null,
  agentMemoryPrincipalId: null,
  memoryUpdateStatus: 'idle',
  memoryUpdateStartedAt: null,
  memoryUpdateError: null,
  memoryWatcherLast: null,
  
  startSession: async (userId?: string | null) => {
    try {
      // Get effective userId (authenticated user ID or guest ID)
      const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
      console.log('[Chat] Starting session with userId:', effectiveUserId);
      
      // Get access token if available for authenticated users
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add Authorization header if token exists (for authenticated users)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Create session through backend API
      const response = await fetchWithRetry(`${API_BASE_URL}/chat/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          languageCode: i18n.language || 'uk',
          // Pass userId ONLY for guest sessions. Authenticated sessions must rely on the token,
          // otherwise an expired/invalid token would be treated as unauthenticated and the backend
          // would reject non-guest userIds with 400.
          ...(typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_')
            ? { userId: effectiveUserId }
            : {})
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { data } = await response.json();
      
      const session: Session = {
        id: data.id,
        userId: data.userId, // Use authoritative value from backend
        dialogflowSessionId: data.dialogflowSessionId,
        status: 'active',
        startedAt: new Date(data.startedAt),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      };
      
      // Initial greeting: prefer server-provided proactive message (based on memory)
      const greeting: ChatMessage = {
        id: generateMessageId(),
        sessionId: session.id,
        role: 'assistant',
        content: (data.initialAssistantMessage as string | null) || getGreeting(),
        timestamp: new Date(),
        feedback: null,
        metadata: {
          intent: 'welcome',
          confidence: 1.0,
          responseTimeMs: 0
        },
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      set({ session, messages: [greeting], isTyping: false });

      // Extended roles only: show memory once at the beginning of the session (best-effort).
      // This avoids repeating memory under every assistant response.
      try {
        if (canShowMemorySnapshot()) {
          const tokenNow = getAccessToken();
          if (tokenNow) {
            const memory = await get().fetchCurrentUserMemory({ force: true });
            if (memory && memory.length > 0) {
              const snapshot = buildMemorySnapshotText(memory);
              if (snapshot) {
                const first = memory[0];
                const metaBits = [
                  first?.meta?.aggregatedBy,
                  first?.meta?.llmProvider,
                  first?.meta?.llmModel,
                  first?.meta?.llmLocation
                ]
                  .filter((x): x is string => typeof x === 'string' && x.length > 0)
                  .join(' • ');
                const header = metaBits ? `USER MEMORY (${metaBits})` : 'USER MEMORY';

                const sys: ChatMessage = {
                  id: generateMessageId(),
                  sessionId: session.id,
                  role: 'system',
                  content: `${header}\n\n${snapshot}`,
                  timestamp: new Date(),
                  feedback: null,
                  metadata: {} as any,
                  tags: [],
                  createdAt: new Date(),
                  updatedAt: new Date()
                };

                set((state) => {
                  // Only attach if we're still on this session.
                  if (!state.session || state.session.id !== session.id) return state;
                  // Prepend once.
                  return { ...state, messages: [sys, ...state.messages] };
                });
              }
            }
          }
        }
      } catch {
        // best-effort
      }
    } catch (error) {
      console.error('[Chat] Failed to create session:', error);
      // Fallback to local-only session (no backend persistence)
      const session: Session = {
        id: generateSessionId(),
        userId: userId ?? null,
        dialogflowSessionId: `df_${Date.now()}`,
        status: 'active',
        startedAt: new Date(),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const greeting: ChatMessage = {
        id: generateMessageId(),
        sessionId: session.id,
        role: 'assistant',
        content: getGreeting(),
        timestamp: new Date(),
        feedback: null,
        metadata: {
          intent: 'welcome',
          confidence: 1.0,
          responseTimeMs: 0
        },
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      set({ session, messages: [greeting], isTyping: false });
    }
  },
  
  fetchCurrentUserMemory: async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const { agentMemory, agentMemoryPrincipalId } = get();
    const currentUserId = useAuthStore.getState().user?.id || null;

    // Safety: prevent cross-user memory display if auth user changed.
    if (
      agentMemory &&
      agentMemoryPrincipalId &&
      currentUserId &&
      agentMemoryPrincipalId !== currentUserId
    ) {
      set({ agentMemory: null, agentMemoryLoadedAt: null, agentMemoryPrincipalId: null });
    }

    // IMPORTANT: don't permanently cache "empty memory" as "loaded".
    // Memory is generated on session end; a user may fetch before it exists, then end a session, and expect it to appear.
    if (
      !force &&
      agentMemory &&
      agentMemory.length > 0 &&
      agentMemoryPrincipalId &&
      currentUserId &&
      agentMemoryPrincipalId === currentUserId
    ) {
      return agentMemory;
    }

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/chat/memory`, {
      method: 'GET',
      headers,
      // Prevent conditional requests (ETag/If-None-Match) that can yield 304 without body,
      // which breaks JSON parsing and looks like a failure in the UI.
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const msg =
        payload?.error?.message ||
        payload?.error ||
        `Failed to fetch memory (HTTP ${response.status})`;
      throw new Error(msg);
    }

    const principalId = (payload?.data?.principalId as string | undefined) || null;
    const memory = (payload?.data?.memory as AgentMemorySystemMessage[] | undefined) || [];
    set({ agentMemory: memory, agentMemoryLoadedAt: new Date(), agentMemoryPrincipalId: principalId });
    return memory;
  },

  refreshSessionMemory: async (sessionId: string) => {
    const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/chat/sessions/${sessionId}/memory/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_') ? { userId: effectiveUserId } : {}
      )
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const msg =
        payload?.error?.message ||
        payload?.error ||
        `Failed to refresh session memory (HTTP ${response.status})`;
      throw new Error(msg);
    }

    return {
      memoryCount: Number(payload?.data?.memoryCount || 0),
      memoryUpdatedAt: (payload?.data?.memoryUpdatedAt as string | null) || null
    };
  },

  beginMemoryUpdateWatcher: (opts: { sessionId: string; baselineUpdatedAt: string | null }) => {
    const { sessionId, baselineUpdatedAt } = opts;
    if (isLocalOnlySessionId(sessionId)) return;

    const seq = ++memoryWatcherSeq;
    // Remember last params for resume
    set({ memoryWatcherLast: { sessionId, baselineUpdatedAt } });
    set({
      memoryUpdateStatus: 'pending',
      memoryUpdateStartedAt: new Date(),
      memoryUpdateError: null
    });

    const deadlineMs = Date.now() + 60_000;
    let delayMs = 1000;
    let failures = 0;
    const maxFailures = 6; // circuit breaker threshold (<= 10 to avoid log spam)
    const maxDelayMs = 30_000;

    void (async () => {
      while (Date.now() < deadlineMs && memoryWatcherSeq === seq) {
        try {
          const { memoryUpdatedAt } = await get().refreshSessionMemory(sessionId);
          failures = 0;

          const isNew =
            !!memoryUpdatedAt &&
            (!baselineUpdatedAt || new Date(memoryUpdatedAt).getTime() > new Date(baselineUpdatedAt).getTime());

          if (isNew) {
            set({ memoryUpdateStatus: 'updated', memoryUpdateError: null });

            // Refresh memory cache (best-effort). Do NOT append memory snapshots into the chat stream:
            // memory should only be shown at the beginning of a chat (as a system message), not under each assistant reply.
            try {
              if (canShowMemorySnapshot()) {
                await get().fetchCurrentUserMemory({ force: true });
              }
            } catch {
              // best-effort
            }

            // Auto-clear the banner after a short delay
            setTimeout(() => {
              if (memoryWatcherSeq !== seq) return;
              set({ memoryUpdateStatus: 'idle', memoryUpdateStartedAt: null, memoryUpdateError: null });
            }, 5000);

            return;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to refresh session memory';
          set({ memoryUpdateError: msg });
          failures++;
          if (failures >= maxFailures) {
            console.warn('[Chat] Memory refresh circuit breaker opened after failures:', failures);
            set({
              memoryUpdateStatus: 'failed',
              memoryUpdateError: get().memoryUpdateError || 'Too many failed requests'
            });
            return;
          }
        }

        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 2, maxDelayMs);
      }

      if (memoryWatcherSeq === seq) {
        set({
          memoryUpdateStatus: 'failed',
          memoryUpdateError: get().memoryUpdateError || 'Timed out waiting for memory update'
        });
      }
    })();
  },

  resumeMemoryUpdateWatcher: () => {
    // Only resume if we previously failed.
    if (get().memoryUpdateStatus !== 'failed') return;
    const last = get().memoryWatcherLast;
    if (!last?.sessionId) return;
    // Restart watcher with same params
    get().beginMemoryUpdateWatcher(last);
  },

  endSessionInBackground: async (sessionId: string) => {
    // Local-only sessions are not persisted on backend
    if (isLocalOnlySessionId(sessionId)) return;

    try {
      // If this is the currently loaded session and it has no user messages,
      // don't call backend: 0-message sessions may not exist on the instance that receives the request.
      const current = get().session;
      if (current && current.id === sessionId && !hasUserMessages(get().messages)) {
        return;
      }

      const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
      const token = getAccessToken();
      const headers: Record<string, string> = {};

      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetchWithRetry(`${API_BASE_URL}/chat/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_')
            ? { userId: effectiveUserId }
            : {})
        })
      });

      if (!response.ok) {
        // 0-message sessions are never persisted in DB and may not be found if the request
        // lands on a different Cloud Run instance. Treat as idempotent success.
        if (response.status === 404) return;
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Chat] Failed to end session (background):', response.status, errorData);
      }
    } catch (error) {
      console.error('[Chat] Failed to end session (background):', error);
    }
  },

  endSession: async () => {
    const { session } = get();
    if (!session) return;

    try {
      // Local-only sessions are not persisted on backend
      if (isLocalOnlySessionId(session.id)) {
        set({
          session: null,
          messages: [],
          isTyping: false
        });
        return;
      }

      // If the user never sent a message, close locally without calling backend.
      // (0-message sessions are not guaranteed to exist on the instance that receives /end.)
      if (!hasUserMessages(get().messages)) {
        set({
          session: null,
          messages: [],
          isTyping: false
        });
        return;
      }

      const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
      // Get access token if available (for authenticated users)
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      
      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // End session through backend API
      const response = await fetchWithRetry(`${API_BASE_URL}/chat/sessions/${session.id}/end`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Only required for guest ownership validation
          ...(typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_')
            ? { userId: effectiveUserId }
            : {})
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        // If the request lands on another instance and the session had no messages, it may 404.
        // Also treat repeated /end as idempotent.
        if (response.status === 404) {
          set({ session: null, messages: [], isTyping: false });
          return;
        }
        console.error('[Chat] Failed to end session:', response.status, errorData);
        
        // If 403, it's an authorization issue - don't mark as ended
        if (response.status === 403) {
          throw new Error(errorData.error || 'Access denied: You can only end your own sessions');
        }
        
        // For other errors, still mark as ended locally (session might be ended on server)
      }

      // Clear session and messages after successful end
      set({
        session: null,
        messages: [],
        isTyping: false
      });
    } catch (error) {
      console.error('[Chat] Failed to end session:', error);
      
      // Only clear if it's not an authorization error
      if (!(error instanceof Error && error.message.includes('Access denied'))) {
        // Clear session and messages even on error (to allow new session)
        set({
          session: null,
          messages: [],
          isTyping: false
        });
      } else {
        // Re-throw authorization errors so UI can show them
        throw error;
      }
    }
  },
  
  sendMessage: async (content: string) => {
    const { session } = get();
    
    if (!session) return;

    if (session.status !== 'active') {
      const sys: ChatMessage = {
        id: generateMessageId(),
        sessionId: session.id,
        role: 'system',
        content: 'SESSION CLOSED\n\nThis chat session is no longer active. Please start a new chat session.',
        timestamp: new Date(),
        feedback: null,
        metadata: { system: { kind: 'other', title: 'Session closed' } } as any,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      set((state) => ({ ...state, messages: [...state.messages, sys] }));
      return;
    }

    // Local-only sessions: do not call backend, just use fallback responses
    if (isLocalOnlySessionId(session.id)) {
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        sessionId: session.id,
        role: 'user',
        content,
        timestamp: new Date(),
        feedback: null,
        metadata: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        sessionId: session.id,
        role: 'assistant',
        content: getFallbackResponse(),
        timestamp: new Date(),
        feedback: null,
        metadata: {
          intent: 'local_fallback',
          confidence: 0,
          responseTimeMs: 0
        },
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      set(state => ({
        messages: [...state.messages, userMessage, aiMessage],
        isTyping: false,
        session: state.session
          ? { ...state.session, messageCount: state.session.messageCount + 2, updatedAt: new Date() }
          : null
      }));

      return;
    }
    
    // Get effective userId (authenticated user ID or guest ID)
    const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
    
    // Get access token if available (for authenticated users)
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add Authorization header if token exists (for authenticated users)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Optimistically add user message to UI immediately with unique temp ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const tempUserMessage: ChatMessage = {
      id: tempId,
      sessionId: session.id,
      role: 'user',
      content,
      timestamp: new Date(),
      feedback: null,
      metadata: {
        client: {
          status: 'sending',
          retryable: false,
          originalContent: content
        }
      },
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    set(state => ({ 
      messages: [...state.messages, tempUserMessage],
      isTyping: true
    }));
    
    try {
      // Send message through new backend API
      const response = await fetchWithRetry(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: session.id,
          message: content,
          languageCode: i18n.language || 'uk',
          // Only pass userId for guests; authenticated sessions must rely on token
          ...(typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_')
            ? { userId: effectiveUserId }
            : {})
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errText = payload?.error?.message || payload?.error || '';

        // If the session was closed (by another tab or inactivity timeout), don't fabricate a fallback reply.
        if (
          (response.status === 400 && String(errText) === 'Session is not active') ||
          (response.status === 404 && String(errText) === 'Session not found')
        ) {
          const sys: ChatMessage = {
            id: generateMessageId(),
            sessionId: session.id,
            role: 'system',
            content:
              'SESSION CLOSED\n\nThis chat session was closed (another tab opened a new session or it expired after inactivity). Please start a new chat session.',
            timestamp: new Date(),
            feedback: null,
            metadata: { system: { kind: 'other', title: 'Session closed' } } as any,
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set((state) => ({
            ...state,
            messages: [...state.messages.filter((m) => m.id !== tempId), sys],
            isTyping: false,
            session: state.session ? { ...state.session, status: 'ended', updatedAt: new Date() } : null
          }));

          return;
        }

        throw new Error(String(errText) || `Failed to send message (HTTP ${response.status})`);
      }

      const { data } = await response.json();
      const { userMessage, assistantMessage } = data as { userMessage: StoredMessage; assistantMessage: StoredMessage };

      // Convert StoredMessage to ChatMessage format
      const convertToFrontendMessage = (msg: StoredMessage): ChatMessage => ({
        id: msg.id,
        sessionId: session.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        feedback: null,
        metadata: {
          intent: msg.intent?.displayName, // Keep for backwards compatibility
          confidence: msg.intent?.confidence, // Keep for backwards compatibility
          responseTimeMs: msg.responseTimeMs,
          parameters: msg.match?.parameters,
          // Store all technical details including full intent info
          intentInfo: msg.intent, // Full IntentInfo object
          match: msg.match, // Match information (PLAYBOOK, INTENT, etc.)
          generativeInfo: msg.generativeInfo,
          webhookStatuses: msg.webhookStatuses,
          diagnosticInfo: msg.diagnosticInfo,
          sentiment: msg.sentiment,
          flowInfo: msg.flowInfo,
          systemPrompts: (msg as any).systemPrompts
        } as any, // Cast to any to allow extended metadata properties
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const userMsg = convertToFrontendMessage(userMessage);
      const aiMsg = convertToFrontendMessage(assistantMessage);

      // Replace only THIS specific temp message with real messages
      set(state => ({ 
        messages: [
          ...state.messages.filter(m => m.id !== tempId), // Remove only this temp message by exact ID
          userMsg,
          aiMsg
        ],
        isTyping: false,
        session: state.session ? {
          ...state.session,
          messageCount: state.session.messageCount + 2,
          updatedAt: new Date()
        } : null
      }));

      // Log technical details for debugging
      if (assistantMessage.intent) {
        console.log(`[Dialogflow] Intent: ${assistantMessage.intent.displayName}, Confidence: ${assistantMessage.intent.confidence.toFixed(2)}`);
      }
      if (assistantMessage.match) {
        console.log('[Dialogflow] Match:', assistantMessage.match);
      }
      if (assistantMessage.generativeInfo) {
        console.log('[Dialogflow] Generative Info:', assistantMessage.generativeInfo);
      }
      if (assistantMessage.webhookStatuses) {
        console.log('[Dialogflow] Webhook Statuses:', assistantMessage.webhookStatuses);
      }
      
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';

      // Replace temp message with a failed user message (no fallback assistant response).
      set(state => ({
        ...state,
        messages: [
          ...state.messages.filter(m => m.id !== tempId),
          {
            id: generateMessageId(),
            sessionId: session.id,
            role: 'user',
            content,
            timestamp: new Date(),
            feedback: null,
            metadata: {
              client: {
                status: 'failed',
                error: errorMessage,
                retryable: true,
                originalContent: content
              }
            },
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        isTyping: false
      }));
    }
  },

  retryFailedMessage: async (messageId: string) => {
    const { session, messages } = get();
    if (!session || session.status !== 'active') return;

    const msg = messages.find((m) => m.id === messageId);
    const original = msg?.metadata?.client?.originalContent || msg?.content;
    const isFailed = msg?.metadata?.client?.status === 'failed';
    if (!msg || msg.role !== 'user' || !isFailed || !original) return;

    // Remove the failed message first to avoid duplicates, then resend normally.
    set((state) => ({
      ...state,
      messages: state.messages.filter((m) => m.id !== messageId)
    }));

    await get().sendMessage(original);
  },
  
  submitFeedback: async (messageId: string, rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
    const feedback: MessageFeedback = {
      rating,
      comment: comment || null,
      submittedAt: new Date()
    };
    
    // Update local state immediately for optimistic UI
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    }));
    
    // Send to backend
    try {
      const effectiveUserId = useAuthStore.getState().getEffectiveUserId();
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetchWithRetry(`${API_BASE_URL}/chat/messages/${messageId}/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rating,
          comment: comment || null,
          // Guests must include their guestId for ownership validation
          ...(typeof effectiveUserId === 'string' && effectiveUserId.startsWith('guest_')
            ? { userId: effectiveUserId }
            : {})
        })
      });
      
      if (!response.ok) {
        console.error('[Chat] Failed to submit feedback:', response.status);
        // Revert optimistic update on error
        set(state => ({
          messages: state.messages.map(msg =>
            msg.id === messageId ? { ...msg, feedback: null } : msg
          )
        }));
      }
    } catch (error) {
      console.error('[Chat] Failed to submit feedback:', error);
      // Revert optimistic update on error
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, feedback: null } : msg
        )
      }));
    }
  },
  
  // Bind current guest session to authenticated user
  bindSessionToUser: (userId: string) => {
    const { session } = get();
    if (session) {
      set({
        session: {
          ...session,
          userId,
          updatedAt: new Date()
        }
      });
    }
  }
}));

// Security: prevent cross-user chat leakage in a single SPA session.
// If the authenticated principal changes (logout/login as another user), clear chat state.
// NOTE: In unit tests, auth store may be mocked without zustand APIs. Guard accordingly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authStoreAny: any = useAuthStore as any;
if (typeof authStoreAny.getState === 'function' && typeof authStoreAny.subscribe === 'function') {
  let lastPrincipalId: string | null = authStoreAny.getState()?.user?.id || null;
  authStoreAny.subscribe((state: any) => {
    const nextId = state?.user?.id || null;
    if (nextId !== lastPrincipalId) {
      lastPrincipalId = nextId;
      // Cancel any in-flight memory watcher and wipe chat + memory state.
      memoryWatcherSeq++;
      useChatStore.setState({
        session: null,
        messages: [],
        isTyping: false,
        agentMemory: null,
        agentMemoryLoadedAt: null,
        agentMemoryPrincipalId: null,
        memoryUpdateStatus: 'idle',
        memoryUpdateStartedAt: null,
        memoryUpdateError: null
      });
    }
  });
}
