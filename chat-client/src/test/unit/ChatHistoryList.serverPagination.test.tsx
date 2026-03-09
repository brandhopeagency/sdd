import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const fetchSessions = vi.fn()

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => ({
    sessions: [],
    sessionsLoading: false,
    sessionsError: null,
    sessionsPagination: { page: 1, limit: 20, total: 0, hasMore: false },
    fetchSessions,
    piiMasked: true,
  }),
}))

// Keep test independent from router URL parsing; component uses useSearchParams but doesn't require specific params.
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

import ChatHistoryList from '@/features/workbench/research/ChatHistoryList'

describe('ChatHistoryList server-side pagination', () => {
  it('calls fetchSessions with default params on mount', () => {
    vi.useFakeTimers()
    fetchSessions.mockClear()

    render(<ChatHistoryList />)

    expect(fetchSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        search: undefined,
        moderationStatus: 'all',
        dateFrom: undefined,
        dateTo: undefined,
      })
    )

    vi.useRealTimers()
  })

  it('debounces search and resets page', async () => {
    vi.useFakeTimers()
    fetchSessions.mockClear()

    render(<ChatHistoryList />)
    fetchSessions.mockClear() // ignore initial call

    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'abc' } })

    // Before debounce window -> no new call
    expect(fetchSessions).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(fetchSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        search: 'abc',
      })
    )

    vi.useRealTimers()
  })
})


