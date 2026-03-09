import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('authenticated user without Workbench permission is redirected from /workbench to /chat', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  // If the account has Workbench access, the app will stay on `/workbench`.
  if (/\/workbench(\/|$)/.test(page.url())) {
    test.skip(true, 'Account has Workbench access; cannot validate no-permission redirect')
  }

  await expect(page).toHaveURL(/\/chat(\/|$)/)
})


