import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'owner' })

test('workbench: erasure section shows coming soon', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Navigate to privacy controls
  const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
  if ((await privacyNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:privacy; run with an Owner account')
  }
  await privacyNav.click()

  // Navigate to GDPR/erasure section if separate, or check within privacy dashboard
  const erasureHeading = page.getByRole('heading', { name: /erasure|data deletion|gdpr/i })
  const erasureSection = page.getByText(/erasure/i).first()

  // The erasure feature shows "Coming soon" placeholder
  await expect(page.getByText(/coming soon/i).first()).toBeVisible()

  // Ensure no actual erasure form or table is rendered
  await expect(page.locator('form[data-testid="erasure-form"]')).toHaveCount(0)
})

test('workbench: audit log section shows coming soon', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access')
  }

  const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
  if ((await privacyNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:privacy; run with an Owner account')
  }
  await privacyNav.click()

  // Verify audit log section
  await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible()

  // The audit log shows "Coming soon" placeholder
  await expect(page.getByText(/coming soon/i).first()).toBeVisible()

  // Ensure no actual audit log table is rendered
  await expect(page.getByRole('table')).toHaveCount(0)
})
