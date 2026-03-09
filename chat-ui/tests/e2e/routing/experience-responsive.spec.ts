import { test, expect } from '../fixtures/e2eTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

test.describe('responsive rendering across viewports', () => {
  test('chat surface renders with heading visible', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('no horizontal overflow at current viewport', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('buttons meet minimum touch target size', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await buttons.nth(i).boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36)
      }
    }
  })
})
