import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'

test.describe('chat responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
  })

  test('welcome screen renders without horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('welcome screen CTA is accessible', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('button').filter({ hasText: /start|sign/i })
    await expect(cta).toBeVisible()
    const box = await cta.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('login page form fields are touch-friendly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    const box = await emailInput.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('language selector buttons are visible', async ({ page }) => {
    await page.goto('/')
    const langButtons = page.locator('button').filter({ hasText: /🇬🇧|🇺🇦|🇷🇺/ })
    const count = await langButtons.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
