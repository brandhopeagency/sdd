// Re-export value exports (enums and constants)
export { UserRole, Permission, ROLE_PERMISSIONS } from '@mentalhelpglobal/chat-types';

// Re-export type-only exports
export type {
  // Entities
  BaseEntity,
  GroupRole,
  GroupMembershipStatus,
  GroupMembershipSummary,
  AuthenticatedUser,
  Session,
  ChatMessage,
  MessageFeedback,
  Annotation,
  Tag,
  AuditLogEntry,
  NavItem,

  // Conversation types
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

  // Agent Memory types
  AgentMemoryRole,
  AgentMemorySystemMessage
} from '@mentalhelpglobal/chat-types';

import type { User as ChatTypesUser } from '@mentalhelpglobal/chat-types';

export type User = ChatTypesUser & {
  isTestUser?: boolean;
};
