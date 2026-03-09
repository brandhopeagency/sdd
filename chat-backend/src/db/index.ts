import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { logResilience } from '../utils/resilience-logger';

const TRANSIENT_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'];

function getRetryConfig() {
  return {
    maxAttempts: Number(process.env.DB_RETRY_MAX_ATTEMPTS) || 3,
    initialDelayMs: Number(process.env.DB_RETRY_INITIAL_DELAY_MS) || 500,
    maxDelayMs: Number(process.env.DB_RETRY_MAX_DELAY_MS) || 5000,
  };
}

function isTransientError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return typeof code === 'string' && TRANSIENT_ERROR_CODES.includes(code);
}

function delayWithJitter(baseMs: number): number {
  const jitter = 1 + (Math.random() * 0.5 - 0.25); // ±25%
  return Math.round(baseMs * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class DbUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DbUnavailableError';
  }
}

async function withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs } = getRetryConfig();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientError(error) || attempt === maxAttempts) {
        if (isTransientError(error)) {
          logResilience('resilience.db_retry', {
            label,
            attempt,
            maxAttempts,
            errorCode: (error as { code?: string }).code,
            exhausted: true,
          });
          throw new DbUnavailableError(
            `Database unavailable after ${maxAttempts} attempts`,
            error,
          );
        }
        throw error;
      }

      const rawDelay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const delayMs = delayWithJitter(rawDelay);

      logResilience('resilience.db_retry', {
        label,
        attempt,
        maxAttempts,
        errorCode: (error as { code?: string }).code,
        delayMs,
        exhausted: false,
      });

      await sleep(delayMs);
    }
  }

  throw new DbUnavailableError('Database unavailable (unreachable code)');
}

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
    });

    // Log pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

    console.log('✓ Database pool created');
  }

  return pool;
}

/**
 * Execute a query with automatic client management and transient-error retry.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return withRetry(async () => {
    const p = getPool();
    const start = Date.now();

    try {
      const result = await p.query<T>(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB] Query executed in ${duration}ms`, {
          text: text.substring(0, 100),
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      console.error('[DB] Query error:', error);
      throw error;
    }
  }, `query(${text.substring(0, 40)})`);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

/**
 * Execute multiple queries in a transaction with transient-error retry
 * on initial connection acquisition.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await withRetry(() => getClient(), 'transaction(connect)');

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize database schema and run migrations
 */
export async function initializeDatabase(): Promise<void> {
  // 1. Run base schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠ Schema file not found at', schemaPath);
    return;
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  try {
    await query(schema);
    console.log('✓ Database schema initialized');
  } catch (error) {
    // Log error but continue to migrations - migrations handle incremental changes
    // This allows existing databases to be updated via migrations even if schema.sql
    // has changed in ways that conflict with existing structures
    const pgError = error as any;
    if (pgError.code === '42P07') { // duplicate_table - expected for existing DB
      console.log('  (Schema tables already exist)');
    } else {
      console.warn('[DB] Schema initialization had issues (continuing to migrations):', pgError.message || error);
    }
  }

  // 2. Run migrations
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠ Migrations directory not found at', migrationsDir);
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Execute in order

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    
    try {
      await query(migration);
      console.log(`✓ Migration executed: ${file}`);
    } catch (error) {
      const pgError = error as any;
      if (pgError.code === '42P07' || pgError.code === '42710' || pgError.code === '42701') {
        console.log(`  (Migration ${file} already applied)`);
      } else {
        console.error(`Error executing migration ${file}:`, pgError.message || error);
        throw error;
      }
    }
  }
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✓ Database pool closed');
  }
}

/**
 * Check database connection health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch {
    return false;
  }
}

/**
 * Cleanup expired OTPs and refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<{ otps: number; refreshTokens: number }> {
  const [otpResult, tokenResult] = await Promise.all([
    query('SELECT cleanup_expired_otps() as count'),
    query('SELECT cleanup_expired_refresh_tokens() as count')
  ]);
  
  return {
    otps: otpResult.rows[0]?.count || 0,
    refreshTokens: tokenResult.rows[0]?.count || 0
  };
}

export default {
  getPool,
  query,
  getClient,
  transaction,
  initializeDatabase,
  closePool,
  checkHealth,
  cleanupExpiredTokens
};
