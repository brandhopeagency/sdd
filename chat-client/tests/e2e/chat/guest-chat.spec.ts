import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('welcome → start conversation enters guest chat', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/mental health support/i)
  const startButton = page.getByRole('button', { name: /start a conversation/i })
  if ((await startButton.count()) === 0) {
    test.skip(true, 'Guest mode is disabled in this environment')
  }
  await startButton.click()

  await expect(page).toHaveURL(/#\/chat(\/|$)/)

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
  await expect(page).toHaveURL(/#\/chat(\/|$)/)

  // Open popup
  await page.getByText(/^guest$/i).click()
  await expect(page.getByRole('heading', { name: /^register$/i })).toBeVisible()

  // Dismiss via backdrop click and ensure popup disappears.
  await page.locator('div.backdrop-blur-sm').first().click({ position: { x: 10, y: 10 } })
  await expect(page.getByRole('heading', { name: /^register$/i })).toHaveCount(0)
})


