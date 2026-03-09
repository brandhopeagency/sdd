import { test, expect } from '../e2e/fixtures/authTest'
import { initLanguage } from '../e2e/helpers/i18n'
import { gotoRoute } from '../e2e/helpers/routes'
import path from 'path'
import fs from 'fs'

test.describe('Survey Schema Export/Import', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench/surveys/schemas')
    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
    }
    // Navigate to schema editor for export tests
    const editLink = page.getByRole('link', { name: /edit/i }).first()
    await editLink.click({ timeout: 10_000 }).catch(() => {})
  })

  test('exports schema as JSON file', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^survey-schema-.*\.json$/)

    const filePath = await download.path()
    if (filePath) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(content.schemaVersion).toBe(1)
      expect(content.title).toBeTruthy()
      expect(Array.isArray(content.questions)).toBe(true)
      expect(content.id).toBeUndefined()
      expect(content.createdBy).toBeUndefined()
    }
  })

  test('imports valid JSON and creates draft', async ({ page }) => {
    await gotoRoute(page, '/workbench/surveys/schemas')
    await page.getByRole('button', { name: /import/i }).click()
    await expect(page.getByText(/Import Survey Schema/i)).toBeVisible()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'valid-schema.json'))
    await expect(page).toHaveURL(/\/edit$/)
  })

  test('shows validation errors for invalid JSON', async ({ page }) => {
    await gotoRoute(page, '/workbench/surveys/schemas')
    await page.getByRole('button', { name: /import/i }).click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'invalid-schema.json'))
    await expect(page.getByText(/Validation failed/i)).toBeVisible()
  })

  test('round-trip export then import preserves schema', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export/i }).click()
    const download = await downloadPromise
    const filePath = await download.path()

    if (filePath) {
      await gotoRoute(page, '/workbench/surveys/schemas')
      await page.getByRole('button', { name: /import/i }).click()
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(filePath)
      await expect(page).toHaveURL(/\/edit$/)
    }
  })
})
