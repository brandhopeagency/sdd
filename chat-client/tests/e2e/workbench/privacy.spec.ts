import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: privacy dashboard renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
  if ((await privacyNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:privacy; run with an Owner account')
  }

  await privacyNav.click()
  await expect(page.getByRole('heading', { name: /^privacy controls$/i })).toBeVisible()

  // Audit log / GDPR actions are currently not implemented; ensure UI is honest (no fake table).
  await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible()
  await expect(page.getByText(/not implemented/i).first()).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})


