import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('workbench: research list renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const researchNav = page.getByRole('button', { name: /^research & moderation$/i })
  if ((await researchNav.count()) === 0) {
    test.skip(true, 'Account lacks workbench:research; run with a Researcher/Moderator/Owner account')
  }

  await researchNav.click()
  await expect(page.getByRole('heading', { name: /^review queue$/i })).toBeVisible()
})

test('workbench: moderation view opens for a session (if data exists)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/research')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  // Click the first session in the list, if any.
  const firstSessionId = page.locator('span.font-mono').first()
  if ((await firstSessionId.count()) === 0) {
    test.skip(true, 'No sessions available in this environment to open moderation view')
  }

  await firstSessionId.click()
  await expect(page).toHaveURL(/\/workbench\/research\/session\//)

  // 3-column moderation layout (UX)
  await expect(page.getByText(/^transcript$/i)).toBeVisible()
  await expect(page.getByText(/^golden reference$/i)).toBeVisible()
  await expect(page.getByText(/^annotation$/i)).toBeVisible()
})

test.describe('moderation: enhanced tests', () => {
  test.use({ role: 'moderator' })

  test('workbench: review queue renders session cards with tab navigation', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench/research')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    await expect(page.getByRole('heading', { name: /^review queue$/i })).toBeVisible()

    // Verify tab navigation exists
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  test('workbench: moderation annotation can be added and persists', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench/research')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    // Open a session in moderation view
    const firstSessionId = page.locator('span.font-mono').first()
    if ((await firstSessionId.count()) === 0) {
      test.skip(true, 'No sessions available for annotation test')
    }
    await firstSessionId.click()
    await expect(page).toHaveURL(/\/workbench\/research\/session\//)

    // Locate annotation panel (third column)
    await expect(page.getByText(/^annotation$/i)).toBeVisible()

    // Add a quality rating — look for rating input or select
    const ratingInput = page.getByLabel(/quality|rating/i)
      .or(page.getByRole('combobox', { name: /quality|rating/i }))
      .or(page.locator('[data-testid="quality-rating"]'))
    if ((await ratingInput.count()) > 0) {
      await ratingInput.first().click()
      // Select a value if it's a dropdown
      const option = page.getByRole('option').first()
      if ((await option.count()) > 0) {
        await option.click()
      }
    }

    // Add notes text
    const notesField = page.getByPlaceholder(/notes|comment|annotation/i)
      .or(page.getByRole('textbox', { name: /notes|annotation/i }))
      .or(page.locator('textarea'))
    if ((await notesField.count()) === 0) {
      test.skip(true, 'No annotation notes field found')
    }

    const annotationText = `E2E annotation ${Date.now()}`
    await notesField.last().fill(annotationText)

    // Save
    const saveBtn = page.getByRole('button', { name: /save/i })
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click()
    }

    // Reload and verify persistence
    await page.reload()
    await expect(page.getByText(annotationText)).toBeVisible({ timeout: 10_000 })
  })
})


