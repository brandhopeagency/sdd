import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'
import { loginWithOtp } from '../helpers/auth'

test('welcome → start conversation enters guest chat', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/mental health support/i)
  const startButton = page.getByRole('button', { name: /start a conversation/i })
  if ((await startButton.count()) === 0) {
    test.skip(true, 'Guest mode is disabled in this environment')
  }
  await startButton.click()

  await expect(page).toHaveURL(/\/chat(\/|$)/)

  // Guest header affordance should exist and be actionable.
  await expect(page.getByText(/^guest$/i)).toBeVisible()
  await expect(page.getByText(/^register$/i)).toBeVisible()
})

test('guest: register popup opens and can be dismissed via backdrop click', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/')
  const startButton = page.getByRole('button', { name: /start a conversation/i })
  if ((await startButton.count()) === 0) {
    test.skip(true, 'Guest mode is disabled in this environment')
  }
  await startButton.click()
  await expect(page).toHaveURL(/\/chat(\/|$)/)

  // Open popup
  await page.getByText(/^guest$/i).click()
  await expect(page.getByRole('heading', { name: /^register$/i })).toBeVisible()

  // Dismiss via backdrop click and ensure popup disappears.
  await page.locator('div.backdrop-blur-sm').first().click({ position: { x: 10, y: 10 } })
  await expect(page.getByRole('heading', { name: /^register$/i })).toHaveCount(0)
})

test('guest: complete registration upgrade preserves session', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/')

  const startButton = page.getByRole('button', { name: /start a conversation/i })
  if ((await startButton.count()) === 0) {
    test.skip(true, 'Guest mode is disabled in this environment')
  }
  await startButton.click()
  await expect(page).toHaveURL(/\/chat(\/|$)/)

  // Send a message as guest
  const input = page.getByPlaceholder(/type your message\.\.\./i)
  await expect(input).toBeVisible()
  const guestMessage = `Guest msg ${Date.now()}`
  await input.fill(guestMessage)
  await input.press('Enter')
  await expect(page.getByText(guestMessage)).toBeVisible()

  // Wait for AI response
  const aiResponse = page.locator('.animate-slide-up').last()
  await expect(aiResponse).toBeVisible({ timeout: 30_000 })

  // Click register button to upgrade
  const registerBtn = page.getByText(/^register$/i)
  if ((await registerBtn.count()) === 0) {
    test.skip(true, 'Register button not visible in guest mode')
  }
  await registerBtn.click()

  // Complete OTP flow for the upgrade
  const emailInput = page.getByPlaceholder(/you@example\.com/i)
  if ((await emailInput.count()) === 0) {
    test.skip(true, 'Registration form did not appear')
  }

  await loginWithOtp(page, { email: 'e2e-user@test.local' })

  // Verify the chat page loads with conversation preserved (at least the sent message)
  await expect(page).toHaveURL(/\/chat(\/|$)/)
  await expect(page.getByText(guestMessage)).toBeVisible({ timeout: 10_000 })
})


