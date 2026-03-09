import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { TEST_ROLES, type TestRole } from '../fixtures/roles'
import { initLanguage } from './i18n'
import { gotoRoute } from './routes'

export interface LoginWithOtpOptions {
  email: string
  /**
   * How long to wait for OTP devCode to appear in the browser console.
   */
  otpTimeoutMs?: number
}

function extractOtpCodeFromConsoleLine(text: string): string | null {
  // Example logged line:
  // "║  Code:    123456                                             ║"
  const match = text.match(/\bCode:\s*([0-9]{6})\b/)
  return match?.[1] ?? null
}

async function waitForOtpFromConsole(page: Page, timeoutMs: number): Promise<string> {
  let found: string | null = null

  const onConsole = (msg: any) => {
    try {
      const text = typeof msg?.text === 'function' ? String(msg.text()) : ''
      const code = extractOtpCodeFromConsoleLine(text)
      if (code) found = code
    } catch {
      // ignore listener errors to avoid masking test failures
    }
  }

  page.on('console', onConsole)
  try {
    await expect
      .poll(() => found, { timeout: timeoutMs, message: 'Waiting for OTP devCode in browser console' })
      .not.toBeNull()
    return found!
  } finally {
    page.off('console', onConsole)
  }
}

export async function loginWithOtp(page: Page, opts: LoginWithOtpOptions) {
  const otpTimeoutMs = opts.otpTimeoutMs ?? 30_000
  const email = opts.email

  // Ensure predictable locators (English strings) and make sure it applies before the app boots.
  await initLanguage(page, 'en')

  await gotoRoute(page, '/login')

  // Step 1: Send code
  // NOTE: labels are not associated via `htmlFor`, so use placeholder-based locators.
  const emailInput = page.getByPlaceholder(/you@example\.com/i)
  await expect(emailInput).toBeVisible()
  await emailInput.fill(email)

  const sendCodeBtn = page.getByRole('button', { name: /^send code$/i })
  await expect(sendCodeBtn).toBeEnabled()

  // Start listening before clicking.
  const otpPromise = waitForOtpFromConsole(page, otpTimeoutMs)
  await sendCodeBtn.click()

  // Step 2: Verify code
  const codeInput = page.getByPlaceholder(/^000000$/)
  await expect(codeInput).toBeVisible({ timeout: otpTimeoutMs })

  const code = await otpPromise
  await codeInput.fill(code)

  const verifyBtn = page.getByRole('button', { name: /^verify$/i })
  await expect(verifyBtn).toBeEnabled()
  await verifyBtn.click()

  // Successful login should land us on the app's main route.
  await expect(page).toHaveURL(/\/(chat|workbench)(\/|$)/)
}

export interface EnsureOtpStorageStateOptions extends LoginWithOtpOptions {
  storageStatePath: string
}

/**
 * Returns the storage state file path for a given test role and domain.
 * Each role+domain pair gets its own cached auth state.
 */
export function storageStatePathForRole(role: TestRole, baseURL?: string): string {
  const domainSuffix = baseURL
    ? `-${new URL(baseURL).hostname.replace(/[^a-z0-9]/g, '-')}`
    : ''
  return path.resolve(process.cwd(), `tests/e2e/.auth/${role}${domainSuffix}-playwright.json`)
}

/**
 * Creates a Playwright `storageState` file for OTP-authenticated sessions.
 * Intended usage in tests:
 * - `test.beforeAll(async ({ browser }) => ensureOtpStorageState(browser, {...}))`
 * - `test.use({ storageState: 'path/to/file.json' })`
 *
 * When `role` is provided, uses the corresponding test account from `TEST_ROLES`
 * and caches the storage state at `tests/e2e/.auth/{role}-playwright.json`.
 */
export async function ensureOtpStorageState(
  browser: Browser,
  opts: EnsureOtpStorageStateOptions | { role: TestRole; baseURL?: string },
) {
  const baseURL = 'baseURL' in opts ? opts.baseURL : undefined
  const resolvedOpts: EnsureOtpStorageStateOptions =
    'role' in opts
      ? {
          email: TEST_ROLES[opts.role].email,
          storageStatePath: storageStatePathForRole(opts.role, baseURL),
        }
      : opts
  const targetPath = resolvedOpts.storageStatePath
  const lockPath = `${targetPath}.lock`

  if (fs.existsSync(targetPath)) return

  let lockFd: number | null = null
  try {
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      lockFd = fs.openSync(lockPath, 'wx')
    } catch {
      lockFd = null
    }

    if (lockFd == null) {
      const deadline = Date.now() + 60_000
      while (!fs.existsSync(targetPath)) {
        if (Date.now() > deadline) {
          throw new Error(`Timed out waiting for storageState to be created: ${targetPath}`)
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      return
    }

    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    try {
      await loginWithOtp(page, resolvedOpts)
      await context.storageState({ path: targetPath })
    } finally {
      await context.close()
    }
  } finally {
    if (lockFd != null) {
      try {
        fs.closeSync(lockFd)
      } catch {
        // ignore
      }
      try {
        fs.unlinkSync(lockPath)
      } catch {
        // ignore
      }
    }
  }
}


