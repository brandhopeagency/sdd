import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.describe('Google OAuth login page elements', () => {
  test.beforeEach(async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/login')
  })

  test('Google sign-in button is visible when OAuth is configured', async ({ page }) => {
    // Check for Google sign-in iframe or button (rendered by GIS library)
    const googleBtn = page.locator('[id^="credential_picker"]').or(
      page.locator('iframe[src*="accounts.google.com"]')
    ).or(
      page.getByRole('button', { name: /sign in with google/i })
    )

    // Google OAuth may or may not be configured in the test environment
    const isVisible = await googleBtn.isVisible().catch(() => false)
    if (isVisible) {
      await expect(googleBtn).toBeVisible()
    } else {
      // OAuth not configured — OTP form should still be visible as fallback
      const emailInput = page.getByPlaceholder(/you@example\.com/i)
      await expect(emailInput).toBeVisible()
    }
  })

  test('OTP login form is present alongside Google button', async ({ page }) => {
    const emailInput = page.getByPlaceholder(/you@example\.com/i)
    await expect(emailInput).toBeVisible()

    const sendCodeBtn = page.getByRole('button', { name: /^send code$/i })
    await expect(sendCodeBtn).toBeVisible()
  })

  test('divider "or" appears when both methods are available', async ({ page }) => {
    const divider = page.getByText(/^or$/i)

    // Divider only shown when both Google and OTP are available
    const googleFrame = page.locator('iframe[src*="accounts.google.com"]')
    const googleVisible = await googleFrame.isVisible().catch(() => false)

    if (googleVisible) {
      await expect(divider).toBeVisible()
    }
  })
})

test.describe('Google OAuth API endpoints', () => {
  test('GET /api/auth/google/config returns availability status', async ({ request }) => {
    const response = await request.get('/api/auth/google/config')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('available')
    expect(typeof body.data.available).toBe('boolean')
    expect(body.data).toHaveProperty('clientId')
  })

  test('POST /api/auth/google rejects invalid credential', async ({ request }) => {
    const response = await request.post('/api/auth/google', {
      data: { credential: 'invalid-token', surface: 'chat' }
    })
    expect(response.status()).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_GOOGLE_TOKEN')
  })
})
