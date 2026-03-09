import { getPool } from '../db';

const DEFAULT_INTERVAL_SECONDS = 60;

async function runStatusTransitions(): Promise<void> {
  const pool = getPool();

  const activated = await pool.query(
    `UPDATE survey_instances
     SET status = 'active', updated_at = now()
     WHERE status = 'draft' AND start_date <= now()
     RETURNING id`,
  );

  if (activated.rowCount && activated.rowCount > 0) {
    console.log(`[SurveyJob] Activated ${activated.rowCount} instance(s):`, activated.rows.map(r => r.id));
    for (const row of activated.rows) {
      await pool.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
         VALUES (NULL, $1, $2, $3, $4)`,
        ['survey_instance.auto_activate', 'survey_instance', row.id, JSON.stringify({ actor: 'system' })],
      );
    }
  }

  const expired = await pool.query(
    `UPDATE survey_instances
     SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND expiration_date <= now()
     RETURNING id`,
  );

  if (expired.rowCount && expired.rowCount > 0) {
    console.log(`[SurveyJob] Expired ${expired.rowCount} instance(s):`, expired.rows.map(r => r.id));
    for (const row of expired.rows) {
      await pool.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
         VALUES (NULL, $1, $2, $3, $4)`,
        ['survey_instance.auto_expire', 'survey_instance', row.id, JSON.stringify({ actor: 'system' })],
      );
    }
  }
}

export function startSurveyStatusJob(): NodeJS.Timeout {
  const intervalSeconds = parseInt(process.env.SURVEY_JOB_INTERVAL_SECONDS || '', 10) || DEFAULT_INTERVAL_SECONDS;
  console.log(`[SurveyJob] Starting survey status job (interval: ${intervalSeconds}s)`);

  void runStatusTransitions().catch(e => console.warn('[SurveyJob] Initial run failed:', e));

  const timer = setInterval(() => {
    void runStatusTransitions().catch(e => console.warn('[SurveyJob] Run failed:', e));
  }, intervalSeconds * 1000);

  timer.unref();
  return timer;
}
