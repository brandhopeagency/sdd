import { getPool } from '../db';
import type { GroupSurveyOrderItem } from '@mentalhelpglobal/chat-types';

export async function getGroupSurveyOrder(groupId: string): Promise<GroupSurveyOrderItem[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       gso.instance_id,
       si.title,
       si.public_header,
       si.status,
       gso.display_order,
       si.start_date,
       si.expiration_date,
       si.show_review,
       (SELECT COUNT(*)::int
        FROM survey_responses sr
        WHERE sr.instance_id = si.id
          AND sr.is_complete = true
          AND sr.invalidated_at IS NULL) AS completed_count
     FROM group_survey_order gso
     JOIN survey_instances si ON si.id = gso.instance_id
     WHERE gso.group_id = $1
     ORDER BY gso.display_order ASC`,
    [groupId],
  );

  return result.rows.map((row: any): GroupSurveyOrderItem => ({
    instanceId: row.instance_id,
    title: row.title,
    publicHeader: row.public_header ?? null,
    status: row.status,
    displayOrder: row.display_order,
    startDate: row.start_date,
    expirationDate: row.expiration_date,
    completedCount: Number(row.completed_count),
    showReview: row.show_review ?? true,
  }));
}

export async function updateGroupSurveyOrder(groupId: string, instanceIds: string[]): Promise<void> {
  const pool = getPool();

  const existing = await pool.query(
    'SELECT instance_id FROM group_survey_order WHERE group_id = $1',
    [groupId],
  );
  const existingSet = new Set(existing.rows.map((r: any) => r.instance_id));

  const missing = instanceIds.filter(id => !existingSet.has(id));
  if (missing.length > 0) {
    const err: any = new Error(
      `Instance IDs not found in group order: ${missing.join(', ')}`,
    );
    err.statusCode = 422;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < instanceIds.length; i++) {
      await client.query(
        `UPDATE group_survey_order
         SET display_order = $1, updated_at = now()
         WHERE group_id = $2 AND instance_id = $3`,
        [i + 1, groupId, instanceIds[i]],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
