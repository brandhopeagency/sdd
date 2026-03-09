import { test, expect } from '@playwright/test'

/**
 * Legacy redirect E2E tests: cross-domain redirects for split workbench/chat.
 * Requires deployed environments (CHAT_BASE_URL, WORKBENCH_BASE_URL) to run.
 */
test.describe('Legacy redirects', () => {
  test.fixme(
    'visiting /workbench/users on chat domain redirects to workbench domain',
    async ({ page, baseURL }) => {
      const chatBase = baseURL!.replace(/\/$/, '')
      await page.goto(`${chatBase}/workbench/users`)
      // Should redirect to workbench domain
      await expect(page).toHaveURL(/workbench\.(dev\.)?mentalhelp\.chat.*\/workbench\/users/)
    }
  )

  test.fixme(
    'visiting /chat on workbench domain redirects to chat domain',
    async ({ page, baseURL }) => {
      const workbenchBase = baseURL!.replace(/\/$/, '')
      await page.goto(`${workbenchBase}/chat`)
      // Should redirect to chat domain
      await expect(page).toHaveURL(/(dev\.)?mentalhelp\.chat/)
      await expect(page).not.toHaveURL(/workbench\./)
    }
  )

  test.fixme(
    'visiting an unknown route shows the 404 recovery page',
    async ({ page, baseURL }) => {
      await page.goto(`${baseURL!.replace(/\/$/, '')}/unknown-route-xyz`)
      // Should show 404 or recovery page
      await expect(
        page.getByText(/404|not found|page not found|recovery/i)
      ).toBeVisible({ timeout: 10_000 })
    }
  )
})
