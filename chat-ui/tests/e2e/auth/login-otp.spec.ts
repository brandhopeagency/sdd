import { test, expect } from '../fixtures/e2eTest'
import { loginWithOtp } from '../helpers/auth'

test('login via OTP uses devCode from console and lands in chat', async ({ page }) => {
  await loginWithOtp(page, { email: 'playwright@mentalhelp.global' })

  // Basic chat UI sanity (smoke-level)
  await expect(page.getByRole('textbox')).toBeVisible()
})


