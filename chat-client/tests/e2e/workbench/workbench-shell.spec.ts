import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: shell renders and back-to-chat works (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  await expect(page.getByRole('heading', { name: /^workbench$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^dashboard$/i })).toBeVisible()

  await page.getByRole('button', { name: /back to chat/i }).click()
  await expect(page).toHaveURL(/#\/chat(\/|$)/)
})


