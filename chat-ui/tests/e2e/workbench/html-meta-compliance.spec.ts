import { test, expect } from '../fixtures/e2eTest'
import { gotoRoute } from '../helpers/routes'
import { initLanguage } from '../helpers/i18n'

test.describe('HTML meta compliance', () => {
  test('page has lang attribute', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    const lang = await page.getAttribute('html', 'lang')
    expect(lang).toBeTruthy()
  })

  test('page has viewport meta tag for responsive rendering', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/')
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content')
    expect(viewport).toContain('width=device-width')
  })
})
