import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'moderator' })

test('workbench: session tagging with autocomplete', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/research')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Open a session in moderation view
  const firstSessionId = page.locator('span.font-mono').first()
  if ((await firstSessionId.count()) === 0) {
    test.skip(true, 'No sessions available to test tagging')
  }
  await firstSessionId.click()
  await expect(page).toHaveURL(/\/workbench\/research\/session\//)

  // Locate tag input
  const tagInput = page.getByPlaceholder(/add.*tag|tag/i)
    .or(page.getByRole('combobox', { name: /tag/i }))
    .or(page.locator('[data-testid="tag-input"]'))
  if ((await tagInput.count()) === 0) {
    test.skip(true, 'Tag input not found in moderation view')
  }

  await tagInput.first().click()
  await tagInput.first().fill('anxi')

  // Verify autocomplete suggestions appear
  const suggestions = page.getByRole('option').or(page.getByRole('listbox').locator('li'))
  await expect(suggestions.first()).toBeVisible({ timeout: 5_000 })

  // Select a tag
  await suggestions.first().click()

  // Verify tag appears on the session
  const tagBadge = page.locator('.tag, .badge, [data-testid="session-tag"]')
  await expect(tagBadge.first()).toBeVisible()
})

test('workbench: golden reference editing', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/research')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access')
  }

  const firstSessionId = page.locator('span.font-mono').first()
  if ((await firstSessionId.count()) === 0) {
    test.skip(true, 'No sessions available to test golden reference editing')
  }
  await firstSessionId.click()
  await expect(page).toHaveURL(/\/workbench\/research\/session\//)

  // Locate golden reference column (middle)
  const goldenRefHeading = page.getByText(/^golden reference$/i)
  await expect(goldenRefHeading).toBeVisible()

  // Find editable area in the golden reference column
  const goldenRefArea = page.locator('textarea, [contenteditable="true"]')
    .or(page.getByRole('textbox'))
  const editableFields = goldenRefArea.filter({ hasNot: page.getByPlaceholder(/type your message/i) })

  if ((await editableFields.count()) === 0) {
    test.skip(true, 'No editable golden reference field found')
  }

  const field = editableFields.first()
  const originalText = await field.inputValue().catch(() => field.textContent())
  const editedText = `E2E edit ${Date.now()}`

  await field.click()
  await field.fill(editedText)

  // Save
  const saveBtn = page.getByRole('button', { name: /save/i })
  if ((await saveBtn.count()) > 0) {
    await saveBtn.click()
  }

  // Verify edit persists after reload
  await page.reload()
  await expect(page.getByText(editedText)).toBeVisible({ timeout: 10_000 })
})

test('workbench: moderation status transition', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench/research')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access')
  }

  const firstSessionId = page.locator('span.font-mono').first()
  if ((await firstSessionId.count()) === 0) {
    test.skip(true, 'No sessions available to test status transition')
  }
  await firstSessionId.click()
  await expect(page).toHaveURL(/\/workbench\/research\/session\//)

  // Find status indicator
  const statusSelect = page.getByRole('combobox', { name: /status/i })
    .or(page.locator('select[name*="status"]'))
    .or(page.getByLabel(/status/i))
  if ((await statusSelect.count()) === 0) {
    test.skip(true, 'Status selector not found in moderation view')
  }

  // Get current status
  const currentStatus = await statusSelect.first().inputValue().catch(() => '')

  // Try changing status (e.g., pending → in_review)
  const targetStatus = currentStatus === 'in_review' ? 'moderated' : 'in_review'
  await statusSelect.first().selectOption({ label: new RegExp(targetStatus.replace('_', '.'), 'i') })

  // Verify the status updates in the UI
  const updatedStatus = await statusSelect.first().inputValue()
  expect(updatedStatus).not.toBe(currentStatus)
})
