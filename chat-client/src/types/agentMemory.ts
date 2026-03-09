/**
 * Agent memory types (Frontend).
 *
 * Memory is stored as a JSON array of "system messages" and injected back into
 * the conversation context on new sessions.
 */
export type AgentMemoryRole = 'system';

export interface AgentMemorySystemMessage {
  role: AgentMemoryRole;
  content: string;
  meta?: {
    kind?: 'facts' | 'preferences' | 'state_timeline' | 'recap' | 'other';
    updatedAt?: string; // ISO timestamp
    aggregatedBy?: 'llm' | 'fallback';
    llmProvider?: 'vertex' | 'mock' | string;
    llmModel?: string;
    llmLocation?: string;
    sourceSessionId?: string;
    languageCode?: string;
  };
}

