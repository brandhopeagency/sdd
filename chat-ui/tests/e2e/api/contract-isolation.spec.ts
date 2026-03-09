import { test, expect } from '../routing/fixtures/experience-split.fixtures'

test.describe('Contract Isolation', () => {
  test('chat API does not expose admin endpoints', async ({ request, chatApiUrl }) => {
    const response = await request.get(`${chatApiUrl}/api/admin/users`)
    expect(response.status()).toBe(404)
  })

  test('chat API does not expose group endpoints', async ({ request, chatApiUrl }) => {
    const response = await request.get(`${chatApiUrl}/api/group/dashboard`)
    expect(response.status()).toBe(404)
  })

  test('workbench API does not expose chat endpoints', async ({ request, workbenchApiUrl }) => {
    const response = await request.get(`${workbenchApiUrl}/api/chat/sessions`)
    expect(response.status()).toBe(404)
  })

  test('both surfaces expose auth endpoints', async ({ request, chatApiUrl, workbenchApiUrl }) => {
    const chatAuth = await request.get(`${chatApiUrl}/api/auth/me`)
    const wbAuth = await request.get(`${workbenchApiUrl}/api/auth/me`)
    // Both should respond (401 if not authenticated, but not 404)
    expect(chatAuth.status()).not.toBe(404)
    expect(wbAuth.status()).not.toBe(404)
  })
})
