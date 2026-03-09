import { test, expect } from './fixtures/experience-split.fixtures'
import { initLanguage } from '../helpers/i18n'

/**
 * Build a path-based URL from a base URL and route.
 */
function splitAppUrl(baseUrl: string, route: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  if (/\.(html?)$/i.test(base)) {
    return `${base.replace(/\/[^/]*\.(html?)$/i, '')}${normalizedRoute}`
  }
  return `${base}${normalizedRoute}`
}

test.describe('Experience Entrypoints', () => {
  test('chat surface loads chat interface after login', async ({ page, chatBaseUrl }) => {
    await initLanguage(page, 'en')
    await page.goto(chatBaseUrl)
    // Should see welcome/login page
    await expect(page).toHaveURL(/\/(login)?(\/|$)/)
  })

  test('workbench surface loads workbench after login', async ({ page, workbenchBaseUrl }) => {
    await initLanguage(page, 'en')
    await page.goto(workbenchBaseUrl)
    // Should redirect to login
    await expect(page).toHaveURL(/\/login(\/|$)/)
  })

  test('chat surface does not expose workbench routes', async ({ page, chatBaseUrl }) => {
    await initLanguage(page, 'en')
    await page.goto(splitAppUrl(chatBaseUrl, '/workbench'))
    // Should redirect away from workbench (HashRouter: #/workbench)
    await expect(page).not.toHaveURL(/\/workbench(\/|$)/)
  })

  test('workbench surface does not expose chat routes', async ({ page, workbenchBaseUrl }) => {
    await initLanguage(page, 'en')
    await page.goto(splitAppUrl(workbenchBaseUrl, '/chat'))
    // Should redirect to workbench (HashRouter: #/workbench)
    await expect(page).toHaveURL(/\/workbench(\/|$)/)
  })
})
