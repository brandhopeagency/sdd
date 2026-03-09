/**
 * Core entity types for MHG chat system.
 *
 * Defines User, Session, ChatMessage, and related data structures
 * shared between frontend and backend.
 */

import { UserRole, Permission } from './rbac';
import type {
  IntentInfo,
  MatchInfo,
  GenerativeInfo,
  WebhookStatus,
  DiagnosticInfo,
  SentimentAnalysis,
  FlowInfo,
  StoredSystemPrompts
} from './conversation';

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User account
 */
export interface User extends BaseEntity {
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'blocked' | 'pending' | 'approval' | 'disapproved' | 'anonymized';
  groupId: string | null;
  activeGroupId?: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  disapprovedAt: Date | null;
  disapprovalComment: string | null;
  disapprovalCount: number;
  lastLoginAt: Date | null;
  sessionCount: number;
  metadata: Record<string, unknown>;
  googleSub?: string | null;
}

export type GroupRole = 'member' | 'admin';
export type GroupMembershipStatus = 'active' | 'pending' | 'rejected' | 'removed';
export interface GroupMembershipSummary {
  groupId: string;
  groupName: string;
  role: GroupRole;
  status: GroupMembershipStatus;
}

/**
 * Authenticated user session
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: Permission[];
  status: 'active' | 'blocked' | 'pending' | 'approval' | 'disapproved' | 'anonymized';
  groupId: string | null;
  activeGroupId?: string | null;
  groupRole?: GroupRole | null;
  memberships?: GroupMembershipSummary[];
  approvedBy?: string | null;
  approvedAt?: Date | null;
  disapprovedAt?: Date | null;
  disapprovalComment?: string | null;
  disapprovalCount?: number;
  createdAt: Date;
  lastLoginAt: Date;
}

/**
 * Chat session
 */
export interface Session extends BaseEntity {
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  moderationStatus: 'pending' | 'in_review' | 'moderated';
  tags: string[];
  userName?: string;
  duration?: number;
}

/**
 * Individual chat message
 */
export interface ChatMessage extends BaseEntity {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  feedback: MessageFeedback | null;
  metadata: {
    intent?: string; // Kept for backward compatibility
    confidence?: number; // Kept for backward compatibility
    responseTimeMs?: number;
    parameters?: Record<string, unknown>;
    /**
     * Optional system metadata for system messages (e.g. memory snapshots).
     * This avoids UI logic relying on localized text prefixes.
     */
    system?: {
      kind?: 'memory_snapshot' | 'memory_updated' | 'other';
      title?: string;
    };
    // Technical details from Dialogflow CX
    intentInfo?: IntentInfo;
    match?: MatchInfo;
    generativeInfo?: GenerativeInfo;
    webhookStatuses?: WebhookStatus[];
    diagnosticInfo?: DiagnosticInfo;
    sentiment?: SentimentAnalysis;
    flowInfo?: FlowInfo;
    systemPrompts?: StoredSystemPrompts;
    /**
     * Client-only UI metadata (not persisted). Used for optimistic UI and error states.
     */
    client?: {
      status?: 'sending' | 'failed';
      error?: string;
      retryable?: boolean;
      originalContent?: string;
    };
  };
  tags: string[];
}

/**
 * User feedback on a message
 */
export interface MessageFeedback {
  rating: 1 | 2 | 3 | 4 | 5; // 5-point rating scale
  comment: string | null;
  submittedAt: Date;
}

/**
 * Annotation for moderation
 */
export interface Annotation extends BaseEntity {
  sessionId: string;
  messageId: string | null;
  authorId: string;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  goldenReference: string | null;
  notes: string;
  tags: string[];
}

/**
 * Tag definition
 */
export interface Tag extends BaseEntity {
  name: string;
  category: 'session' | 'message';
  color: string;
  description: string;
  isCustom: boolean;
  usageCount: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry extends BaseEntity {
  actorId: string;
  action: string;
  targetType: 'user' | 'session' | 'message' | 'deanonymization' | 'review' | 'risk_flag' | 'review_config';
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
}

/**
 * Navigation item for sidebar
 */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiredPermission: Permission;
  children?: NavItem[];
}
