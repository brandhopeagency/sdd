import { describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('chatStore', () => {
  it('startSession: uses backend session + sets greeting (guest passes userId)', async () => {
    vi.resetModules()

    const handleApiError = vi.fn()
    const getEffectiveUserId = vi.fn(() => 'guest_1')

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError,
          getEffectiveUserId,
          user: null,
        }),
      },
    }))

    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))


    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      expect(String(url)).toContain('/api/chat/sessions')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(init?.body || '{}')
      expect(body.userId).toBe('guest_1')
      return jsonResponse({
        data: {
          id: 's1',
          userId: 'guest_1',
          dialogflowSessionId: 'df_1',
          startedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          initialAssistantMessage: 'hello',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { useChatStore } = await import('@/stores/chatStore')
    await useChatStore.getState().startSession()

    const state = useChatStore.getState()
    expect(state.session?.id).toBe('s1')
    expect(state.session?.userId).toBe('guest_1')
    expect(state.messages[0]?.role).toBe('assistant')
    expect(state.messages[0]?.content).toBe('hello')
    expect(state.isTyping).toBe(false)
  })

  it('sendMessage: sends message and replaces temp message with server messages', async () => {
    vi.resetModules()

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(),
          getEffectiveUserId: () => 'guest_1',
          user: null,
        }),
      },
    }))
    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))

    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      expect(String(url)).toContain('/api/chat/message')
      expect(init?.method).toBe('POST')
      return jsonResponse({
        data: {
          userMessage: {
            id: 'um1',
            role: 'user',
            content: 'hi',
            timestamp: '2026-01-01T00:00:01.000Z',
          },
          assistantMessage: {
            id: 'am1',
            role: 'assistant',
            content: 'hello',
            timestamp: '2026-01-01T00:00:02.000Z',
          },
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { useChatStore } = await import('@/stores/chatStore')

    useChatStore.setState({
      session: {
        id: 's1',
        userId: 'guest_1',
        dialogflowSessionId: 'df_1',
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      messages: [],
      isTyping: false,
    })

    await useChatStore.getState().sendMessage('hi')

    const state = useChatStore.getState()
    expect(state.isTyping).toBe(false)
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].id).toBe('um1')
    expect(state.messages[1].id).toBe('am1')
    expect(state.session?.messageCount).toBe(2)
  })

  it('sendMessage: on backend error does not add fallback assistant reply and marks message failed', async () => {
    vi.resetModules()

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(),
          getEffectiveUserId: () => 'guest_1',
          user: null,
        }),
      },
    }))
    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))

    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const fetchMock = vi.fn(async () => jsonResponse({ error: { message: 'boom' } }, 500))
    vi.stubGlobal('fetch', fetchMock as any)

    const { useChatStore } = await import('@/stores/chatStore')
    useChatStore.setState({
      session: {
        id: 's1',
        userId: 'guest_1',
        dialogflowSessionId: 'df_1',
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      messages: [],
      isTyping: false,
    })

    await useChatStore.getState().sendMessage('hi')
    const state = useChatStore.getState()
    expect(state.isTyping).toBe(false)
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].content).toBe('hi')
    expect(state.messages[0].metadata.client?.status).toBe('failed')
  })

  it('retryFailedMessage: removes failed message and re-sends via sendMessage', async () => {
    vi.resetModules()

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(),
          getEffectiveUserId: () => 'guest_1',
          user: null,
        }),
      },
    }))
    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))

    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          userMessage: { id: 'um1', role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01.000Z' },
          assistantMessage: { id: 'am1', role: 'assistant', content: 'ok', timestamp: '2026-01-01T00:00:02.000Z' },
        },
      })
    )
    vi.stubGlobal('fetch', fetchMock as any)

    const { useChatStore } = await import('@/stores/chatStore')
    useChatStore.setState({
      session: {
        id: 's1',
        userId: 'guest_1',
        dialogflowSessionId: 'df_1',
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      messages: [
        {
          id: 'failed1',
          sessionId: 's1',
          role: 'user',
          content: 'hi',
          timestamp: new Date('2026-01-01T00:00:01.000Z'),
          feedback: null,
          metadata: { client: { status: 'failed', retryable: true, originalContent: 'hi' } },
          tags: [],
          createdAt: new Date('2026-01-01T00:00:01.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
      isTyping: false,
    })

    await useChatStore.getState().retryFailedMessage('failed1')
    const state = useChatStore.getState()
    expect(state.messages.some((m) => m.id === 'failed1')).toBe(false)
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].id).toBe('um1')
    expect(state.messages[1].id).toBe('am1')
  })

  it('beginMemoryUpdateWatcher: exponential backoff + circuit breaker after consecutive failures', async () => {
    vi.resetModules()
    vi.useFakeTimers()

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(),
          getEffectiveUserId: () => 'guest_1',
          user: null,
        }),
      },
    }))
    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))

    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const { useChatStore } = await import('@/stores/chatStore')

    const refreshSessionMemory = vi.fn(async () => {
      throw new Error('boom')
    })

    useChatStore.setState({
      session: {
        id: 's1',
        userId: 'guest_1',
        dialogflowSessionId: 'df_1',
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: null,
        messageCount: 0,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      refreshSessionMemory,
      memoryUpdateStatus: 'idle',
      memoryWatcherLast: null,
    } as any)

    useChatStore.getState().beginMemoryUpdateWatcher({ sessionId: 's1', baselineUpdatedAt: null })

    // backoff waits: 1s + 2s + 4s + 8s + 16s (6th failure trips breaker)
    await (vi as any).advanceTimersByTimeAsync(31_000)

    expect(refreshSessionMemory).toHaveBeenCalledTimes(6)
    expect(useChatStore.getState().memoryUpdateStatus).toBe('failed')

    vi.useRealTimers()
  })
  it('submitFeedback: optimistic update then revert when backend fails', async () => {
    vi.resetModules()

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          handleApiError: vi.fn(),
          getEffectiveUserId: () => 'guest_1',
          user: null,
        }),
      },
    }))
    vi.doMock('@/services/api', () => ({
      getAccessToken: () => null,
      apiFetch: (url: string, options?: RequestInit) => fetch(url, options),
    }))

    vi.doMock('@/i18n', () => ({ default: { language: 'en' } }))

    const fetchMock = vi.fn(async () => jsonResponse({ error: 'fail' }, 500))
    vi.stubGlobal('fetch', fetchMock as any)

    const { useChatStore } = await import('@/stores/chatStore')
    useChatStore.setState({
      session: {
        id: 's1',
        userId: 'guest_1',
        dialogflowSessionId: 'df_1',
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: null,
        messageCount: 2,
        moderationStatus: 'pending',
        tags: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      messages: [
        {
          id: 'am1',
          sessionId: 's1',
          role: 'assistant',
          content: 'hello',
          timestamp: new Date('2026-01-01T00:00:02.000Z'),
          feedback: null,
          metadata: {},
          tags: [],
          createdAt: new Date('2026-01-01T00:00:02.000Z'),
          updatedAt: new Date('2026-01-01T00:00:02.000Z'),
        },
      ],
    })

    await useChatStore.getState().submitFeedback('am1', 5, 'great')
    const state = useChatStore.getState()
    expect(state.messages[0].feedback).toBeNull()
  })
})


