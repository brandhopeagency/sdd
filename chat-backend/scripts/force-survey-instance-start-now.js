const { Pool } = require('pg');

const instanceId = process.argv[2];
if (!instanceId) {
  console.error('Usage: node scripts/force-survey-instance-start-now.js <instanceId>');
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
    const { rowCount } = await pool.query(
      "update survey_instances set start_date = now() - interval '1 minute' where id = $1",
      [instanceId],
    );
    console.log({ updated: rowCount });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
