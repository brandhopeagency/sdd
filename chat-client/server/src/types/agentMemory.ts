/**
 * Agent memory types.
 *
 * Memory is stored as a JSON array of "system messages" in GCS and is injected
 * back into the conversation context on new sessions.
 */
export type AgentMemoryRole = 'system';

export interface AgentMemorySystemMessage {
  role: AgentMemoryRole;
  content: string;
  /**
   * Optional metadata (not required by storage format, but useful for debugging).
   * Keep this small and non-sensitive.
   */
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

