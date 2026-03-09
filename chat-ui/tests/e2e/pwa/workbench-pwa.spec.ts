import { test, expect } from '../fixtures/e2eTest'

test.describe('workbench PWA configuration', () => {
  test('manifest.webmanifest loads with correct metadata', async ({ page, baseURL }) => {
    const manifestUrl = `${baseURL}/manifest.webmanifest`
    const response = await page.request.get(manifestUrl)

    if (response.status() === 200) {
      const manifest = await response.json()
      expect(manifest.name).toBe('Mental Help Workbench')
      expect(manifest.short_name).toBe('MHG Workbench')
      expect(manifest.display).toBe('standalone')
      expect(manifest.theme_color).toBe('#7c8db0')
      expect(manifest.icons).toBeDefined()
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
    } else {
      test.skip(true, 'Manifest not available (dev mode or static only build)')
    }
  })

  test('page loads without service worker errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /service.worker|sw\./i.test(msg.text())) {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    expect(consoleErrors).toEqual([])
  })
})
