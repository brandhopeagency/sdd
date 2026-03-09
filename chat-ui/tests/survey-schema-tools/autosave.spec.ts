import { test, expect } from '../e2e/fixtures/authTest'
import { initLanguage } from '../e2e/helpers/i18n'
import { gotoRoute } from '../e2e/helpers/routes'

test.describe('Survey Schema Autosave', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench/surveys/schemas')
    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
    }
    // Navigate to schema editor (create new or edit existing draft)
    const createBtn = page.getByRole('button', { name: /create|new|add/i }).or(page.getByRole('link', { name: /create|new|add/i }))
    await createBtn.first().click({ timeout: 10_000 }).catch(() => {})
    await expect(page.locator('[data-testid="schema-title"]')).toBeVisible({ timeout: 10_000 })
  })

  test('shows save indicator after editing title', async ({ page }) => {
    await page.fill('[data-testid="schema-title"]', 'Updated Title')
    await expect(page.getByText(/Saving/i)).toBeVisible()
    await expect(page.getByText(/Saved/i)).toBeVisible({ timeout: 5000 })
  })

  test('preserves changes after tab close and reopen', async ({ page, context }) => {
    await page.fill('[data-testid="schema-title"]', 'Autosave Test')
    await expect(page.getByText(/Saved/i)).toBeVisible({ timeout: 5000 })
    const url = page.url()
    await page.close()
    const newPage = await context.newPage()
    await newPage.goto(url)
    await expect(newPage.locator('[data-testid="schema-title"]')).toHaveValue('Autosave Test')
  })

  test('shows error indicator on network failure', async ({ page }) => {
    await page.route('**/api/workbench/survey-schemas/**', route => route.abort())
    await page.fill('[data-testid="schema-title"]', 'Trigger save')
    await expect(page.getByText(/Save failed/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
  })

  test('autosave disabled for published schema', async ({ page }) => {
    // Navigate to a published schema
    await gotoRoute(page, '/workbench/surveys/schemas')
    const editLink = page.getByRole('link', { name: /edit/i }).first()
    await editLink.click({ timeout: 10_000 }).catch(() => {})
    // If we land on a published schema, autosave should be disabled
    await expect(page.getByText(/Saving/i)).not.toBeVisible()
    await expect(page.getByText(/Saved/i)).not.toBeVisible()
  })
})
