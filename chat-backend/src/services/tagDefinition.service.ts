import { getPool } from '../db';

// ── Types ──

export interface TagDefinition {
  id: string;
  name: string;
  description: string | null;
  category: 'user' | 'chat';
  excludeFromReviews: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagDefinitionInput {
  name: string;
  description?: string;
  category: 'user' | 'chat';
  excludeFromReviews?: boolean;
}

export interface UpdateTagDefinitionInput {
  name?: string;
  description?: string;
  excludeFromReviews?: boolean;
  isActive?: boolean;
}

export interface ListTagDefinitionsParams {
  category?: 'user' | 'chat';
  active?: boolean;
}

export interface DeleteTagResult {
  userTagsRemoved: number;
  sessionTagsRemoved: number;
}

// ── Row mapper ──

function rowToTagDefinition(row: any): TagDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    excludeFromReviews: Boolean(row.exclude_from_reviews),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service functions ──

/**
 * List tag definitions with optional category and active filters.
 */
export async function listTagDefinitions(
  params: ListTagDefinitionsParams = {},
): Promise<TagDefinition[]> {
  const pool = getPool();
  const where: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (params.category !== undefined) {
    where.push(`category = $${i}`);
    values.push(params.category);
    i++;
  }

  if (params.active !== undefined) {
    where.push(`is_active = $${i}`);
    values.push(params.active);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT * FROM tag_definitions ${whereSql} ORDER BY name ASC`,
    values,
  );

  return result.rows.map(rowToTagDefinition);
}

/**
 * Get a single tag definition by ID.
 */
export async function getTagDefinition(id: string): Promise<TagDefinition | null> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT * FROM tag_definitions WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0) return null;
  return rowToTagDefinition(result.rows[0]);
}

/**
 * Create a new tag definition with case-insensitive uniqueness check.
 */
export async function createTagDefinition(
  input: CreateTagDefinitionInput,
  createdBy: string,
): Promise<TagDefinition> {
  const pool = getPool();

  // Case-insensitive uniqueness check
  const existing = await pool.query(
    'SELECT id FROM tag_definitions WHERE LOWER(name) = LOWER($1)',
    [input.name],
  );

  if (existing.rows.length > 0) {
    const error: any = new Error(`A tag definition with the name "${input.name}" already exists`);
    error.statusCode = 409;
    error.code = 'CONFLICT';
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.category,
      input.excludeFromReviews ?? false,
      createdBy,
    ],
  );

  const tag = rowToTagDefinition(result.rows[0]);

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      createdBy,
      'tag_definition.create',
      'tag_definition',
      tag.id,
      JSON.stringify({ name: input.name, category: input.category }),
    ],
  );

  return tag;
}

/**
 * Update an existing tag definition.
 * Performs case-insensitive uniqueness check if name is being changed.
 */
export async function updateTagDefinition(
  id: string,
  input: UpdateTagDefinitionInput,
  updatedBy: string,
): Promise<TagDefinition> {
  const pool = getPool();

  // Verify the tag exists
  const current = await pool.query(
    'SELECT * FROM tag_definitions WHERE id = $1',
    [id],
  );

  if (current.rows.length === 0) {
    const error: any = new Error('Tag definition not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // If renaming, check uniqueness (case-insensitive), excluding self
  if (input.name !== undefined) {
    const duplicate = await pool.query(
      'SELECT id FROM tag_definitions WHERE LOWER(name) = LOWER($1) AND id != $2',
      [input.name, id],
    );

    if (duplicate.rows.length > 0) {
      const error: any = new Error(`A tag definition with the name "${input.name}" already exists`);
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }
  }

  // Build dynamic SET clause
  const fieldMap: Record<string, unknown> = {};
  if (input.name !== undefined) fieldMap['name'] = input.name;
  if (input.description !== undefined) fieldMap['description'] = input.description;
  if (input.excludeFromReviews !== undefined) fieldMap['exclude_from_reviews'] = input.excludeFromReviews;
  if (input.isActive !== undefined) fieldMap['is_active'] = input.isActive;

  const columns = Object.keys(fieldMap);

  if (columns.length === 0) {
    return rowToTagDefinition(current.rows[0]);
  }

  // Always update updated_at
  columns.push('updated_at');
  fieldMap['updated_at'] = new Date();

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 1}`);
  const values = columns.map((col) => fieldMap[col]);

  const sql = `UPDATE tag_definitions SET ${setClauses.join(', ')} WHERE id = $${columns.length + 1} RETURNING *`;

  const result = await pool.query(sql, [...values, id]);
  const tag = rowToTagDefinition(result.rows[0]);

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      updatedBy,
      'tag_definition.update',
      'tag_definition',
      id,
      JSON.stringify({ changes: input }),
    ],
  );

  return tag;
}

/**
 * Delete a tag definition and return counts of affected user/session tag assignments.
 */
export async function deleteTagDefinition(
  id: string,
  deletedBy: string,
): Promise<DeleteTagResult> {
  const pool = getPool();

  // Verify the tag exists
  const current = await pool.query(
    'SELECT * FROM tag_definitions WHERE id = $1',
    [id],
  );

  if (current.rows.length === 0) {
    const error: any = new Error('Tag definition not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Count affected assignments before deletion (CASCADE will remove them)
  const [userTagsResult, sessionTagsResult] = await Promise.all([
    pool.query(
      'SELECT COUNT(*)::int AS count FROM user_tags WHERE tag_definition_id = $1',
      [id],
    ),
    pool.query(
      'SELECT COUNT(*)::int AS count FROM session_tags WHERE tag_definition_id = $1',
      [id],
    ),
  ]);

  const userTagsRemoved = userTagsResult.rows[0]?.count ?? 0;
  const sessionTagsRemoved = sessionTagsResult.rows[0]?.count ?? 0;

  // Delete the tag definition (CASCADE removes user_tags, session_tags)
  await pool.query('DELETE FROM tag_definitions WHERE id = $1', [id]);

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      deletedBy,
      'tag_definition.delete',
      'tag_definition',
      id,
      JSON.stringify({
        name: current.rows[0].name,
        userTagsRemoved,
        sessionTagsRemoved,
      }),
    ],
  );

  return { userTagsRemoved, sessionTagsRemoved };
}
