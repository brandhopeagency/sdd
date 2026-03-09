import { test, expect } from '@playwright/test'

/**
 * Cross-surface E2E tests: navigation between chat and workbench domains.
 * Requires deployed environments (CHAT_BASE_URL, WORKBENCH_BASE_URL) to run.
 */
test.describe('Cross-surface navigation', () => {
  test.fixme(
    'navigate from chat to workbench (click workbench link, verify workbench loads)',
    async ({ page, baseURL }) => {
      // Start on chat surface
      await page.goto(baseURL!)
      // Click workbench link (e.g. in nav or footer)
      await page.getByRole('link', { name: /workbench/i }).click()
      // Verify workbench domain loads
      await expect(page).toHaveURL(/workbench\.dev\.mentalhelp\.chat|workbench\.mentalhelp\.chat/)
    }
  )

  test.fixme(
    'navigate from workbench to chat (click "Back to Chat", verify chat loads)',
    async ({ page, baseURL }) => {
      // Start on workbench surface
      await page.goto(baseURL!)
      // Click "Back to Chat" link
      await page.getByRole('link', { name: /back to chat/i }).click()
      // Verify chat domain loads
      await expect(page).toHaveURL(/dev\.mentalhelp\.chat|mentalhelp\.chat/)
      await expect(page).not.toHaveURL(/workbench\./)
    }
  )

  test.fixme(
    'unauthorized user accessing workbench sees access denied page',
    async ({ page, baseURL }) => {
      // Visit workbench without auth
      await page.goto(baseURL!)
      // Should see access denied or redirect to login
      await expect(
        page.getByText(/access denied|unauthorized|sign in|log in/i)
      ).toBeVisible({ timeout: 10_000 })
    }
  )
})
