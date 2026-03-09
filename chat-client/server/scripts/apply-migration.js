/**
 * Script to apply database migration
 * Usage: node scripts/apply-migration.js [migration-file] [environment]
 * Example: node scripts/apply-migration.js 004_add_feedback_to_messages.sql dev
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const migrationFile = process.argv[2] || '004_add_feedback_to_messages.sql';
const environment = process.argv[3] || 'dev';

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    console.error(`Please set DATABASE_URL for ${environment} environment`);
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'src', 'db', 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Applying migration ${migrationFile} to ${environment} environment...`);
  console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migration);
    
    console.log('');
    console.log(`✓ Migration ${migrationFile} applied successfully to ${environment}`);
  } catch (error) {
    console.error(`Error applying migration:`, error.message);
    
    // Check if column already exists (safe to ignore)
    if (error.code === '42701' || error.message.includes('already exists')) {
      console.log('  (Column already exists - migration may have been applied already)');
      process.exit(0);
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

