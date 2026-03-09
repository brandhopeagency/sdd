/// <reference types="vitest/globals" />

// Mock global fetch for all tagApi calls.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: unknown, ok = true) {
  const payload = {
    ok,
    status: ok ? 200 : 400,
    json: async () => (ok ? { data } : { error: { message: 'Bad request' } }),
  }
  return { ...payload, clone: () => payload }
}

describe('tagApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    localStorage.clear()
    localStorage.setItem('accessToken', 'test-token')
  })

  async function importApi() {
    vi.resetModules()
    return await import('../../services/tagApi')
  }

  function expectApiPath(actualUrl: unknown, path: string) {
    const url = String(actualUrl)
    expect(url).toContain(path)
  }

  // ── Tag Definitions ──

  describe('listTagDefinitions', () => {
    it('sends GET to /api/admin/tags', async () => {
      const tags = [{ id: '1', name: 'QA', category: 'user' }]
      mockFetch.mockResolvedValueOnce(jsonResponse(tags))
      const api = await importApi()
      const result = await api.listTagDefinitions()
      expect(result).toEqual(tags)
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/tags')
      expect(opts).toEqual(expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }))
    })

    it('appends query parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]))
      const api = await importApi()
      await api.listTagDefinitions({ category: 'user', active: true })
      const url: string = mockFetch.mock.calls[0][0]
      expect(url).toContain('category=user')
      expect(url).toContain('active=true')
    })
  })

  describe('createTagDefinition', () => {
    it('sends POST with body', async () => {
      const tag = { id: '1', name: 'new-tag', category: 'chat' }
      mockFetch.mockResolvedValueOnce(jsonResponse(tag))
      const api = await importApi()
      const result = await api.createTagDefinition({ name: 'new-tag', category: 'chat' })
      expect(result).toEqual(tag)
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/tags')
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ name: 'new-tag', category: 'chat' })
    })
  })

  describe('updateTagDefinition', () => {
    it('sends PUT with id and body', async () => {
      const tag = { id: '1', name: 'updated', category: 'chat' }
      mockFetch.mockResolvedValueOnce(jsonResponse(tag))
      const api = await importApi()
      const result = await api.updateTagDefinition('1', { name: 'updated' })
      expect(result).toEqual(tag)
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/tags/1')
      expect(opts.method).toBe('PUT')
    })
  })

  describe('deleteTagDefinition', () => {
    it('sends DELETE and returns affected counts', async () => {
      const counts = { affectedUsers: 2, affectedSessions: 5 }
      mockFetch.mockResolvedValueOnce(jsonResponse(counts))
      const api = await importApi()
      const result = await api.deleteTagDefinition('1')
      expect(result).toEqual(counts)
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/tags/1')
      expect(opts.method).toBe('DELETE')
    })
  })

  // ── User Tags ──

  describe('listUserTags', () => {
    it('sends GET to /api/admin/users/:id/tags', async () => {
      const tags = [{ id: 'ut1', userId: 'u1', tagDefinitionId: 't1' }]
      mockFetch.mockResolvedValueOnce(jsonResponse(tags))
      const api = await importApi()
      const result = await api.listUserTags('u1')
      expect(result).toEqual(tags)
      expectApiPath(mockFetch.mock.calls[0][0], '/api/admin/users/u1/tags')
    })
  })

  describe('assignUserTag', () => {
    it('sends POST with tagDefinitionId', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'ut1' }))
      const api = await importApi()
      await api.assignUserTag('u1', 'td1')
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/users/u1/tags')
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ tagDefinitionId: 'td1' })
    })
  })

  describe('removeUserTag', () => {
    it('sends DELETE to /api/admin/users/:id/tags/:tagId', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}))
      const api = await importApi()
      await api.removeUserTag('u1', 'ut1')
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/admin/users/u1/tags/ut1')
      expect(opts.method).toBe('DELETE')
    })
  })

  // ── Session Tags ──

  describe('listSessionTags', () => {
    it('sends GET to /api/review/sessions/:id/tags', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]))
      const api = await importApi()
      await api.listSessionTags('s1')
      expectApiPath(mockFetch.mock.calls[0][0], '/api/review/sessions/s1/tags')
    })
  })

  describe('addSessionTag', () => {
    it('sends POST with tagDefinitionId payload', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionTag: {}, tagDefinitionCreated: false }))
      const api = await importApi()
      await api.addSessionTag('s1', { tagDefinitionId: 'td1' })
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/review/sessions/s1/tags')
      expect(opts.method).toBe('POST')
    })

    it('sends POST with tagName payload for ad-hoc tags', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionTag: {}, tagDefinitionCreated: true }))
      const api = await importApi()
      await api.addSessionTag('s1', { tagName: 'custom-tag' })
      const [, opts] = mockFetch.mock.calls[0]
      expect(JSON.parse(opts.body)).toEqual({ tagName: 'custom-tag' })
    })
  })

  describe('removeSessionTag', () => {
    it('sends DELETE to /api/review/sessions/:id/tags/:tagId', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}))
      const api = await importApi()
      await api.removeSessionTag('s1', 'st1')
      const [url, opts] = mockFetch.mock.calls[0]
      expectApiPath(url, '/api/review/sessions/s1/tags/st1')
      expect(opts.method).toBe('DELETE')
    })
  })

  // ── Filter Tags ──

  describe('listFilterTags', () => {
    it('sends GET to /api/review/tags', async () => {
      const filterTags = [{ id: '1', name: 'QA', category: 'user', sessionCount: 10 }]
      mockFetch.mockResolvedValueOnce(jsonResponse(filterTags))
      const api = await importApi()
      const result = await api.listFilterTags()
      expect(result).toEqual(filterTags)
      expectApiPath(mockFetch.mock.calls[0][0], '/api/review/tags')
    })
  })

  // ── Error handling ──

  describe('error handling', () => {
    it('throws with error message from response', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(null, false))
      const api = await importApi()
      await expect(api.listTagDefinitions()).rejects.toThrow('Bad request')
    })

    it('throws generic message when JSON parse fails', async () => {
      const payload = {
        ok: false,
        status: 500,
        json: async () => { throw new Error('parse error') },
      }
      mockFetch.mockResolvedValueOnce({ ...payload, clone: () => payload })
      const api = await importApi()
      await expect(api.listTagDefinitions()).rejects.toThrow('Request failed')
    })

    it('works without auth token', async () => {
      localStorage.clear()
      mockFetch.mockResolvedValueOnce(jsonResponse([]))
      const api = await importApi()
      await api.listFilterTags()
      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers.Authorization).toBeUndefined()
    })
  })
})
