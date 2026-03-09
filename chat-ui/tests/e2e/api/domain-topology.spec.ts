import { test, expect } from '../routing/fixtures/experience-split.fixtures'

test.describe('Domain Topology', () => {
  test('chat API health endpoint responds', async ({ request, chatApiUrl }) => {
    const response = await request.get(`${chatApiUrl}/api/health`)
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBeDefined()
  })

  test('workbench API health endpoint responds', async ({ request, workbenchApiUrl }) => {
    const response = await request.get(`${workbenchApiUrl}/api/health`)
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBeDefined()
  })

  test('chat API returns chat surface header', async ({ request, chatApiUrl }) => {
    const response = await request.get(`${chatApiUrl}/api/health`)
    expect(response.headers()['x-service-surface']).toBe('chat')
  })

  test('workbench API returns workbench surface header', async ({ request, workbenchApiUrl }) => {
    const response = await request.get(`${workbenchApiUrl}/api/health`)
    expect(response.headers()['x-service-surface']).toBe('workbench')
  })
})
