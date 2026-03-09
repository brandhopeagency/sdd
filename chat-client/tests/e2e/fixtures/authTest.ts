import path from 'node:path'
import { test as base, expect } from './e2eTest'
import { ensureOtpStorageState } from '../helpers/auth'

const DEFAULT_EMAIL = process.env.PLAYWRIGHT_EMAIL || 'playwright@mentalhelp.global'
const STORAGE_STATE = path.resolve(process.cwd(), 'tests/e2e/.auth/playwright.json')

/**
 * Authenticated test fixture.
 *
 * Ensures a storageState exists (using OTP login + console devCode) and then
 * creates a context with that storageState.
 *
 * This avoids OTP collisions when tests run in parallel.
 */
export const test = base.extend({
  context: async ({ browser }, provide) => {
    await ensureOtpStorageState(browser, {
      email: DEFAULT_EMAIL,
      storageStatePath: STORAGE_STATE,
    })

    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await provide(context)
    await context.close()
  },
})

export { expect }


