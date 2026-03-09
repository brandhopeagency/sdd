import { test, expect } from '../fixtures/e2eTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

test.describe('Legacy Route Compatibility', () => {
  test('root redirects to welcome/login', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    await expect(page).toHaveURL(/\/(login)?(\/|$)/)
  })

  test('unknown routes redirect to fallback', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/nonexistent-route')
    // Should redirect to root or chat entry
    await expect(page).not.toHaveURL(/nonexistent/)
  })
})
