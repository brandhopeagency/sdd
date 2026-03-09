import { test as base, expect } from './e2eTest'
import { ensureOtpStorageState, storageStatePathForRole } from '../helpers/auth'
import type { TestRole } from './roles'

/**
 * Authenticated test fixture with multi-role support.
 *
 * Ensures a storageState exists for the given role (using OTP login + console
 * devCode) and then creates a context with that storageState.
 *
 * Usage:
 *   - Default (owner):      `import { test } from '../fixtures/authTest'`
 *   - Specific role:        `test.use({ role: 'moderator' })`
 *   - Inline override:      `test('...', async ({ page }) => { ... })`
 */
export const test = base.extend<{ role: TestRole }>({
  role: ['owner', { option: true }],

  context: async ({ browser, role, baseURL }, provide) => {
    await ensureOtpStorageState(browser, { role, baseURL: baseURL ?? undefined })

    const storagePath = storageStatePathForRole(role, baseURL ?? undefined)
    const context = await browser.newContext({ storageState: storagePath, baseURL: baseURL ?? undefined })
    await provide(context)
    await context.close()
  },
})

export { expect }
