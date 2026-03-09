/**
 * Playwright globalSetup — runs once before any test worker starts.
 *
 * Phase 1: Seed/verify test user accounts in the database.
 * Phase 2: Pre-flight checks (CDN cache headers, backend health).
 *
 * @see specs/008-e2e-test-standards/contracts/global-setup-contract.md
 */

import type { FullConfig } from '@playwright/test'
import { TEST_ROLES } from './fixtures/roles'

const SEED_SQL = `
  INSERT INTO users (email, role, status, approved_at, created_at, updated_at)
  VALUES ($1, $2, 'active', NOW(), NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    approved_at = COALESCE(users.approved_at, NOW()),
    updated_at = NOW()
`

/** Phase 1: Seed test users in the database. */
async function seedTestUsers(): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return '⚠ DATABASE_URL not set — skipping seed'
  }

  let Client: typeof import('pg').Client
  try {
    // Dynamic import so pg is only loaded when DATABASE_URL is present
    const pg = await import('pg')
    Client = pg.default?.Client ?? pg.Client
  } catch {
    return '⚠ pg module not available — skipping seed'
  }

  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()

    let seeded = 0
    const total = Object.keys(TEST_ROLES).length

    for (const [_key, { email, role }] of Object.entries(TEST_ROLES)) {
      try {
        await client.query(SEED_SQL, [email, role])
        seeded++
      } catch (err: any) {
        // If the role value is invalid, this is a sync issue — abort
        if (err?.message?.includes('invalid input value') || err?.code === '22P02') {
          throw new Error(
            `Invalid role "${role}" for ${email}. ` +
              `Ensure TEST_ROLES matches the UserRole enum in the database.`
          )
        }
        console.warn(`[globalSetup] ⚠ Failed to seed ${email}: ${err?.message}`)
      }
    }

    return `${seeded}/${total} test users verified ✓`
  } catch (err: any) {
    if (err?.message?.includes('Invalid role')) {
      throw err // Re-throw role validation errors
    }
    return `⚠ Database connection failed: ${err?.message}`
  } finally {
    try {
      await client.end()
    } catch {
      // ignore cleanup errors
    }
  }
}

/** Phase 2a: Check CDN cache headers on the frontend URL. */
async function checkCdnHeaders(baseUrl: string): Promise<string> {
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return 'skipped (local dev)'
  }

  try {
    const response = await fetch(baseUrl, { method: 'HEAD' })
    const cacheControl = response.headers.get('cache-control') ?? ''

    if (
      cacheControl.includes('no-cache') ||
      cacheControl.includes('no-store') ||
      cacheControl.includes('must-revalidate')
    ) {
      return `Cache-Control: ${cacheControl} confirmed ✓`
    }

    return `⚠ Cache-Control header is "${cacheControl}" — expected no-cache`
  } catch (err: any) {
    return `⚠ CDN check failed: ${err?.message}`
  }
}

/** Phase 2b: Check backend health endpoint. */
async function checkBackendHealth(): Promise<string> {
  const apiUrl = process.env.VITE_API_URL || process.env.API_BASE_URL
  if (!apiUrl) {
    return 'skipped (no API URL configured)'
  }

  // Derive health endpoint from API URL
  const healthUrl = apiUrl.replace(/\/api\/?$/, '') + '/health'

  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
    if (response.ok) {
      return 'Health check passed ✓'
    }
    return `⚠ Health check returned ${response.status}`
  } catch (err: any) {
    return `⚠ Health check failed: ${err?.message}`
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseUrl =
    config.projects?.[0]?.use?.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'http://localhost:4173'

  console.log('')

  // Phase 1: Seed
  const seedResult = await seedTestUsers()
  console.log(`[globalSetup] Seed: ${seedResult}`)

  // Phase 2: Pre-flight checks
  const cdnResult = await checkCdnHeaders(baseUrl)
  console.log(`[globalSetup] CDN:  ${cdnResult}`)

  const apiResult = await checkBackendHealth()
  console.log(`[globalSetup] API:  ${apiResult}`)

  console.log('')
}
