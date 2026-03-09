import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'

test.describe('workbench responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
  })

  test('welcome/login page renders without horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('login page adapts to viewport', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('login form inputs meet minimum touch target size', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    const box = await emailInput.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
