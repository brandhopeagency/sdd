const { Pool } = require('pg');

const instanceId = process.argv[2];
if (!instanceId) {
  console.error('Usage: node scripts/query-survey-instance.js <instanceId>');
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
    const { rows } = await pool.query(
      'select id, status, start_date, expiration_date, add_to_memory from survey_instances where id = $1',
      [instanceId],
    );
    console.log(rows[0] || null);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
