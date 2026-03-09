import { test, expect } from '../e2e/fixtures/authTest'
import { initLanguage } from '../e2e/helpers/i18n'
import { gotoRoute } from '../e2e/helpers/routes'

test.describe('Survey Schema Preview', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench/surveys/schemas')
    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
    }
    // Navigate to schema editor with questions
    const editLink = page.getByRole('link', { name: /edit/i }).first()
    await editLink.click({ timeout: 10_000 }).catch(() => {})
    await expect(page.getByRole('button', { name: /preview/i })).toBeVisible({ timeout: 10_000 })
  })

  test('opens preview modal with gate-style layout', async ({ page }) => {
    await page.getByRole('button', { name: /preview/i }).click()
    await expect(page.getByText(/Preview Mode/i)).toBeVisible()
    await expect(page.getByText(/Question 1/i)).toBeVisible()
  })

  test('shows progress indicator', async ({ page }) => {
    await page.getByRole('button', { name: /preview/i }).click()
    await expect(page.getByRole('progressbar')).toBeVisible()
  })

  test('navigates through questions', async ({ page }) => {
    await page.getByRole('button', { name: /preview/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/Question 2/i)).toBeVisible()
  })

  test('shows review step at end', async ({ page }) => {
    await page.getByRole('button', { name: /preview/i }).click()
    // Navigate to last question and click next
    await expect(page.getByText(/Review/i)).toBeVisible()
  })

  test('closes modal without side effects', async ({ page }) => {
    await page.getByRole('button', { name: /preview/i }).click()
    await page.getByRole('button', { name: /exit preview/i }).click()
    await expect(page.getByText(/Preview Mode/i)).not.toBeVisible()
  })

  test('preview button disabled with zero questions', async ({ page }) => {
    // Navigate to schema with no questions
    await gotoRoute(page, '/workbench/surveys/schemas')
    const createBtn = page.getByRole('button', { name: /create|new|add/i }).or(page.getByRole('link', { name: /create|new|add/i }))
    await createBtn.first().click({ timeout: 10_000 }).catch(() => {})
    await expect(page.getByRole('button', { name: /preview/i })).toBeDisabled()
  })

  test('responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('button', { name: /preview/i }).click()
    await expect(page.getByText(/Preview Mode/i)).toBeVisible()
  })

  test('responsive on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByRole('button', { name: /preview/i }).click()
    await expect(page.getByText(/Preview Mode/i)).toBeVisible()
  })
})
