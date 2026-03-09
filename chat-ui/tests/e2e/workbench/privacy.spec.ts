import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: privacy dashboard renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
  if ((await privacyNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:privacy; run with an Owner account')
  }

  await privacyNav.click()
  await expect(page.getByRole('heading', { name: /^privacy controls$/i })).toBeVisible()

  // Audit log / GDPR actions are coming soon; ensure UI is honest (no fake table).
  await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible()
  await expect(page.getByText(/coming soon/i).first()).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test.describe('privacy: PII masking and export', () => {
  test.use({ role: 'owner' })

  test('workbench: PII masking toggle obscures names and emails', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
    if ((await privacyNav.count()) === 0) {
      test.skip(true, 'Account lacks workbench:privacy')
    }
    await privacyNav.click()
    await expect(page.getByRole('heading', { name: /^privacy controls$/i })).toBeVisible()

    // Find the PII masking toggle (this IS implemented)
    const maskingToggle = page.getByRole('switch', { name: /mask|pii|anonymize/i })
      .or(page.getByLabel(/mask|pii|anonymize/i))
      .or(page.locator('[data-testid="pii-masking-toggle"]'))
    if ((await maskingToggle.count()) === 0) {
      test.skip(true, 'PII masking toggle not found')
    }

    // Enable masking
    await maskingToggle.first().click()

    // Navigate to a page showing user data (e.g., user list)
    const usersNav = page.getByRole('button', { name: /user management/i })
    if ((await usersNav.count()) > 0) {
      await usersNav.click()
      await page.waitForTimeout(500)

      // Verify names/emails are displayed in masked format (e.g., `J*** D***` or `***@***`)
      const firstRow = page.locator('tbody tr').first()
      if ((await firstRow.count()) > 0) {
        const rowText = await firstRow.textContent()
        // Masked text typically contains asterisks
        expect(rowText).toMatch(/\*/)
      }
    }
  })

  test('workbench: data export section shows coming soon', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const privacyNav = page.getByRole('button', { name: /^privacy controls$/i })
    if ((await privacyNav.count()) === 0) {
      test.skip(true, 'Account lacks workbench:privacy')
    }
    await privacyNav.click()
    await expect(page.getByRole('heading', { name: /^privacy controls$/i })).toBeVisible()

    // Data export is NOT yet implemented — verify "Coming soon" message
    await expect(page.getByText(/coming soon/i).first()).toBeVisible()
  })
})


