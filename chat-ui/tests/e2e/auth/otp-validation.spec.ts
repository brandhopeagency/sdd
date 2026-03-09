import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('OTP login: invalid email shows inline validation and does not advance to code step', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/login')

  const emailInput = page.getByPlaceholder(/you@example\.com/i)
  await emailInput.fill('not-an-email')

  await page.getByRole('button', { name: /^send code$/i }).click()

  // The email input is `type="email"`, so browser-native validation may block submission
  // before the app-level error message is rendered.
  const validationMessage = await emailInput.evaluate((el) => (el as HTMLInputElement).validationMessage)
  expect(validationMessage.length).toBeGreaterThan(0)
  await expect(page.getByPlaceholder(/^000000$/)).toHaveCount(0)
})

test('OTP login: invalid OTP shows error and remains on verification step', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/login')

  // Use a dedicated test email to avoid interfering with other OTP-based tests.
  const email = 'playwright+invalid-otp@mentalhelp.global'
  const emailInput = page.getByPlaceholder(/you@example\.com/i)
  await emailInput.fill(email)

  await page.getByRole('button', { name: /^send code$/i }).click()

  const codeInput = page.getByPlaceholder(/^000000$/)
  await expect(codeInput).toBeVisible({ timeout: 30_000 })

  await codeInput.fill('000000')
  await page.getByRole('button', { name: /^verify$/i }).click()

  await expect(page.getByText(/invalid code\. please try again\./i)).toBeVisible({ timeout: 30_000 })
  await expect(codeInput).toBeVisible()
})


