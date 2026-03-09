import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: research list renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const researchNav = page.getByRole('button', { name: /^research & moderation$/i })
  if ((await researchNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:research; run with a Researcher/Moderator/Owner account')
  }

  await researchNav.click()
  await expect(page.getByRole('heading', { name: /^research & moderation$/i })).toBeVisible()

  // UX: filter/search controls should exist and be interactable.
  await expect(page.getByPlaceholder(/search/i)).toBeVisible()

  // Pagination controls should exist (server-side pagination).
  await expect(page.getByRole('button', { name: /previous page/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /next page/i })).toBeVisible()
})

test('workbench: moderation view opens for a session (if data exists)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/research')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  // Click the first session in the list, if any.
  const firstSessionId = page.locator('span.font-mono').first()
  if ((await firstSessionId.count()) === 0) {
    test.skip(true, 'No sessions available in this environment to open moderation view')
  }

  await firstSessionId.click()
  await expect(page).toHaveURL(/#\/workbench\/research\/session\//)

  // 3-column moderation layout (UX)
  await expect(page.getByText(/^transcript$/i)).toBeVisible()
  await expect(page.getByText(/^golden reference$/i)).toBeVisible()
  await expect(page.getByText(/^annotation$/i)).toBeVisible()
})


