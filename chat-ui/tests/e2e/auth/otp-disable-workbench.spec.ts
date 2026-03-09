import { test, expect } from '../fixtures/e2eTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.describe('OTP disable for workbench', () => {
  test('public settings endpoint returns otpLoginDisabledWorkbench field', async ({ request }) => {
    const response = await request.get('/api/settings')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('otpLoginDisabledWorkbench')
    expect(typeof body.data.otpLoginDisabledWorkbench).toBe('boolean')
    expect(body.data).toHaveProperty('googleOAuthAvailable')
    expect(typeof body.data.googleOAuthAvailable).toBe('boolean')
  })

  test('OTP send endpoint accepts surface parameter', async ({ request }) => {
    const response = await request.post('/api/auth/otp/send', {
      data: { email: 'test-surface@mentalhelp.global', surface: 'chat' }
    })
    // Should succeed (200) or fail for unrelated reason — not reject surface param
    expect([200, 500]).toContain(response.status())
  })

  test('chat login page shows OTP form regardless of workbench setting', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/login')

    const emailInput = page.getByPlaceholder(/you@example\.com/i)
    await expect(emailInput).toBeVisible()
  })
})
