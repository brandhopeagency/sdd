/**
 * Tag system types for the Chat Review Tagging feature.
 *
 * Defines TagDefinition, UserTag, SessionTag, SessionExclusion interfaces
 * and input types for tag management.
 */

import type { BaseEntity } from './entities';

// ─── Tag Category ────────────────────────────────────────────────────────────

/** Tag categories — determines assignment context. */
export type TagCategory = 'user' | 'chat';

/** Source of session tag application. */
export type TagSource = 'system' | 'manual';

/** Source of session exclusion. */
export type ExclusionReasonSource = 'user_tag' | 'chat_tag';

// ─── Core Entities ───────────────────────────────────────────────────────────

/**
 * Master tag definition (shared namespace — names globally unique, case-insensitive).
 */
export interface TagDefinition extends BaseEntity {
  name: string;
  nameLower: string;
  description: string | null;
  category: TagCategory;
  excludeFromReviews: boolean;
  isActive: boolean;
  createdBy: string | null;
}

/**
 * User-to-tag assignment (junction table).
 */
export interface UserTag extends BaseEntity {
  userId: string;
  tagDefinitionId: string;
  assignedBy: string;
  /** Populated on read. */
  tagDefinition?: TagDefinition;
}

/**
 * Session-to-tag assignment (junction table).
 */
export interface SessionTag extends BaseEntity {
  sessionId: string;
  tagDefinitionId: string;
  source: TagSource;
  appliedBy: string | null;
  /** Populated on read. */
  tagDefinition?: TagDefinition;
}

/**
 * Record documenting why a session was excluded from the review queue.
 */
export interface SessionExclusion extends BaseEntity {
  sessionId: string;
  reason: string;
  reasonSource: ExclusionReasonSource;
  tagDefinitionId: string | null;
}

// ─── Input Types ─────────────────────────────────────────────────────────────

/**
 * Input for creating a new tag definition.
 */
export interface CreateTagDefinitionInput {
  name: string;
  description?: string;
  category: TagCategory;
  excludeFromReviews?: boolean;
}

/**
 * Input for updating an existing tag definition.
 */
export interface UpdateTagDefinitionInput {
  name?: string;
  description?: string;
  excludeFromReviews?: boolean;
  isActive?: boolean;
}
