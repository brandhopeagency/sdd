import { test, expect } from './fixtures/e2eTest'
import { gotoRoute } from './helpers/routes'
import { initLanguage } from './helpers/i18n'

test('home page renders welcome content', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Mental Health Support/i)
  await expect(
    page.getByRole('button', { name: /Start a Conversation|Sign in to start/i })
  ).toBeVisible()
})

