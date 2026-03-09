import { getPool } from '../db';
import type { SurveyInstance, SurveyInstanceListItem, SurveyResponse } from '@mentalhelpglobal/chat-types';
import { SurveyInstanceStatus } from '@mentalhelpglobal/chat-types';

function rowToInstance(row: any): SurveyInstance {
  return {
    id: row.id,
    schemaId: row.schema_id,
    schemaSnapshot: row.schema_snapshot,
    title: row.title,
    status: row.status as SurveyInstanceStatus,
    publicHeader: row.public_header ?? null,
    showReview: row.show_review ?? true,
    addToMemory: row.add_to_memory ?? false,
    groupIds: row.group_ids ?? [],
    startDate: row.start_date,
    expirationDate: row.expiration_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? null,
    updatedAt: row.updated_at,
    completedCount: row.completed_count !== undefined ? Number(row.completed_count) : undefined,
  } as SurveyInstance;
}

function rowToListItem(row: any): SurveyInstanceListItem {
  return {
    id: row.id,
    schemaId: row.schema_id,
    title: row.title,
    status: row.status as SurveyInstanceStatus,
    publicHeader: row.public_header ?? null,
    showReview: row.show_review ?? true,
    addToMemory: row.add_to_memory ?? false,
    groupIds: row.group_ids ?? [],
    startDate: row.start_date,
    expirationDate: row.expiration_date,
    completedCount: Number(row.completed_count ?? 0),
    createdAt: row.created_at,
  } as SurveyInstanceListItem;
}

export async function createInstance(
  schemaId: string,
  groupIds: string[],
  addToMemory: boolean,
  startDate: string,
  expirationDate: string,
  createdBy: string,
  publicHeader?: string | null,
  showReview?: boolean,
): Promise<SurveyInstance> {
  const pool = getPool();

  const schema = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [schemaId]);
  if (schema.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }
  if (schema.rows[0].status !== 'published') {
    const err: any = new Error('Instances can only be created from published schemas');
    err.statusCode = 422;
    throw err;
  }

  if (!startDate) {
    const err: any = new Error('startDate is required');
    err.statusCode = 422;
    throw err;
  }
  if (!expirationDate) {
    const err: any = new Error('expirationDate is required');
    err.statusCode = 422;
    throw err;
  }
  if (new Date(expirationDate) <= new Date(startDate)) {
    const err: any = new Error('expirationDate must be after startDate');
    err.statusCode = 422;
    throw err;
  }
  if (!groupIds || groupIds.length === 0) {
    const err: any = new Error('At least one group is required');
    err.statusCode = 422;
    throw err;
  }

  const schemaRow = schema.rows[0];
  const snapshot = {
    id: schemaRow.id,
    title: schemaRow.title,
    description: schemaRow.description,
    status: schemaRow.status,
    questions: schemaRow.questions,
    clonedFromId: schemaRow.cloned_from_id,
    createdBy: schemaRow.created_by,
    createdAt: schemaRow.created_at,
    publishedAt: schemaRow.published_at,
    archivedAt: schemaRow.archived_at,
    updatedAt: schemaRow.updated_at,
  };

  const result = await pool.query(
    `INSERT INTO survey_instances
       (schema_id, schema_snapshot, title, add_to_memory, public_header, show_review, group_ids, start_date, expiration_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      schemaId,
      JSON.stringify(snapshot),
      schemaRow.title,
      !!addToMemory,
      publicHeader ?? null,
      showReview ?? true,
      groupIds,
      startDate,
      expirationDate,
      createdBy,
    ],
  );

  const instance = rowToInstance(result.rows[0]);

  for (const gid of groupIds) {
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM group_survey_order WHERE group_id = $1',
      [gid],
    );
    await pool.query(
      `INSERT INTO group_survey_order (group_id, instance_id, display_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, instance_id) DO NOTHING`,
      [gid, instance.id, Number(maxOrder.rows[0].max_order) + 1],
    );
  }

  return instance;
}

export async function getInstanceById(id: string): Promise<SurveyInstance | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT si.*,
       (SELECT COUNT(*)::int FROM survey_responses WHERE instance_id = si.id AND is_complete = true AND invalidated_at IS NULL) AS completed_count
     FROM survey_instances si
     WHERE si.id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return rowToInstance(result.rows[0]);
}

export async function listInstances(
  statusFilter?: string,
  schemaIdFilter?: string,
): Promise<SurveyInstanceListItem[]> {
  const pool = getPool();
  const where: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (statusFilter) {
    where.push(`si.status = $${idx++}`);
    values.push(statusFilter);
  }
  if (schemaIdFilter) {
    where.push(`si.schema_id = $${idx++}`);
    values.push(schemaIdFilter);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT si.*,
       (SELECT COUNT(*)::int FROM survey_responses WHERE instance_id = si.id AND is_complete = true AND invalidated_at IS NULL) AS completed_count
     FROM survey_instances si
     ${whereSql}
     ORDER BY si.created_at DESC`,
    values,
  );

  return result.rows.map(rowToListItem);
}

export async function closeInstance(id: string): Promise<SurveyInstance> {
  const pool = getPool();
  const current = await pool.query('SELECT * FROM survey_instances WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Instance not found');
    err.statusCode = 404;
    throw err;
  }
  if (current.rows[0].status !== 'active') {
    const err: any = new Error('Only active instances can be closed');
    err.statusCode = 422;
    throw err;
  }
  const result = await pool.query(
    `UPDATE survey_instances SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = $1
     RETURNING *, (SELECT COUNT(*) FROM survey_responses WHERE instance_id = $1 AND is_complete = true AND invalidated_at IS NULL)::int AS completed_count`,
    [id],
  );
  return rowToInstance(result.rows[0]);
}

export async function getResponsesForInstance(instanceId: string): Promise<SurveyResponse[]> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM survey_responses WHERE instance_id = $1 ORDER BY started_at DESC',
    [instanceId],
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    instanceId: row.instance_id,
    pseudonymousId: row.pseudonymous_id,
    groupId: row.group_id ?? null,
    answers: row.answers ?? [],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    isComplete: row.is_complete,
    invalidatedAt: row.invalidated_at ?? null,
    invalidatedBy: row.invalidated_by ?? null,
    invalidationReason: row.invalidation_reason ?? null,
  }));
}
