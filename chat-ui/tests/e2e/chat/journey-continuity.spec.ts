import { test, expect } from '../fixtures/e2eTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

test.describe('Journey Continuity', () => {
  test('login page is accessible and shows login heading', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/login')
    // Verify the login page renders with a recognizable heading
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('welcome page is accessible and shows main heading', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    // Verify the welcome page renders with the primary heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
