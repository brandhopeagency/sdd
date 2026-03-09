/// <reference types="vitest/globals" />

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okJson(data: unknown) {
  const payload = {
    ok: true,
    status: 200,
    json: async () => ({
      data,
      meta: { total: 0 },
      counts: { pending: 0, flagged: 0, inProgress: 0, completed: 0 },
    }),
  };
  return { ...payload, clone: () => payload };
}

function unauthorizedJson() {
  const payload = {
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' },
    }),
  };
  return { ...payload, clone: () => payload };
}

function notModified() {
  const payload = {
    ok: false,
    status: 304,
    json: async () => {
      throw new Error('304 has no body');
    },
  };
  return { ...payload, clone: () => payload };
}

describe('reviewApi auth retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    localStorage.clear();
    localStorage.setItem('accessToken', 'stale-token');
  });

  it('retries once after successful auth refresh on 401', async () => {
    vi.doMock('../../stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(async () => {
            localStorage.setItem('accessToken', 'fresh-token');
            return true;
          }),
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(unauthorizedJson());
    mockFetch.mockResolvedValueOnce(okJson([]));

    const api = await import('../../services/reviewApi');
    await api.getReviewQueue({ status: 'pending' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryOptions = mockFetch.mock.calls[1][1] as RequestInit;
    const headers = retryOptions.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fresh-token');
  });

  it('throws when 401 refresh flow does not recover session', async () => {
    vi.doMock('../../stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(async () => false),
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(unauthorizedJson());

    const api = await import('../../services/reviewApi');
    await expect(api.getReviewQueue({ status: 'pending' })).rejects.toThrow(
      'Invalid or expired authentication token',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('recovers when access token is missing but refresh succeeds', async () => {
    localStorage.removeItem('accessToken');
    vi.doMock('../../stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(async () => {
            localStorage.setItem('accessToken', 'fresh-token');
            return true;
          }),
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(unauthorizedJson());
    mockFetch.mockResolvedValueOnce(okJson([]));

    const api = await import('../../services/reviewApi');
    await api.getReviewQueue({ status: 'pending' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryOptions = mockFetch.mock.calls[1][1] as RequestInit;
    const headers = retryOptions.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fresh-token');
  });
});

describe('reviewApi cache validator handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    localStorage.clear();
    localStorage.setItem('accessToken', 'token');
  });

  it('retries with cache-busting query after 304 response', async () => {
    vi.doMock('../../stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(async () => false),
        }),
      },
    }));

    mockFetch.mockResolvedValueOnce(notModified());
    mockFetch.mockResolvedValueOnce(okJson([]));

    const api = await import('../../services/reviewApi');
    await api.getReviewQueue({ status: 'pending' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryUrl = String(mockFetch.mock.calls[1][0]);
    expect(retryUrl).toContain('/api/review/queue?');
    expect(retryUrl).toContain('_ts=');
  });
});
