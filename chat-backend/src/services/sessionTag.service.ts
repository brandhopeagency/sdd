import { getPool } from '../db';

// ── Types ──

export interface SessionTag {
  id: string;
  sessionId: string;
  tagDefinitionId: string;
  source: 'manual' | 'system';
  appliedBy: string | null;
  appliedAt: Date;
  tagDefinition: {
    id: string;
    name: string;
    description: string | null;
    category: 'user' | 'chat';
    excludeFromReviews: boolean;
    isActive: boolean;
  };
}

export interface AddSessionTagResult {
  sessionTag: SessionTag;
  tagDefinitionCreated: boolean;
}

let sessionTagRefColumnCache: 'tag_definition_id' | 'tag_id' | null = null;
let sessionTagHasTagIdCache: boolean | null = null;
let sessionTagHasTagDefinitionIdCache: boolean | null = null;

async function resolveSessionTagSchema(pool: ReturnType<typeof getPool>): Promise<{
  refColumn: 'tag_definition_id' | 'tag_id';
  hasTagId: boolean;
  hasTagDefinitionId: boolean;
}> {
  if (
    sessionTagRefColumnCache &&
    sessionTagHasTagIdCache !== null &&
    sessionTagHasTagDefinitionIdCache !== null
  ) {
    return {
      refColumn: sessionTagRefColumnCache,
      hasTagId: sessionTagHasTagIdCache,
      hasTagDefinitionId: sessionTagHasTagDefinitionIdCache,
    };
  }

  const columnsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'session_tags'
       AND column_name IN ('tag_definition_id', 'tag_id')`,
  );

  const columnNames = new Set(columnsResult.rows.map((r: any) => r.column_name as string));
  const hasTagDefinitionId = columnNames.has('tag_definition_id');
  const hasTagId = columnNames.has('tag_id');

  if (!hasTagDefinitionId && !hasTagId) {
    // Some production-like environments restrict information_schema visibility
    // for application users. Default to legacy tag_id mode in that case.
    sessionTagRefColumnCache = 'tag_id';
    sessionTagHasTagIdCache = true;
    sessionTagHasTagDefinitionIdCache = false;
    return {
      refColumn: 'tag_id',
      hasTagId: true,
      hasTagDefinitionId: false,
    };
  }

  const refColumn: 'tag_definition_id' | 'tag_id' = hasTagDefinitionId ? 'tag_definition_id' : 'tag_id';
  sessionTagRefColumnCache = refColumn;
  sessionTagHasTagIdCache = hasTagId;
  sessionTagHasTagDefinitionIdCache = hasTagDefinitionId;

  return { refColumn, hasTagId, hasTagDefinitionId };
}

// ── Row mapper ──

function rowToSessionTag(row: any): SessionTag {
  return {
    id: row.id,
    sessionId: row.session_id,
    tagDefinitionId: row.tag_definition_id,
    source: row.source,
    appliedBy: row.applied_by ?? null,
    appliedAt: row.applied_at,
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
 * List all tags for a session, with full tag definition populated.
 */
export async function listSessionTags(sessionId: string): Promise<SessionTag[]> {
  const pool = getPool();
  try {
    const { refColumn, hasTagId } = await resolveSessionTagSchema(pool);
    let result;
    if (hasTagId) {
      try {
        result = await pool.query(
          `SELECT
             st.session_id || ':' || st.tag_id AS id,
             st.session_id,
             st.tag_id AS tag_definition_id,
             COALESCE(st.source, 'manual') AS source,
             COALESCE(st.applied_by, st.added_by) AS applied_by,
             COALESCE(st.applied_at, st.created_at, NOW()) AS applied_at,
             t.id AS td_id,
             t.name AS td_name,
             COALESCE(t.description, '') AS td_description,
             'chat' AS td_category,
             false AS td_exclude_from_reviews,
             true AS td_is_active
           FROM session_tags st
           JOIN tags t ON t.id = st.tag_id
           WHERE st.session_id = $1
           ORDER BY t.name ASC`,
          [sessionId],
        );
      } catch (legacyReadError: any) {
        if (legacyReadError?.code !== '42703') {
          throw legacyReadError;
        }
        // Very old schemas can miss source/applied_by/applied_at/created_at columns.
        // Keep reads working with a minimal projection that only relies on stable columns.
        result = await pool.query(
          `SELECT
             st.session_id || ':' || st.tag_id AS id,
             st.session_id,
             st.tag_id AS tag_definition_id,
             'manual'::text AS source,
             NULL::text AS applied_by,
             NOW() AS applied_at,
             t.id AS td_id,
             t.name AS td_name,
             ''::text AS td_description,
             'chat'::text AS td_category,
             false AS td_exclude_from_reviews,
             true AS td_is_active
           FROM session_tags st
           JOIN tags t ON t.id = st.tag_id
           WHERE st.session_id = $1
           ORDER BY t.name ASC`,
          [sessionId],
        );
      }
    } else {
      result = await pool.query(
        `SELECT
           st.id,
           st.session_id,
           st.${refColumn} AS tag_definition_id,
           st.source,
           st.applied_by,
           st.applied_at,
           td.id          AS td_id,
           td.name        AS td_name,
           td.description AS td_description,
           td.category    AS td_category,
           td.exclude_from_reviews AS td_exclude_from_reviews,
           td.is_active   AS td_is_active
         FROM session_tags st
         JOIN tag_definitions td ON td.id = st.${refColumn}
         WHERE st.session_id = $1
         ORDER BY td.name ASC`,
        [sessionId],
      );
    }

    return result.rows.map(rowToSessionTag);
  } catch (error: any) {
    // Keep review UI usable on partially-migrated environments.
    // If tag tables/columns are missing, return an empty tag list instead of 500.
    if (error?.code === '42P01' || error?.code === '42703') {
      console.warn('[SessionTag] Tag schema unavailable, returning empty tags list:', {
        code: error.code,
        message: error.message,
      });
      return [];
    }
    throw error;
  }
}

/**
 * Add a session tag.
 *
 * Accepts either { tagDefinitionId } or { tagName }.
 *
 * If tagName is provided:
 *   - Search tag_definitions by LOWER(name). If found, use it.
 *   - If not found, auto-create TagDefinition with category='chat',
 *     excludeFromReviews=false, createdBy=appliedBy.
 *
 * If tagDefinitionId is provided:
 *   - Validate category='chat', tag is active.
 *
 * Creates session_tags with source='manual'.
 * Audit logs `session_tag.apply`.
 *
 * Returns { sessionTag, tagDefinitionCreated }.
 */
export async function addSessionTag(
  sessionId: string,
  payload: { tagDefinitionId?: string; tagName?: string },
  appliedBy: string,
): Promise<AddSessionTagResult> {
  const pool = getPool();
  const { refColumn, hasTagId, hasTagDefinitionId } = await resolveSessionTagSchema(pool);
  let tagDefinitionId: string;
  let legacyTagId: string | null = null;
  let legacyTagName: string | null = null;
  let tagDefinitionCreated = false;

  try {
    if (payload.tagDefinitionId) {
      // ── Lookup by ID ──
      const tdResult = await pool.query(
        'SELECT id, name, category, is_active FROM tag_definitions WHERE id = $1',
        [payload.tagDefinitionId],
      );

      if (tdResult.rows.length === 0) {
        const error: any = new Error('Tag definition not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        throw error;
      }

      const td = tdResult.rows[0];

      if (td.category !== 'chat') {
        const error: any = new Error('Only chat-category tags can be applied to sessions');
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

      tagDefinitionId = td.id;
    } else if (payload.tagName) {
    // ── Lookup by name (case-insensitive) ──
    const existing = await pool.query(
      'SELECT id, category, is_active FROM tag_definitions WHERE LOWER(name) = LOWER($1)',
      [payload.tagName],
    );

    if (existing.rows.length > 0) {
      const td = existing.rows[0];
      if (td.category !== 'chat') {
        const error: any = new Error('Only chat-category tags can be applied to sessions');
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
      tagDefinitionId = td.id;
    } else {
      // Auto-create new TagDefinition
      const createResult = await pool.query(
        `INSERT INTO tag_definitions (name, category, exclude_from_reviews, created_by)
         VALUES ($1, 'chat', false, $2)
         RETURNING id`,
        [payload.tagName.trim(), appliedBy],
      );
      tagDefinitionId = createResult.rows[0].id;
      tagDefinitionCreated = true;

      // Audit log for auto-created tag definition
      await pool.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          appliedBy,
          'tag_definition.create',
          'tag_definition',
          tagDefinitionId,
          JSON.stringify({ name: payload.tagName.trim(), category: 'chat', autoCreated: true }),
        ],
      );
    }
    } else {
      const error: any = new Error('Either tagDefinitionId or tagName must be provided');
      error.statusCode = 400;
      error.code = 'INVALID_REQUEST';
      throw error;
    }

    // Legacy schema: session_tags.tag_id references tags(id). Resolve/create that ID by name.
    if (hasTagId) {
      legacyTagName = payload.tagName?.trim() || null;
      if (!legacyTagName) {
        const nameLookup = await pool.query(
          'SELECT name FROM tag_definitions WHERE id = $1',
          [tagDefinitionId],
        );
        legacyTagName = nameLookup.rows[0]?.name ?? null;
      }
      if (!legacyTagName) {
        const error: any = new Error('Unable to resolve tag name for legacy schema');
        error.statusCode = 400;
        error.code = 'INVALID_REQUEST';
        throw error;
      }

      let existingLegacyTag;
      try {
        existingLegacyTag = await pool.query(
          `SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND category = 'session' LIMIT 1`,
          [legacyTagName],
        );
      } catch (legacyLookupError: any) {
        if (legacyLookupError?.code !== '42703') {
          throw legacyLookupError;
        }
        // Very old schemas may not have a category column.
        existingLegacyTag = await pool.query(
          `SELECT id FROM tags WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [legacyTagName],
        );
      }
      if (existingLegacyTag.rows.length > 0) {
        legacyTagId = existingLegacyTag.rows[0].id;
      } else {
        let createdLegacyTag;
        try {
          createdLegacyTag = await pool.query(
            `INSERT INTO tags (name, category, description, is_custom)
             VALUES ($1, 'session', '', true)
             RETURNING id`,
            [legacyTagName],
          );
        } catch (legacyInsertError: any) {
          if (legacyInsertError?.code !== '42703') {
            throw legacyInsertError;
          }
          // Older legacy schemas may only expose name/category.
          try {
            createdLegacyTag = await pool.query(
              `INSERT INTO tags (name, category)
               VALUES ($1, 'session')
               RETURNING id`,
              [legacyTagName],
            );
          } catch (legacyInsertFallbackError: any) {
            if (legacyInsertFallbackError?.code !== '42703') {
              throw legacyInsertFallbackError;
            }
            createdLegacyTag = await pool.query(
              `INSERT INTO tags (name)
               VALUES ($1)
               RETURNING id`,
              [legacyTagName],
            );
          }
        }
        legacyTagId = createdLegacyTag.rows[0].id;
      }
    }

    // Check for existing assignment
    const assignmentColumn = hasTagId ? 'tag_id' : refColumn;
    const assignmentValue = hasTagId ? legacyTagId : tagDefinitionId;
    const existingAssignment = await pool.query(
      `SELECT 1 FROM session_tags WHERE session_id = $1 AND ${assignmentColumn} = $2`,
      [sessionId, assignmentValue],
    );

    if (existingAssignment.rows.length > 0) {
      const error: any = new Error('Session already has this tag assigned');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    // Insert the session tag
    const insertColumns = ['session_id'];
    const insertValues: unknown[] = [sessionId];
    if (hasTagDefinitionId) {
      insertColumns.push('tag_definition_id');
      insertValues.push(tagDefinitionId);
    }
    if (hasTagId) {
      insertColumns.push('tag_id');
      insertValues.push(legacyTagId);
    }
    insertColumns.push('source', 'applied_by');
    insertValues.push('manual', appliedBy);
    const placeholders = insertValues.map((_, index) => `$${index + 1}`);
    const insertResult = await pool.query(
      `INSERT INTO session_tags (${insertColumns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      insertValues,
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        appliedBy,
        'session_tag.apply',
        'session_tag',
        insertResult.rows[0].id,
        JSON.stringify({ sessionId, tagDefinitionId, tagDefinitionCreated }),
      ],
    );

    if (hasTagId) {
      return {
        sessionTag: {
          id: `${sessionId}:${legacyTagId}`,
          sessionId,
          tagDefinitionId: legacyTagId as string,
          source: 'manual',
          appliedBy,
          appliedAt: new Date(),
          tagDefinition: {
            id: legacyTagId as string,
            name: legacyTagName ?? payload.tagName ?? 'tag',
            description: '',
            category: 'chat',
            excludeFromReviews: false,
            isActive: true,
          },
        },
        tagDefinitionCreated,
      };
    }

    // Return the full session tag with populated tag definition
    const fullResult = await pool.query(
          `SELECT
             st.id,
             st.session_id,
             st.${refColumn} AS tag_definition_id,
             st.source,
             st.applied_by,
             st.applied_at,
             td.id          AS td_id,
             td.name        AS td_name,
             td.description AS td_description,
             td.category    AS td_category,
             td.exclude_from_reviews AS td_exclude_from_reviews,
             td.is_active   AS td_is_active
           FROM session_tags st
           JOIN tag_definitions td ON td.id = st.${refColumn}
           WHERE st.id = $1`,
          [insertResult.rows[0].id],
        );

    return {
      sessionTag: rowToSessionTag(fullResult.rows[0]),
      tagDefinitionCreated,
    };
  } catch (error: any) {
    // Surface common DB failures as actionable API errors.
    if (error?.code === '42P01' || error?.code === '42703') {
      error.statusCode = 503;
      error.code = 'TAG_SCHEMA_UNAVAILABLE';
      error.message = 'Tagging schema is unavailable';
      throw error;
    }
    if (error?.code === '23505') {
      error.statusCode = 409;
      error.code = 'CONFLICT';
      error.message = 'Session already has this tag assigned';
      throw error;
    }
    throw error;
  }
}

/**
 * Remove a session tag.
 *
 * Rejects if source='system' (cannot remove system-applied tags).
 * Deletes the session_tags record and audit logs `session_tag.remove`.
 */
export async function removeSessionTag(
  sessionId: string,
  tagDefinitionId: string,
  removedBy: string,
): Promise<void> {
  const pool = getPool();
  const { refColumn } = await resolveSessionTagSchema(pool);

  // Find the assignment
  const existing = await pool.query(
    `SELECT st.id, st.source, td.name AS tag_name
     FROM session_tags st
     JOIN tag_definitions td ON td.id = st.${refColumn}
     WHERE st.session_id = $1 AND st.${refColumn} = $2`,
    [sessionId, tagDefinitionId],
  );

  if (existing.rows.length === 0) {
    const error: any = new Error('Session tag assignment not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const { id: sessionTagId, source, tag_name: tagName } = existing.rows[0];

  // Reject removal of system-applied tags
  if (source === 'system') {
    const error: any = new Error('Cannot remove system-applied tags');
    error.statusCode = 403;
    error.code = 'SYSTEM_TAG';
    throw error;
  }

  // Delete the assignment
  await pool.query('DELETE FROM session_tags WHERE id = $1', [sessionTagId]);

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      removedBy,
      'session_tag.remove',
      'session_tag',
      sessionTagId,
      JSON.stringify({ sessionId, tagDefinitionId, tagName }),
    ],
  );
}
