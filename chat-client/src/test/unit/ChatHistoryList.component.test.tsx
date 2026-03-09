import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let workbenchState: any
const navigateMock = vi.fn()

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => workbenchState,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return { ...original, useNavigate: () => navigateMock, useSearchParams: () => [new URLSearchParams(), vi.fn()] }
})

import ChatHistoryList from '@/features/workbench/research/ChatHistoryList'

describe('ChatHistoryList (component)', () => {
  it('navigates to session detail on row click', () => {
    const fetchSessions = vi.fn(async () => {})
    workbenchState = {
      sessions: [
        {
          id: 's1',
          userId: 'u1',
          dialogflowSessionId: 'df1',
          status: 'active',
          startedAt: new Date(),
          endedAt: null,
          messageCount: 1,
          moderationStatus: 'pending',
          tags: [],
          userName: 'Alice',
          duration: 60_000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      sessionsLoading: false,
      sessionsError: null,
      sessionsPagination: { page: 1, limit: 20, total: 1, hasMore: false },
      fetchSessions,
      piiMasked: true,
    }

    render(<ChatHistoryList />)
    fireEvent.click(screen.getByText('s1'))
    expect(navigateMock).toHaveBeenCalledWith('/workbench/research/session/s1')
  })

  it('caps long duration and marks active sessions as ongoing', () => {
    const fetchSessions = vi.fn(async () => {})
    workbenchState = {
      sessions: [
        {
          id: 's1',
          userId: 'u1',
          dialogflowSessionId: 'df1',
          status: 'active',
          startedAt: new Date(),
          endedAt: null,
          messageCount: 1,
          moderationStatus: 'pending',
          tags: [],
          userName: 'Alice',
          // > 24h in ms
          duration: 26 * 60 * 60 * 1000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      sessionsLoading: false,
      sessionsError: null,
      sessionsPagination: { page: 1, limit: 20, total: 1, hasMore: false },
      fetchSessions,
      piiMasked: true,
    }

    render(<ChatHistoryList />)
    expect(screen.getByText(/>24h/i)).toBeVisible()
    expect(screen.getByText(/\(research\.session\.ongoing\)/i)).toBeVisible()
  })
})


