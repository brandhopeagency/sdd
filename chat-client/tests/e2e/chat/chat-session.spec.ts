import { test, expect } from '../fixtures/authTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

test('chat: Enter sends message; Shift+Enter creates newline', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  const input = page.getByPlaceholder(/type your message\.\.\./i)
  await expect(input).toBeVisible()

  // Shift+Enter should insert newline
  await input.fill('line1')
  await input.press('Shift+Enter')
  await input.type('line2')
  await expect(input).toHaveValue(/line1[\r\n]+line2/)

  const messageText = `Playwright hello ${Date.now()}`
  await input.fill(messageText)
  await input.press('Enter')

  // Message should appear in transcript
  await expect(page.getByText(messageText)).toBeVisible()
})

test('chat: New Session clears transcript and End Chat returns to welcome', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  const input = page.getByPlaceholder(/type your message\.\.\./i)
  const messageText = `Session test ${Date.now()}`
  await input.fill(messageText)
  await input.press('Enter')
  await expect(page.getByText(messageText)).toBeVisible()

  await page.getByRole('button', { name: /^new session$/i }).click()

  // The previous message should be gone after starting a new session.
  await expect(page.getByText(messageText)).toHaveCount(0)

  // End chat should return to welcome screen
  await page.getByRole('button', { name: /^end chat$/i }).click()
  await expect(page).toHaveURL(/#\/(\/|$)/)

  // Welcome screen should show start CTA again.
  await expect(page.getByRole('button', { name: /start a conversation/i })).toBeVisible()
})


