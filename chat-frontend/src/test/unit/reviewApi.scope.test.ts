/// <reference types="vitest/globals" />

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data, meta: { total: 0 }, counts: { pending: 0, flagged: 0, inProgress: 0, completed: 0 } }),
  };
}

describe('reviewApi scoped queue/session requests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    localStorage.clear();
    localStorage.setItem('accessToken', 'test-token');
  });

  async function importApi() {
    vi.resetModules();
    return await import('../../services/reviewApi');
  }

  it('includes groupId in review queue query when provided', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));
    const api = await importApi();

    await api.getReviewQueue({ status: 'pending', groupId: '11111111-1111-1111-1111-111111111111' });

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('/api/review/queue?');
    expect(url).toContain('groupId=11111111-1111-1111-1111-111111111111');
    expect(url).toContain('tab=pending');
  });

  it('omits groupId in review queue query when undefined', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));
    const api = await importApi();

    await api.getReviewQueue({ status: 'pending' });

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('/api/review/queue?');
    expect(url).not.toContain('groupId=');
  });

  it('includes groupId for review session fetch when provided', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ session: {}, messages: [], reviews: [], flags: [] }));
    const api = await importApi();

    await api.getReviewSession('sess-1', '22222222-2222-2222-2222-222222222222');

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('/api/review/sessions/sess-1?groupId=22222222-2222-2222-2222-222222222222');
  });

  it('normalizes flattened session payload shape from backend', async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      id: 'CHAT-1',
      anonymousSessionId: 'CHAT-1',
      anonymousUserId: 'USER-1',
      messages: [{ id: 'm1', role: 'assistant', content: 'hello' }],
      myReview: { id: 'r1', status: 'in_progress' },
    }));
    const api = await importApi();

    const result = await api.getReviewSession('sess-1');

    expect(result.session).toBeTruthy();
    expect(result.messages).toHaveLength(1);
    expect(result.reviews).toHaveLength(1);
    expect(result.flags).toEqual([]);
  });
});
