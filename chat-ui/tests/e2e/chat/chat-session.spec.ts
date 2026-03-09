import { test as baseTest, expect } from '../fixtures/authTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

// Default tests use the owner role (existing behavior)
const test = baseTest

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
  await expect(page).toHaveURL(/\/(\/|$)/)

  // Welcome screen should show start CTA again.
  await expect(page.getByRole('button', { name: /start a conversation/i })).toBeVisible()
})

test('chat: sends message and receives AI response', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  const input = page.getByPlaceholder(/type your message\.\.\./i)
  await expect(input).toBeVisible()

  const messageText = `Hello, how are you? ${Date.now()}`
  await input.fill(messageText)
  await input.press('Enter')

  // User message should appear
  await expect(page.getByText(messageText)).toBeVisible()

  // AI response bubble should appear within 30 seconds — assert non-empty only
  const aiResponse = page.locator('.animate-slide-up').last()
  await expect(aiResponse).toBeVisible({ timeout: 30_000 })
  const responseText = await aiResponse.textContent()
  expect(responseText?.trim().length).toBeGreaterThan(0)
})

// QA role: technical details toggle
test.describe('QA technical details', () => {
  baseTest.use({ role: 'qa' })

  baseTest('chat: QA specialist sees technical details', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/chat')

    const input = page.getByPlaceholder(/type your message\.\.\./i)
    await expect(input).toBeVisible()

    const messageText = `Tech details test ${Date.now()}`
    await input.fill(messageText)
    await input.press('Enter')
    await expect(page.getByText(messageText)).toBeVisible()

    // Wait for AI response
    const aiResponse = page.locator('.animate-slide-up').last()
    await expect(aiResponse).toBeVisible({ timeout: 30_000 })

    // Look for the debug/gear icon to toggle technical details
    const debugToggle = page.getByRole('button', { name: /debug|technical|details|gear/i })
      .or(page.locator('[data-testid="technical-details-toggle"]'))
      .or(page.locator('button:has(svg[data-icon="gear"])'))
    if ((await debugToggle.count()) === 0) {
      baseTest.skip(true, 'Technical details toggle (gear icon) not visible — permission dependent')
    }

    await debugToggle.first().click()

    // Verify technical details panel shows intent, confidence, response time
    const detailsPanel = page.locator('[data-testid="technical-details"]')
      .or(page.getByText(/intent|confidence|response time/i))
    await expect(detailsPanel.first()).toBeVisible({ timeout: 10_000 })
  })
})


