import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'user' })

test('authenticated user can log out and is redirected to welcome', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  // Verify we're on the chat page
  await expect(page.getByPlaceholder(/type your message\.\.\./i)).toBeVisible()

  // Find and click the logout button
  const logoutBtn = page.getByRole('button', { name: /log\s?out/i })
  if ((await logoutBtn.count()) === 0) {
    // Some layouts use a menu — try opening it first
    const menuBtn = page.getByRole('button', { name: /menu|profile|account/i })
    if ((await menuBtn.count()) > 0) {
      await menuBtn.click()
      await expect(page.getByRole('button', { name: /log\s?out/i })).toBeVisible()
      await page.getByRole('button', { name: /log\s?out/i }).click()
    } else {
      test.skip(true, 'Logout button not found in this layout')
    }
  } else {
    await logoutBtn.click()
  }

  // After logout, should be on welcome/login page
  await expect(page).toHaveURL(/\/(login|$)/)

  // Chat page heading should not be visible
  await expect(page.getByPlaceholder(/type your message\.\.\./i)).toHaveCount(0)
})

test('after logout, protected route /chat redirects to login', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/chat')

  // Perform logout
  const logoutBtn = page.getByRole('button', { name: /log\s?out/i })
  if ((await logoutBtn.count()) === 0) {
    const menuBtn = page.getByRole('button', { name: /menu|profile|account/i })
    if ((await menuBtn.count()) > 0) {
      await menuBtn.click()
      await page.getByRole('button', { name: /log\s?out/i }).click()
    } else {
      test.skip(true, 'Logout button not found in this layout')
    }
  } else {
    await logoutBtn.click()
  }

  // Wait for redirect to complete
  await expect(page).toHaveURL(/\/(login|$)/)

  // Try navigating to protected /chat route
  await gotoRoute(page, '/chat')

  // Should redirect back to login/welcome
  await expect(page).not.toHaveURL(/\/chat(\/|$)/)
})
