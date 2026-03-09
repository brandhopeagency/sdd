import { getPool } from '../db';

// ── Types ──

export interface UserTag {
  id: string;
  userId: string;
  tagDefinitionId: string;
  assignedBy: string | null;
  assignedAt: Date;
  tagDefinition: {
    id: string;
    name: string;
    description: string | null;
    category: 'user' | 'chat';
    excludeFromReviews: boolean;
    isActive: boolean;
  };
}

// ── Row mapper ──

function rowToUserTag(row: any): UserTag {
  return {
    id: row.id,
    userId: row.user_id,
    tagDefinitionId: row.tag_definition_id,
    assignedBy: row.assigned_by ?? null,
    assignedAt: row.assigned_at,
    tagDefinition: {
      id: row.td_id,
      name: row.td_name,
      description: row.td_description ?? null,
      category: row.td_category,
      excludeFromReviews: Boolean(row.td_exclude_from_reviews),
      isActive: Boolean(row.td_is_active),
    },
  };
}

// ── Service functions ──

/**
 * List all tags assigned to a user, with full tag definition populated.
 */
export async function listUserTags(userId: string): Promise<UserTag[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT
       ut.id,
       ut.user_id,
       ut.tag_definition_id,
       ut.assigned_by,
       ut.assigned_at,
       td.id          AS td_id,
       td.name        AS td_name,
       td.description AS td_description,
       td.category    AS td_category,
       td.exclude_from_reviews AS td_exclude_from_reviews,
       td.is_active   AS td_is_active
     FROM user_tags ut
     JOIN tag_definitions td ON td.id = ut.tag_definition_id
     WHERE ut.user_id = $1
     ORDER BY td.name ASC`,
    [userId],
  );

  return result.rows.map(rowToUserTag);
}

/**
 * Assign a tag to a user.
 *
 * Validates:
 *  - Tag definition must exist and have category = 'user'
 *  - Tag definition must be active
 *  - The (user_id, tag_definition_id) pair must be unique
 *
 * Throws on conflict (409) or not found (404).
 */
export async function assignUserTag(
  userId: string,
  tagDefinitionId: string,
  assignedBy: string,
): Promise<UserTag> {
  const pool = getPool();

  // 1. Validate tag definition exists, is user category, and is active
  const tdResult = await pool.query(
    'SELECT id, name, category, is_active FROM tag_definitions WHERE id = $1',
    [tagDefinitionId],
  );

  if (tdResult.rows.length === 0) {
    const error: any = new Error('Tag definition not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const td = tdResult.rows[0];

  if (td.category !== 'user') {
    const error: any = new Error('Tag definition must have category "user"');
    error.statusCode = 400;
    error.code = 'INVALID_CATEGORY';
    throw error;
  }

  if (!td.is_active) {
    const error: any = new Error('Tag definition is not active');
    error.statusCode = 400;
    error.code = 'INACTIVE_TAG';
    throw error;
  }

  // 2. Check for existing assignment (unique constraint)
  const existing = await pool.query(
    'SELECT id FROM user_tags WHERE user_id = $1 AND tag_definition_id = $2',
    [userId, tagDefinitionId],
  );

  if (existing.rows.length > 0) {
    const error: any = new Error(`User already has tag "${td.name}" assigned`);
    error.statusCode = 409;
    error.code = 'CONFLICT';
    throw error;
  }

  // 3. Insert the assignment
  const insertResult = await pool.query(
    `INSERT INTO user_tags (user_id, tag_definition_id, assigned_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, tagDefinitionId, assignedBy],
  );

  // 4. Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      assignedBy,
      'user_tag.assign',
      'user_tag',
      insertResult.rows[0].id,
      JSON.stringify({ userId, tagDefinitionId, tagName: td.name }),
    ],
  );

  // 5. Return the full user tag with populated tag definition
  const fullResult = await pool.query(
    `SELECT
       ut.id,
       ut.user_id,
       ut.tag_definition_id,
       ut.assigned_by,
       ut.assigned_at,
       td.id          AS td_id,
       td.name        AS td_name,
       td.description AS td_description,
       td.category    AS td_category,
       td.exclude_from_reviews AS td_exclude_from_reviews,
       td.is_active   AS td_is_active
     FROM user_tags ut
     JOIN tag_definitions td ON td.id = ut.tag_definition_id
     WHERE ut.id = $1`,
    [insertResult.rows[0].id],
  );

  return rowToUserTag(fullResult.rows[0]);
}

/**
 * Remove a tag assignment from a user.
 *
 * Throws 404 if the assignment does not exist.
 */
export async function removeUserTag(
  userId: string,
  tagDefinitionId: string,
  removedBy: string,
): Promise<void> {
  const pool = getPool();

  // Find the assignment
  const existing = await pool.query(
    `SELECT ut.id, td.name AS tag_name
     FROM user_tags ut
     JOIN tag_definitions td ON td.id = ut.tag_definition_id
     WHERE ut.user_id = $1 AND ut.tag_definition_id = $2`,
    [userId, tagDefinitionId],
  );

  if (existing.rows.length === 0) {
    const error: any = new Error('User tag assignment not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const { id: userTagId, tag_name: tagName } = existing.rows[0];

  // Delete the assignment
  await pool.query('DELETE FROM user_tags WHERE id = $1', [userTagId]);

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      removedBy,
      'user_tag.remove',
      'user_tag',
      userTagId,
      JSON.stringify({ userId, tagDefinitionId, tagName }),
    ],
  );
}
