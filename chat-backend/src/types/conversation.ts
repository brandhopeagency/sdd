/**
 * Conversation Storage Types - re-exports shared types and defines backend-specific types
 */

// Re-export all conversation types from shared package
export type {
  SystemPromptMessage,
  StoredSystemPrompts,
  ToolUseAction,
  AgentUtteranceAction,
  DialogflowAction,
  GenerativeInfo,
  WebhookStatus,
  AlternativeIntent,
  ExecutionStepInterval,
  ExecutionStepStatus,
  ExecutionStepResponse,
  ExecutionStep,
  ExecutionResult,
  AdditionalInfo,
  DataStoreExecutionSequence,
  DiagnosticInfo,
  SentimentAnalysis,
  FlowInfo,
  IntentInfo,
  MatchInfo,
  StoredMessageFeedback,
  StoredMessage,
  StoredConversation,
  ConversationMetadata,
} from '@mentalhelpglobal/chat-types';

// ── Backend-specific types ──

/**
 * Session metadata (stored in database, backend-only)
 */
export interface SessionMetadata {
  id: string;
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  languageCode: string;
  gcsPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}
