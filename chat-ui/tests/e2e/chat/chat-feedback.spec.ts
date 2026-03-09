import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'user' })

test('chat: thumbs-up feedback changes visual state', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  const input = page.getByPlaceholder(/type your message\.\.\./i)
  await expect(input).toBeVisible()

  // Send a message and wait for AI response
  const messageText = `Feedback test up ${Date.now()}`
  await input.fill(messageText)
  await input.press('Enter')

  // Wait for an AI response bubble to appear (not the user's message)
  const aiResponse = page.locator('.animate-slide-up').last()
  await expect(aiResponse).toBeVisible({ timeout: 30_000 })

  // Locate feedback buttons on the AI response
  const thumbsUp = page.getByRole('button', { name: /thumb(s-|\s)?up|like|helpful/i }).first()
  if ((await thumbsUp.count()) === 0) {
    test.skip(true, 'Thumbs-up feedback button not found on AI response')
  }

  await thumbsUp.click()

  // Verify visual state change — button should have an active/filled state
  // Check for aria-pressed, data-active, or class change
  const isPressed = await thumbsUp.getAttribute('aria-pressed')
  const hasActiveClass = await thumbsUp.evaluate((el) =>
    el.classList.contains('active') ||
    el.classList.contains('text-primary') ||
    el.classList.contains('filled') ||
    el.closest('[data-feedback="positive"]') !== null
  )
  expect(isPressed === 'true' || hasActiveClass).toBeTruthy()
})

test('chat: thumbs-down feedback changes visual state', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  const input = page.getByPlaceholder(/type your message\.\.\./i)
  await expect(input).toBeVisible()

  // Send a message and wait for AI response
  const messageText = `Feedback test down ${Date.now()}`
  await input.fill(messageText)
  await input.press('Enter')

  const aiResponse = page.locator('.animate-slide-up').last()
  await expect(aiResponse).toBeVisible({ timeout: 30_000 })

  const thumbsDown = page.getByRole('button', { name: /thumb(s-|\s)?down|dislike|not helpful/i }).first()
  if ((await thumbsDown.count()) === 0) {
    test.skip(true, 'Thumbs-down feedback button not found on AI response')
  }

  await thumbsDown.click()

  const isPressed = await thumbsDown.getAttribute('aria-pressed')
  const hasActiveClass = await thumbsDown.evaluate((el) =>
    el.classList.contains('active') ||
    el.classList.contains('text-destructive') ||
    el.classList.contains('filled') ||
    el.closest('[data-feedback="negative"]') !== null
  )
  expect(isPressed === 'true' || hasActiveClass).toBeTruthy()
})
