const { Pool } = require('pg');

const instanceId = process.argv[2];
const priorityStr = process.argv[3];

if (!instanceId || !priorityStr) {
  console.error('Usage: node scripts/force-survey-instance-priority.js <instanceId> <priority>');
  process.exit(1);
}

const priority = Number(priorityStr);
if (!Number.isFinite(priority)) {
  console.error('Priority must be a number');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const { rowCount } = await pool.query('update survey_instances set priority = $2 where id = $1', [
      instanceId,
      priority,
    ]);
    console.log({ updated: rowCount, priority });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
