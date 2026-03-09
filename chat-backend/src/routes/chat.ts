/**
 * Chat API Routes
 * 
 * Endpoints for managing chat sessions and messages
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuthActiveAccount, requireAnyPermission } from '../middleware/auth';
import { getPool } from '../db';
import { Permission } from '../types';
import {
  createSession,
  addMessage,
  endSession,
  getSessionMetadata,
  getActiveConversation,
  listUserSessions,
  markOtherActiveSessionsClosed,
  updateMessageFeedback,
  updateSessionUserId,
  getSessionAgentMemoryMessages,
  setSessionAgentMemoryMessages
} from '../services/session.service';
import { getConversation } from '../services/gcs.service';
import { sendMessageToDialogflow } from '../dialogflow';
import type { StoredMessage } from '../types/conversation';
import { getSettings } from '../services/settings.service';
import { resolveSessionCreatePrincipal } from './chat.sessionCreate';
import {
  generateInitialAssistantMessage,
  isMemoryEnabledPrincipal,
  loadAgentMemory,
  updateAgentMemoryOnSessionEnd
} from '../services/agentMemory/agentMemory.service';

const router = Router();

function isUuid(value: string): boolean {
  // Simple UUID v4-ish check (also accepts other UUID versions)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function ensureGuestAllowed(req: Request, res: Response): Promise<boolean> {
  if (req.user?.id) return true;
  let settings;
  try {
    settings = await getSettings();
  } catch (error) {
    console.error('[Chat API] Failed to load settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load settings' }
    });
    return false;
  }
  if (!settings.guestModeEnabled) {
    res.status(403).json({
      success: false,
      error: { code: 'GUEST_DISABLED', message: 'Guest mode is disabled' }
    });
    return false;
  }
  return true;
}

/**
 * GET /api/chat/memory
 * Returns the current authenticated user's agent memory (system messages).
 *
 * доступ: користувачі з розширеним доступом (qa_specialist via CHAT_DEBUG, або ролі з WORKBENCH_ACCESS)
 */
router.get(
  '/memory',
  authenticate,
  requireAnyPermission(Permission.CHAT_DEBUG, Permission.WORKBENCH_ACCESS),
  async (req: Request, res: Response) => {
    try {
      // This endpoint is user-specific and should never be cached.
      // Avoid ETag/304 flows that cause fetch() to receive a 304 with no JSON body.
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const principalId = req.user?.id;
      if (!principalId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const memory = isMemoryEnabledPrincipal(principalId) ? await loadAgentMemory(principalId) : [];

      return res.json({
        success: true,
        data: {
          principalId,
          memory
        }
      });
    } catch (error) {
      console.error('[Chat API] Error getting memory:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get memory' }
      });
    }
  }
);

/**
 * POST /api/chat/sessions
 * Create a new chat session
 * Note: Optional authentication - supports both authenticated users and guests
 */
router.post('/sessions', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    const principal = await resolveSessionCreatePrincipal(req, res, ensureGuestAllowed);
    if (!principal) return;

    const { userId, languageCode } = principal;

    // Enforce: user must have only one active session.
    // Close any existing active sessions for this principal before creating a new one.
    if (userId) {
      try {
        const closedIds = await markOtherActiveSessionsClosed({
          principalId: userId,
          closedStatus: 'ended'
        });

        if (closedIds.length > 0) {
          console.log('[Chat API] Closed previous active sessions on new session create:', {
            principalId: userId,
            closedCount: closedIds.length
          });

          // Fire-and-forget: persist closed sessions to GCS and clean up DB messages.
          void (async () => {
            for (const sid of closedIds) {
              try {
                await endSession(sid, { finalStatus: 'ended' });
              } catch (e) {
                console.warn('[Chat API] Failed to finalize closed session (continuing):', { sessionId: sid }, e);
              }
            }
          })();
        }
      } catch (e) {
        console.warn('[Chat API] Failed to close previous active sessions (continuing):', e);
      }
    }

    console.log('[Chat API] Creating session');
    const session = await createSession(userId, languageCode);

    // Load memory + generate proactive first assistant message (best-effort)
    let initialAssistantMessage: string | null = null;
    try {
      const memoryPrincipalId = isMemoryEnabledPrincipal(userId) ? userId : null;
      const { memory, initialAssistantMessage: msg } = await generateInitialAssistantMessage({
        principalId: memoryPrincipalId,
        languageCode
      });
      initialAssistantMessage = msg;
      setSessionAgentMemoryMessages(session.id, memoryPrincipalId, memory);
    } catch (e) {
      // If memory/greeting fails, proceed with session creation.
      console.warn('[Chat API] Failed to generate initial message from memory:', e);
      setSessionAgentMemoryMessages(session.id, null, []);
    }

    res.json({
      success: true,
      data: {
        ...session,
        initialAssistantMessage
      }
    });
  } catch (error) {
    console.error('[Chat API] Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * POST /api/chat/message
 * Send a message to Dialogflow and get response
 * Supports both authenticated users and guests
 */
router.post('/message', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { sessionId, message, languageCode = 'uk' } = req.body;
    
    let userId: string | null = null;

    // Security: Authenticated users MUST use their token-verified userId
    if (req.user?.id) {
      userId = req.user.id;
    } else {
      // For unauthenticated requests, validate guest ID format
      const requestUserId = req.body.userId;
      if (requestUserId) {
        // Only allow guest IDs (must start with 'guest_')
        if (typeof requestUserId === 'string' && requestUserId.startsWith('guest_')) {
          userId = requestUserId;
        } else {
          if (typeof requestUserId === 'string' && isUuid(requestUserId)) {
            return res.status(401).json({
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            });
          }

          return res.status(400).json({
            success: false,
            error: 'Invalid userId format. Guest sessions must use IDs starting with "guest_"'
          });
        }
      }
      // If no userId provided for guest, leave as null
    }

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and message are required'
      });
    }

    // Get session metadata
    const sessionMetadata = await getSessionMetadata(sessionId);
    if (!sessionMetadata) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Handle token-refresh edge case:
    // - client may have created the session while token was expired (optionalAuth didn't attach req.user),
    //   so the session was created as anonymous / guest.
    // - once token is refreshed, subsequent requests are authenticated and ownership check would 403.
    // If the session is still active in-memory (i.e., created on this instance), bind it to the authenticated user.
    let sessionUserId = sessionMetadata.userId;
    if (
      userId &&
      (sessionUserId === null || (typeof sessionUserId === 'string' && sessionUserId.startsWith('guest_'))) &&
      getActiveConversation(sessionId)
    ) {
      await updateSessionUserId(sessionId, userId);
      sessionUserId = userId;
      console.log(`[Chat API] Bound session principal for ${sessionId}`);
    }

    // Verify ownership: user can only send messages to their own sessions
    // For guest sessions (both null), allow access
    // For authenticated sessions, userId must match
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;
    
    if (!isGuestSession && !isOwnSession) {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_OWNERSHIP', message: 'Access denied: You can only send messages to your own sessions' }
      });
    }

    if (sessionMetadata.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active'
      });
    }

    // Best-effort: inject memory system messages as a session parameter.
    // If not cached (server restart), reload from GCS once.
    const effectivePrincipalIdRaw = userId || sessionUserId;
    const effectivePrincipalId = isMemoryEnabledPrincipal(effectivePrincipalIdRaw) ? effectivePrincipalIdRaw : null;
    const cached = getSessionAgentMemoryMessages(sessionId);
    let agentMemory = cached.messages;
    const cachedPrincipalId = cached.principalId;

    // If principal changed (e.g., guest -> authenticated), drop old cache and reload for the new principal.
    if (effectivePrincipalId && cachedPrincipalId !== effectivePrincipalId) {
      agentMemory = [];
      setSessionAgentMemoryMessages(sessionId, effectivePrincipalId, []);
    }

    if (agentMemory.length === 0 && effectivePrincipalId) {
      try {
        agentMemory = await loadAgentMemory(effectivePrincipalId);
        setSessionAgentMemoryMessages(sessionId, effectivePrincipalId, agentMemory);
      } catch (e) {
        console.warn('[Chat API] Failed to load agent memory for injection:', e);
      }
    }

    // Moderation visibility: persist a USER MEMORY system message at the beginning of the conversation
    // so workbench moderation can see the same system context as the chat UI.
    // IMPORTANT: only do this when the session is active in memory and this is the first message.
    const activeConversation = getActiveConversation(sessionId);
    if (activeConversation && activeConversation.messages.length === 0 && effectivePrincipalId && agentMemory.length > 0) {
      const first = agentMemory[0] as any;
      const metaBits = [
        first?.meta?.aggregatedBy,
        first?.meta?.llmProvider,
        first?.meta?.llmModel,
        first?.meta?.llmLocation
      ]
        .filter((x) => typeof x === 'string' && x.length > 0)
        .join(' • ');

      const header = metaBits ? `USER MEMORY (${metaBits})` : 'USER MEMORY';
      const snapshot = agentMemory
        .map((m) => String(m.content || '').trim())
        .filter((t) => t.length > 0)
        .join('\n\n');

      const sysMessage: StoredMessage = {
        id: uuidv4(),
        role: 'system',
        content: snapshot ? `${header}\n\n${snapshot}` : header,
        timestamp: new Date().toISOString()
      };

      try {
        await addMessage(sessionId, sysMessage);
      } catch (e) {
        console.warn('[Chat API] Failed to persist USER MEMORY system message (continuing):', e);
      }
    }

    // Create user message
    const userMessage: StoredMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    // Add user message to session
    await addMessage(sessionId, userMessage);

    // Update session userId if it has changed (e.g., guest -> authenticated)
    if (userId && sessionUserId !== userId) {
      await updateSessionUserId(sessionId, userId);
      console.log(`[Chat API] Updated session principal for ${sessionId}`);
      sessionUserId = userId;
    }

    // Send to Dialogflow with userId parameter
    const startTime = Date.now();
    const dialogflowResponse = await sendMessageToDialogflow(
      sessionMetadata.dialogflowSessionId,
      message,
      languageCode,
      userId, // Pass userId to Dialogflow
      agentMemory // Pass memory (system messages) best-effort
    );
    const responseTime = Date.now() - startTime;

    const canIncludeSystemPrompts =
      !!req.user?.permissions?.includes(Permission.CHAT_DEBUG) || req.user?.role === 'owner';

    // Debug: Log what Dialogflow returned
    console.log('[Chat API] Dialogflow response technical details:', {
      hasIntentInfo: !!dialogflowResponse.intentInfo,
      hasMatch: !!dialogflowResponse.match,
      hasGenerativeInfo: !!dialogflowResponse.generativeInfo,
      hasWebhookStatuses: !!dialogflowResponse.webhookStatuses,
      hasDiagnosticInfo: !!dialogflowResponse.diagnosticInfo,
      hasSentiment: !!dialogflowResponse.sentiment,
      hasFlowInfo: !!dialogflowResponse.flowInfo,
      intentInfo: dialogflowResponse.intentInfo,
      match: dialogflowResponse.match
    });

    // Create assistant message with full technical details
    const assistantMessage: StoredMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: dialogflowResponse.messages.join('\n'),
      timestamp: new Date().toISOString(),
      intent: dialogflowResponse.intentInfo,
      match: dialogflowResponse.match,
      generativeInfo: dialogflowResponse.generativeInfo,
      webhookStatuses: dialogflowResponse.webhookStatuses,
      diagnosticInfo: dialogflowResponse.diagnosticInfo,
      sentiment: dialogflowResponse.sentiment,
      flowInfo: dialogflowResponse.flowInfo,
      responseTimeMs: responseTime,
      systemPrompts:
        agentMemory && agentMemory.length > 0
          ? { agentMemorySystemMessages: agentMemory }
          : undefined
    };

    // Add assistant message to session
    await addMessage(sessionId, assistantMessage);

    res.json({
      success: true,
      data: {
        userMessage,
        assistantMessage: canIncludeSystemPrompts
          ? assistantMessage
          : // Persisted, but not returned to non-debug clients
            (({ systemPrompts, ...rest }) => rest)(assistantMessage as any)
      }
    });
  } catch (error) {
    console.error('[Chat API] Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

/**
 * POST /api/chat/sessions/:id/end
 * End a session and save to GCS
 * Supports both authenticated users and guests
 */
router.post('/sessions/:id/end', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { id } = req.params;
    let userId: string | null = null;

    // Security: Authenticated users MUST use their token-verified userId
    if (req.user?.id) {
      userId = req.user.id;
    } else {
      // For unauthenticated requests, validate guest ID format
      const requestUserId = req.body.userId;
      if (requestUserId) {
        if (typeof requestUserId === 'string' && requestUserId.startsWith('guest_')) {
          userId = requestUserId;
        } else {
          if (typeof requestUserId === 'string' && isUuid(requestUserId)) {
            return res.status(401).json({
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            });
          }

          return res.status(400).json({
            success: false,
            error: 'Invalid userId format. Guest sessions must use IDs starting with "guest_"'
          });
        }
      }
    }

    // Get session metadata
    const session = await getSessionMetadata(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active'
      });
    }

    // Same token-refresh edge case as /message: bind in-memory anonymous/guest sessions to the authenticated user
    let sessionUserId = session.userId;
    if (
      userId &&
      (sessionUserId === null || (typeof sessionUserId === 'string' && sessionUserId.startsWith('guest_'))) &&
      getActiveConversation(id)
    ) {
      await updateSessionUserId(id, userId);
      sessionUserId = userId;
      console.log(`[Chat API] Bound session ${id} to authenticated user: ${userId}`);
    }

    // Verify ownership: user can only end their own sessions
    // For guest sessions (both null), allow access
    // For authenticated sessions, userId must match
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;
    
    if (!isGuestSession && !isOwnSession) {
      console.log('[Chat API] Ownership check failed:', { sessionId: id, isGuestSession, isOwnSession });
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_OWNERSHIP', message: 'Access denied: You can only end your own sessions' }
      });
    }

    const conversation = await endSession(id);

    // Analyze closed session -> update agent memory (best-effort).
    // Requirement: analysis happens when closing session.
    if (conversation) {
      // IMPORTANT: use the resolved/bound sessionUserId, not the stale pre-bind session.userId,
      // otherwise memory won't update when we bound an anonymous/guest session during this request.
      const memoryPrincipalId = isMemoryEnabledPrincipal(sessionUserId) ? sessionUserId : null;

      const llmProvider = (process.env.LLM_PROVIDER || '').toLowerCase() || 'auto';
      const hasVertexProject =
        !!process.env.VERTEX_PROJECT_ID || !!process.env.GOOGLE_CLOUD_PROJECT || !!process.env.GCLOUD_PROJECT;

      console.log('[Chat API] Memory update on session end (async):', {
        sessionId: id,
        principalId: memoryPrincipalId,
        messageCount: conversation.messages.length,
        llmProvider,
        hasVertexProject
      });

      // Fire-and-forget: do not block the HTTP response on memory aggregation.
      void (async () => {
        try {
          const result = await updateAgentMemoryOnSessionEnd({
            principalId: memoryPrincipalId,
            conversation
          });
          if (!result) {
            console.log('[Chat API] Memory update skipped (principal not eligible or disabled):', {
              sessionId: id,
              principalId: memoryPrincipalId
            });
          } else {
            console.log('[Chat API] Memory update completed:', {
              sessionId: id,
              principalId: memoryPrincipalId,
              savedPath: result.savedPath,
              messageCount: result.messageCount
            });
          }
        } catch (e) {
          console.warn('[Chat API] Memory aggregation failed (async; session still ended):', e);
        }
      })();
    }

    res.json({
      success: true,
      data: { message: 'Session ended successfully' }
    });
  } catch (error) {
    console.error('[Chat API] Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

/**
 * POST /api/chat/sessions/:id/memory/refresh
 * Refreshes per-session injected agent memory from GCS for the current principal
 * and appends a persisted system message indicating the update (deduped).
 *
 * Intended for non-blocking memory updates: a client can poll this endpoint for the active session
 * and get the newest memory applied without blocking chat UX.
 */
router.post('/sessions/:id/memory/refresh', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { id } = req.params;
    let userId: string | null = null;

    // Security: Authenticated users MUST use their token-verified userId
    if (req.user?.id) {
      userId = req.user.id;
    } else {
      // For unauthenticated requests, validate guest ID format
      const requestUserId = req.body.userId;
      if (requestUserId) {
        if (typeof requestUserId === 'string' && requestUserId.startsWith('guest_')) {
          userId = requestUserId;
        } else {
          if (typeof requestUserId === 'string' && isUuid(requestUserId)) {
            return res.status(401).json({
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            });
          }

          return res.status(400).json({
            success: false,
            error: 'Invalid userId format. Guest sessions must use IDs starting with "guest_"'
          });
        }
      }
    }

    // Get session metadata
    const session = await getSessionMetadata(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Same token-refresh edge case as /message: bind in-memory anonymous/guest sessions to the authenticated user
    let sessionUserId = session.userId;
    if (
      userId &&
      (sessionUserId === null || (typeof sessionUserId === 'string' && sessionUserId.startsWith('guest_'))) &&
      getActiveConversation(id)
    ) {
      await updateSessionUserId(id, userId);
      sessionUserId = userId;
      console.log(`[Chat API] Bound session ${id} to authenticated user: ${userId}`);
    }

    // Verify ownership: same rules as /message
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;

    if (!isGuestSession && !isOwnSession) {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_OWNERSHIP', message: 'Access denied: You can only access your own sessions' }
      });
    }

    const effectivePrincipalIdRaw = userId || sessionUserId;
    const effectivePrincipalId = isMemoryEnabledPrincipal(effectivePrincipalIdRaw) ? effectivePrincipalIdRaw : null;

    let memory: Awaited<ReturnType<typeof loadAgentMemory>> = [];
    if (effectivePrincipalId) {
      try {
        memory = await loadAgentMemory(effectivePrincipalId);
      } catch (e) {
        console.warn('[Chat API] Failed to load agent memory for refresh:', e);
      }
    }

    // Update per-session injection cache (best-effort)
    setSessionAgentMemoryMessages(id, effectivePrincipalId, memory);

    // Compute max meta.updatedAt across memory entries (if any)
    let memoryUpdatedAt: string | null = null;
    for (const m of memory) {
      const ts = (m as any)?.meta?.updatedAt;
      if (typeof ts !== 'string' || !ts) continue;
      if (!memoryUpdatedAt) {
        memoryUpdatedAt = ts;
        continue;
      }
      if (new Date(ts).getTime() > new Date(memoryUpdatedAt).getTime()) {
        memoryUpdatedAt = ts;
      }
    }

    // Persist a system marker message (deduped by exact content)
    // This is intentionally short to keep the conversation clean and maintain compatibility with older renders.
    const markerContent = `SYSTEM: Memory updated • updatedAt=${memoryUpdatedAt || 'unknown'} • count=${memory.length}`;
    try {
      // Avoid creating synthetic DB sessions with only a system marker.
      // We only persist the marker if the session already has at least one message in memory (i.e., user has interacted).
      const activeConversation = getActiveConversation(id);
      if (!activeConversation || activeConversation.messages.length === 0) {
        return res.json({
          success: true,
          data: {
            memoryCount: memory.length,
            memoryUpdatedAt
          }
        });
      }

      const pool = getPool();
      const exists = await pool.query(
        `SELECT 1 FROM session_messages WHERE session_id = $1 AND role = 'system' AND content = $2 LIMIT 1`,
        [id, markerContent]
      );
      if (exists.rows.length === 0) {
        const sysMsg: StoredMessage = {
          id: uuidv4(),
          role: 'system',
          content: markerContent,
          timestamp: new Date().toISOString()
        };
        await addMessage(id, sysMsg);
      }
    } catch (e) {
      console.warn('[Chat API] Failed to persist system memory marker (continuing):', e);
    }

    return res.json({
      success: true,
      data: {
        memoryCount: memory.length,
        memoryUpdatedAt
      }
    });
  } catch (error) {
    console.error('[Chat API] Error refreshing session memory:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh session memory'
    });
  }
});

/**
 * GET /api/chat/sessions/:id
 * Get session metadata
 * Supports both authenticated users and guests
 */
router.get('/sessions/:id', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { id } = req.params;
    const userId = req.user?.id || null;

    const session = await getSessionMetadata(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Verify ownership: user can only access their own session metadata
    // For guest sessions (both null), allow access
    // For authenticated sessions, userId must match
    const sessionUserId = session.userId;
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;
    
    if (!isGuestSession && !isOwnSession) {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_OWNERSHIP', message: 'Access denied: You can only access your own sessions' }
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('[Chat API] Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * GET /api/chat/sessions/:id/conversation
 * Get full conversation from GCS
 * Supports both authenticated users and guests
 */
router.get('/sessions/:id/conversation', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Get session metadata
    const session = await getSessionMetadata(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Verify ownership: user can only access their own conversations
    // For guest sessions (both null), allow access
    // For authenticated sessions, userId must match
    const sessionUserId = session.userId;
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;
    
    if (!isGuestSession && !isOwnSession) {
      return res.status(403).json({
        success: false,
        error: { code: 'SESSION_OWNERSHIP', message: 'Access denied: You can only view your own conversations' }
      });
    }

    const canIncludeSystemPrompts =
      !!req.user?.permissions?.includes(Permission.CHAT_DEBUG) || req.user?.role === 'owner';

    // Check if conversation is saved to GCS
    if (!session.gcsPath) {
      // Try to get from memory if still active
      const activeConversation = getActiveConversation(id);
      if (activeConversation) {
        if (!canIncludeSystemPrompts) {
          return res.json({
            success: true,
            data: {
              ...activeConversation,
              messages: activeConversation.messages.map((m: any) => {
                const { systemPrompts, ...rest } = m || {};
                return rest;
              })
            }
          });
        }
        return res.json({
          success: true,
          data: activeConversation
        });
      }

      return res.status(404).json({
        success: false,
        error: 'Conversation not yet saved to GCS'
      });
    }

    // Retrieve from GCS
    const conversation = await getConversation(session.gcsPath);

    if (!canIncludeSystemPrompts) {
      return res.json({
        success: true,
        data: {
          ...conversation,
          messages: (conversation.messages || []).map((m: any) => {
            const { systemPrompts, ...rest } = m || {};
            return rest;
          })
        }
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('[Chat API] Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

/**
 * GET /api/chat/sessions
 * List user's sessions
 */
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = await listUserSessions(userId, limit);

    // Transform SessionMetadata to ConversationMetadata format for frontend
    const conversationMetadata = sessions.map(session => ({
      id: session.id,
      sessionId: session.id, // Use database ID, not dialogflowSessionId
      userId: session.userId,
      userName: req.user?.displayName, // Add user name from authenticated user
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : '', // Empty string for active sessions
      messageCount: session.messageCount,
      languageCode: session.languageCode,
      gcsPath: session.gcsPath || ''
    }));

    res.json({
      success: true,
      data: conversationMetadata
    });
  } catch (error) {
    console.error('[Chat API] Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions'
    });
  }
});

/**
 * POST /api/chat/messages/:id/feedback
 * Submit feedback for a message
 * Supports both authenticated users and guests
 */
router.post('/messages/:id/feedback', optionalAuthActiveAccount, async (req: Request, res: Response) => {
  try {
    if (!(await ensureGuestAllowed(req, res))) return;
    const { id: messageId } = req.params;
    const { rating, comment } = req.body;
    let userId: string | null = null;

    // Security: Authenticated users MUST use their token-verified userId
    if (req.user?.id) {
      userId = req.user.id;
    } else {
      // For unauthenticated requests, validate guest ID format
      const requestUserId = req.body.userId;
      if (requestUserId) {
        // Only allow guest IDs (must start with 'guest_')
        if (typeof requestUserId === 'string' && requestUserId.startsWith('guest_')) {
          userId = requestUserId;
        } else {
          if (typeof requestUserId === 'string' && isUuid(requestUserId)) {
            return res.status(401).json({
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            });
          }

          return res.status(400).json({
            success: false,
            error: 'Invalid userId format. Guest sessions must use IDs starting with "guest_"'
          });
        }
      }
      // If no userId provided for guest, leave as null
    }

    if (!rating || ![1, 2, 3, 4, 5].includes(rating)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be a number between 1 and 5'
      });
    }

    // Get message to find session
    const pool = getPool();
    const messageResult = await pool.query(
      `SELECT session_id FROM session_messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    const sessionId = messageResult.rows[0].session_id;

    // Verify ownership: user can only submit feedback for their own sessions
    const sessionMetadata = await getSessionMetadata(sessionId);
    if (!sessionMetadata) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionUserId = sessionMetadata.userId;
    const isGuestSession = sessionUserId === null && userId === null;
    const isOwnSession = sessionUserId === userId && sessionUserId !== null;
    
    if (!isGuestSession && !isOwnSession) {
      return res.status(403).json({
        success: false,
        error: { code: 'MESSAGE_OWNERSHIP', message: 'Access denied: You can only submit feedback for your own sessions' }
      });
    }

    // Update feedback
    await updateMessageFeedback(sessionId, messageId, {
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comment: comment || null
    });

    res.json({
      success: true,
      data: { message: 'Feedback submitted successfully' }
    });
  } catch (error) {
    console.error('[Chat API] Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

export default router;

