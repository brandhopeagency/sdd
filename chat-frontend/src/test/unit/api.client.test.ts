/// <reference types="vitest/globals" />

type FetchMock = ReturnType<typeof vi.fn>

function mockFetchJson(json: unknown): FetchMock {
  return vi.fn(async () => {
    const payload = {
      ok: true,
      status: 200,
      json: async () => json,
    }
    return { ...payload, clone: () => payload }
  }) as unknown as FetchMock
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

    it('attempts refresh/retry for 403 authz responses', async () => {
      localStorage.setItem('accessToken', 'stale-token')
      const handleApiError = vi.fn(async () => {
        localStorage.setItem('accessToken', 'fresh-token')
        return true
      })
      vi.doMock('../../stores/authStore', () => ({
        useAuthStore: {
          getState: () => ({
            isAuthenticated: true,
            isGuest: false,
            refreshSession: vi.fn(async () => true),
            handleApiError,
          }),
        },
      }))

      const denied = {
        ok: false,
        status: 403,
        json: async () => ({ error: { code: 'FORBIDDEN', message: 'denied' } }),
      }
      const success = {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      }
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
        if (auth === 'Bearer stale-token') return { ...denied, clone: () => denied }
        return { ...success, clone: () => success }
      }) as unknown as FetchMock
      vi.stubGlobal('fetch', fetchMock as any)

      const api = await importApi()
      const response = await api.settingsApi.getPublic()

      expect(handleApiError).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(response.success).toBe(true)
    })
  })

})


