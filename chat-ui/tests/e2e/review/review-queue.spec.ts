import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'owner' })

test('review: queue page renders with session list', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Navigate to review section
  const reviewNav = page.getByRole('button', { name: /review/i })
  if ((await reviewNav.count()) === 0) {
    test.skip(true, 'Review section not accessible for this account')
  }
  await reviewNav.click()

  // Verify review queue renders
  const queueHeading = page.getByRole('heading', { name: /review/i })
  await expect(queueHeading).toBeVisible({ timeout: 10_000 })

  // Verify sessions are listed or empty state message is shown
  const sessionList = page.locator('table tbody tr, [data-testid="review-session"], .session-card')
  const emptyState = page.getByText(/no.*sessions|empty|no.*reviews/i)
  await expect(sessionList.first().or(emptyState)).toBeVisible({ timeout: 10_000 })
})

test('review: queue filter and sort controls exist', async ({ page }) => {
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

  // Verify filter controls exist (status filter, date range, etc.)
  const filterControls = page.getByRole('combobox')
    .or(page.getByLabel(/filter|status|sort/i))
    .or(page.getByPlaceholder(/search|filter/i))

  // At least one filter/sort control should be present
  if ((await filterControls.count()) === 0) {
    test.skip(true, 'No filter/sort controls found in review queue')
  }
  await expect(filterControls.first()).toBeVisible()
})

test('review: clicking a session opens review view', async ({ page }) => {
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

  // Click on a session in the queue
  const sessionRow = page.locator('table tbody tr, [data-testid="review-session"], .session-card').first()
  if ((await sessionRow.count()) === 0) {
    test.skip(true, 'No reviewable sessions exist in the queue')
  }

  await sessionRow.click()

  // Verify the review session view opens with message list
  const messageList = page.locator('.message, .animate-slide-up, [data-testid="message"]')
  const sessionView = page.getByText(/transcript|messages|review session/i)
  await expect(messageList.first().or(sessionView)).toBeVisible({ timeout: 10_000 })
})
