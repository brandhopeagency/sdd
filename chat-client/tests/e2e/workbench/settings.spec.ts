import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: settings page renders key controls', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/settings')

  if (/#\/chat(\/|$)/.test(page.url()) || /#\/login(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()

  // Presence of key sections (UX sanity)
  await expect(page.getByText(/^privacy$/i)).toBeVisible()
  await expect(page.getByText(/^notifications$/i)).toBeVisible()
  await expect(page.getByText(/^appearance$/i)).toBeVisible()
  await expect(page.getByText(/language & region/i)).toBeVisible()

  // Theme selection buttons should exist
  await expect(page.getByRole('button', { name: /^light$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^dark$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^system$/i })).toBeVisible()
})


