/// <reference types="vitest/globals" />

import type { User } from '@/types'

type FetchMock = ReturnType<typeof vi.fn>

function mockFetchJson(json: unknown): FetchMock {
  return vi.fn(async () => ({ json: async () => json })) as unknown as FetchMock
}

describe('api client (src/services/api.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  async function importApi() {
    vi.resetModules()
    return await import('../../services/api')
  }

  describe('buildUrl', () => {
    it('avoids duplicated /api when base ends with /api and endpoint starts with /api', async () => {
      const api = await importApi()
      expect(api.buildUrl('/api/auth/me', 'https://example.com/api')).toBe('https://example.com/api/auth/me')
    })

    it('keeps /api when base does not end with /api', async () => {
      const api = await importApi()
      expect(api.buildUrl('/api/auth/me', 'https://example.com')).toBe('https://example.com/api/auth/me')
    })

    it('supports endpoints without /api prefix', async () => {
      const api = await importApi()
      expect(api.buildUrl('/health', 'https://example.com/api')).toBe('https://example.com/api/health')
    })
  })

  describe('token storage helpers', () => {
    it('setAccessToken/getAccessToken/clearTokens sync with localStorage', async () => {
      const api = await importApi()

      api.clearTokens()
      expect(api.getAccessToken()).toBe(null)
      expect(localStorage.getItem('accessToken')).toBe(null)

      api.setAccessToken('t-1')
      expect(localStorage.getItem('accessToken')).toBe('t-1')
      expect(api.getAccessToken()).toBe('t-1')

      api.clearTokens()
      expect(api.getAccessToken()).toBe(null)
      expect(localStorage.getItem('accessToken')).toBe(null)
    })

    it('getAccessToken reads from localStorage when in-memory cache is empty', async () => {
      const api = await importApi()
      api.clearTokens()
      localStorage.setItem('accessToken', 't-2')
      expect(api.getAccessToken()).toBe('t-2')
    })
  })

  describe('apiRequest (indirect via exported APIs)', () => {
    it('adds Authorization header when token is set and uses credentials: include', async () => {
      const api = await importApi()
      api.setAccessToken('token-123')

      const fetchMock = mockFetchJson({ success: true, data: { message: 'ok' } })
      vi.stubGlobal('fetch', fetchMock)

      await api.authApi.logout()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as any
      expect(new URL(url).pathname).toBe('/api/auth/logout')
      expect(init.credentials).toBe('include')
      expect(init.headers.Authorization).toBe('Bearer token-123')
    })

    it('returns NETWORK_ERROR payload when fetch throws', async () => {
      const api = await importApi()
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom') }) as any)

      const resp = await api.authApi.getMe()
      expect(resp).toEqual({
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      })
    })
  })

  describe('query-string building', () => {
    it('usersApi.list builds query correctly (skips role/status when \"all\")', async () => {
      const api = await importApi()
      const fetchMock = mockFetchJson({ success: true, data: [] as User[] })
      vi.stubGlobal('fetch', fetchMock as any)

      await api.usersApi.list({
        page: 2,
        limit: 50,
        search: 'alice@example.com',
        role: 'all',
        status: 'all',
        sortBy: 'email',
        sortOrder: 'asc',
      })

      const [url] = fetchMock.mock.calls[0] as any
      const u = new URL(url)
      expect(u.pathname).toBe('/api/admin/users')
      expect(u.searchParams.get('page')).toBe('2')
      expect(u.searchParams.get('limit')).toBe('50')
      expect(u.searchParams.get('search')).toBe('alice@example.com')
      expect(u.searchParams.get('sortBy')).toBe('email')
      expect(u.searchParams.get('sortOrder')).toBe('asc')
      expect(u.searchParams.get('role')).toBe(null)
      expect(u.searchParams.get('status')).toBe(null)
    })

    it('sessionsAdminApi.list includes filters only when not \"all\"', async () => {
      const api = await importApi()
      const fetchMock = mockFetchJson({ success: true, data: [] })
      vi.stubGlobal('fetch', fetchMock as any)

      await api.sessionsAdminApi.list({
        page: 1,
        search: 'xyz',
        status: 'all',
        moderationStatus: 'pending',
      })

      const [url] = fetchMock.mock.calls[0] as any
      const u = new URL(url)
      expect(u.pathname).toBe('/api/admin/sessions')
      expect(u.searchParams.get('page')).toBe('1')
      expect(u.searchParams.get('search')).toBe('xyz')
      expect(u.searchParams.get('moderationStatus')).toBe('pending')
      expect(u.searchParams.get('status')).toBe(null)
    })

    it('tagsAdminApi.list encodes category', async () => {
      const api = await importApi()
      const fetchMock = mockFetchJson({ success: true, data: [] })
      vi.stubGlobal('fetch', fetchMock as any)

      await api.tagsAdminApi.list('session')
      const [url] = fetchMock.mock.calls[0] as any
      const u = new URL(url)
      expect(u.pathname).toBe('/api/admin/tags')
      expect(u.searchParams.get('category')).toBe('session')
    })
  })
})


