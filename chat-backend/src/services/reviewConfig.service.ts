import { getPool } from '../db';
import type { ReviewConfiguration, UpdateReviewConfigInput } from '@mentalhelpglobal/chat-types';

// ── In-memory cache ──

let cachedConfig: ReviewConfiguration | null = null;

function rowToConfig(row: any): ReviewConfiguration {
  return {
    id: row.id,
    minReviews: Number(row.min_reviews),
    maxReviews: Number(row.max_reviews),
    criteriaThreshold: Number(row.criteria_threshold),
    autoFlagThreshold: Number(row.auto_flag_threshold),
    varianceLimit: Number(row.variance_limit),
    timeoutHours: Number(row.timeout_hours),
    highRiskSlaHours: Number(row.high_risk_sla_hours),
    mediumRiskSlaHours: Number(row.medium_risk_sla_hours),
    deanonymizationAccessHours: Number(row.deanonymization_access_hours),
    minMessageThreshold: Number(row.min_message_threshold ?? 4),
    supervisionPolicy: row.supervision_policy ?? 'none',
    supervisionSamplePercentage: Number(row.supervision_sample_percentage ?? 100),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    updatedBy: row.updated_by ?? null,
  };
}

/**
 * Get the review configuration (singleton row), using in-memory cache.
 */
export async function getConfig(): Promise<ReviewConfiguration> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const pool = getPool();
  const result = await pool.query('SELECT * FROM review_configuration WHERE id = 1');

  if (result.rows.length === 0) {
    throw new Error('Review configuration not found — ensure the review_configuration table is seeded');
  }

  cachedConfig = rowToConfig(result.rows[0]);
  return cachedConfig;
}

/**
 * Update the review configuration with the provided fields.
 * Builds a dynamic SET clause from non-undefined input fields.
 * Invalidates cache and returns the updated configuration.
 */
export async function updateConfig(
  updates: UpdateReviewConfigInput,
  updatedBy: string,
): Promise<ReviewConfiguration> {
  const fieldMap: Record<string, unknown> = {};

  if (updates.minReviews !== undefined) fieldMap['min_reviews'] = updates.minReviews;
  if (updates.maxReviews !== undefined) fieldMap['max_reviews'] = updates.maxReviews;
  if (updates.criteriaThreshold !== undefined) fieldMap['criteria_threshold'] = updates.criteriaThreshold;
  if (updates.autoFlagThreshold !== undefined) fieldMap['auto_flag_threshold'] = updates.autoFlagThreshold;
  if (updates.varianceLimit !== undefined) fieldMap['variance_limit'] = updates.varianceLimit;
  if (updates.timeoutHours !== undefined) fieldMap['timeout_hours'] = updates.timeoutHours;
  if (updates.highRiskSlaHours !== undefined) fieldMap['high_risk_sla_hours'] = updates.highRiskSlaHours;
  if (updates.mediumRiskSlaHours !== undefined) fieldMap['medium_risk_sla_hours'] = updates.mediumRiskSlaHours;
  if (updates.deanonymizationAccessHours !== undefined) fieldMap['deanonymization_access_hours'] = updates.deanonymizationAccessHours;
  if (updates.minMessageThreshold !== undefined) fieldMap['min_message_threshold'] = updates.minMessageThreshold;
  if (updates.supervisionPolicy !== undefined) fieldMap['supervision_policy'] = updates.supervisionPolicy;
  if (updates.supervisionSamplePercentage !== undefined) fieldMap['supervision_sample_percentage'] = updates.supervisionSamplePercentage;

  const columns = Object.keys(fieldMap);

  if (columns.length === 0) {
    // Nothing to update — return current config
    return getConfig();
  }

  // Always set updated_by and updated_at
  columns.push('updated_by');
  fieldMap['updated_by'] = updatedBy;
  columns.push('updated_at');
  fieldMap['updated_at'] = new Date();

  const setClauses = columns.map((col, i) => `${col} = $${i + 1}`);
  const values = columns.map((col) => fieldMap[col]);

  const sql = `UPDATE review_configuration SET ${setClauses.join(', ')} WHERE id = 1 RETURNING *`;

  const pool = getPool();
  const result = await pool.query(sql, values);

  invalidateCache();
  cachedConfig = rowToConfig(result.rows[0]);
  return cachedConfig;
}

/**
 * Invalidate the in-memory configuration cache.
 */
export function invalidateCache(): void {
  cachedConfig = null;
}
