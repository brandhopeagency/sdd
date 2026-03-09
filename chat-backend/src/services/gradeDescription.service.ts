import { getPool } from '../db';
import type { GradeDescription, UpdateGradeDescriptionInput } from '@mentalhelpglobal/chat-types';

function rowToGradeDescription(row: any): GradeDescription {
  return {
    scoreLevel: Number(row.score_level),
    description: row.description,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
  };
}

export async function getAllGradeDescriptions(): Promise<GradeDescription[]> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM grade_descriptions ORDER BY score_level DESC');
  return result.rows.map(rowToGradeDescription);
}

export async function getGradeDescription(scoreLevel: number): Promise<GradeDescription | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM grade_descriptions WHERE score_level = $1', [scoreLevel]);
  if (result.rows.length === 0) return null;
  return rowToGradeDescription(result.rows[0]);
}

export async function updateGradeDescription(
  scoreLevel: number,
  input: UpdateGradeDescriptionInput,
  updatedBy: string,
): Promise<GradeDescription> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE grade_descriptions
     SET description = $1, updated_by = $2, updated_at = NOW()
     WHERE score_level = $3
     RETURNING *`,
    [input.description, updatedBy, scoreLevel],
  );

  if (result.rows.length === 0) {
    const error: any = new Error(`Grade description for level ${scoreLevel} not found`);
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return rowToGradeDescription(result.rows[0]);
}
