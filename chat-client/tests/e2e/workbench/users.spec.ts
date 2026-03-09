import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: users list renders and create-user modal can open (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const usersNav = page.getByRole('button', { name: /^user management$/i })
  if ((await usersNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:user_management; run with a Moderator/Owner account')
  }

  await usersNav.click()
  await expect(page.getByRole('heading', { name: /^user management$/i })).toBeVisible()

  // UX: filters/search section should exist
  await expect(page.getByRole('table')).toBeVisible()

  // UX: truncated names should show full (or masked) value via native tooltip (title attr)
  const firstRow = page.locator('tbody tr').first()
  if ((await firstRow.count()) === 0) {
    test.skip(true, 'No users available to validate tooltip behavior')
  }
  const firstNameCell = firstRow.locator('td').first().locator('[title]').first()
  if ((await firstNameCell.count()) > 0) {
    const title = await firstNameCell.getAttribute('title')
    expect(title && title.trim().length).toBeTruthy()
  }

  // Create user is permission-gated; if present, ensure modal opens and can close without side effects.
  const addUser = page.getByRole('button', { name: /^add user$/i })
  if ((await addUser.count()) > 0) {
    await addUser.click()
    const modalHeading = page.getByRole('heading', { name: /^create user$/i })
    await expect(modalHeading).toBeVisible()

    // Close via Cancel (accessible + stable)
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modalHeading).toHaveCount(0)
  }
})


