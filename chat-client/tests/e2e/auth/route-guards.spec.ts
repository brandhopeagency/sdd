import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('unauthenticated user is redirected from /chat to /login', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')
  await expect(page).toHaveURL(/#\/login(\/|$)/)
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
})

test('unauthenticated user is redirected from /workbench to /login', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')
  await expect(page).toHaveURL(/#\/login(\/|$)/)
})


