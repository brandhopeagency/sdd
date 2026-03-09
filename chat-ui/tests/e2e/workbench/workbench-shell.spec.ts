import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: shell renders and back-to-chat works (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('workbench.dev.mentalhelp.chat/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  await expect(page.getByRole('heading', { name: /^workbench$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^dashboard$/i })).toBeVisible()

  await page.getByRole('button', { name: /back to chat/i }).click()
  await expect(page).toHaveURL(/dev\.mentalhelp\.chat/)
})

test.describe('workbench: moderator role visibility', () => {
  test.use({ role: 'moderator' })

  test('workbench: moderator sees Dashboard, Users, Research, Approvals sections', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('workbench.dev.mentalhelp.chat/workbench')) {
      test.skip(true, 'Moderator account lacks workbench:access')
    }

    // Moderator has workbench_access + workbench_user_management + workbench_research + workbench_moderation
    await expect(page.getByRole('button', { name: /^dashboard$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /user management/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /research/i })).toBeVisible()
    // Moderator has workbench_user_management which gates Approvals
    await expect(page.getByRole('button', { name: 'Approvals', exact: true })).toBeVisible()
  })
})

test.describe('workbench: researcher role visibility', () => {
  test.use({ role: 'researcher' })

  test('workbench: researcher sees only Research section', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('workbench.dev.mentalhelp.chat/workbench')) {
      test.skip(true, 'Researcher account lacks workbench:access')
    }

    // Researcher has workbench_access + workbench_research — NOT user_management or approvals
    await expect(page.getByRole('button', { name: /research/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /user management/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /approvals/i })).toHaveCount(0)
  })
})

test.describe('workbench: user role redirect', () => {
  test.use({ role: 'user' })

  test('workbench: user without workbench permission is redirected', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    // User role lacks workbench_access — should see access denied page
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible()
  })
})


