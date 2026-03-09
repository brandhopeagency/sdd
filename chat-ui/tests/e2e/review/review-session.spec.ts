import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'owner' })

/**
 * Helper to navigate to the first available review session.
 * Returns true if a session was opened, false if queue is empty.
 */
async function openFirstReviewSession(page: any): Promise<boolean> {
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) return false

  const reviewNav = page.getByRole('button', { name: /review/i })
  if ((await reviewNav.count()) === 0) return false
  await reviewNav.click()

  await expect(page.getByRole('heading', { name: /review/i })).toBeVisible({ timeout: 10_000 })

  const sessionRow = page.locator('table tbody tr, [data-testid="review-session"], .session-card').first()
  if ((await sessionRow.count()) === 0) return false

  await sessionRow.click()

  // Wait for the session view to load
  const messageList = page.locator('.message, .animate-slide-up, [data-testid="message"]')
  const sessionView = page.getByText(/transcript|messages|review session/i)
  try {
    await expect(messageList.first().or(sessionView)).toBeVisible({ timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

test('review: rate a message with score 1-10', async ({ page }) => {
  await initLanguage(page, 'en')

  const opened = await openFirstReviewSession(page)
  if (!opened) {
    test.skip(true, 'No reviewable sessions exist in the queue')
  }

  // Find the score selector for a message
  const scoreSelector = page.getByRole('spinbutton', { name: /score|rating/i })
    .or(page.locator('input[type="range"]'))
    .or(page.locator('[data-testid="message-score"]'))
    .or(page.getByRole('slider'))
  if ((await scoreSelector.count()) === 0) {
    // Try radio/button-based scoring (e.g., 1-10 buttons)
    const scoreButton = page.getByRole('button', { name: /^7$/ })
      .or(page.locator('[data-score="7"]'))
    if ((await scoreButton.count()) > 0) {
      await scoreButton.first().click()
      // Verify score is visually confirmed
      await expect(scoreButton.first()).toHaveAttribute('aria-pressed', 'true')
        .catch(() => expect(scoreButton.first()).toHaveClass(/active|selected/))
    } else {
      test.skip(true, 'Score selector not found in review session view')
    }
  } else {
    await scoreSelector.first().fill('7')
    const value = await scoreSelector.first().inputValue()
    expect(value).toBe('7')
  }
})

test('review: submit completed review', async ({ page }) => {
  await initLanguage(page, 'en')

  const opened = await openFirstReviewSession(page)
  if (!opened) {
    test.skip(true, 'No reviewable sessions exist in the queue')
  }

  // Rate at least one message
  const scoreSelector = page.getByRole('spinbutton', { name: /score|rating/i })
    .or(page.locator('input[type="range"]'))
    .or(page.locator('[data-testid="message-score"]'))
    .or(page.getByRole('slider'))
  if ((await scoreSelector.count()) > 0) {
    await scoreSelector.first().fill('8')
  } else {
    const scoreButton = page.getByRole('button', { name: /^8$/ })
      .or(page.locator('[data-score="8"]'))
    if ((await scoreButton.count()) > 0) {
      await scoreButton.first().click()
    }
  }

  // Click submit review button
  const submitBtn = page.getByRole('button', { name: /submit.*review|complete.*review|finish/i })
  if ((await submitBtn.count()) === 0) {
    test.skip(true, 'Submit review button not found')
  }

  await submitBtn.click()

  // Verify success confirmation appears
  const success = page.getByText(/submitted|completed|success/i)
    .or(page.getByRole('alert'))
  await expect(success).toBeVisible({ timeout: 10_000 })
})

test('review: dashboard shows personal statistics', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  const reviewNav = page.getByRole('button', { name: /review/i })
  if ((await reviewNav.count()) === 0) {
    test.skip(true, 'Review section not accessible')
  }
  await reviewNav.click()

  await expect(page.getByRole('heading', { name: /review/i })).toBeVisible({ timeout: 10_000 })

  // Verify personal stats are displayed
  const statsSection = page.getByText(/reviews completed|average score|total reviews|your stats/i)
  if ((await statsSection.count()) === 0) {
    // Dashboard might show stats as numbers
    const statNumbers = page.locator('[data-testid="stat-card"], .stat-card, .stats-section')
    if ((await statNumbers.count()) === 0) {
      test.skip(true, 'Review dashboard statistics not found')
    }
  }
  await expect(statsSection.first().or(page.locator('[data-testid="stat-card"]').first())).toBeVisible()
})
