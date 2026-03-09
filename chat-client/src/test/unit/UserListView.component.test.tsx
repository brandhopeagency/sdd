import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { maskEmail, maskName } from '@/utils/piiMasking'

let workbenchState: any
let authState: any

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => workbenchState,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return { ...original, useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams(), vi.fn()] }
})

import UserListView from '@/features/workbench/users/UserListView'

describe('UserListView (component)', () => {
  it('calls fetchUsers with default params on mount and debounces search', async () => {
    vi.useFakeTimers()
    const fetchUsers = vi.fn(async () => {})

    authState = { user: { permissions: ['workbench:user_management'] } }
    workbenchState = {
      users: [],
      usersLoading: false,
      usersError: null,
      usersPagination: { page: 1, limit: 10, total: 0, hasMore: false },
      fetchUsers,
      piiMasked: true,
    }

    render(<UserListView />)
    expect(fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, role: 'all', status: 'all' })
    )

    fireEvent.change(screen.getByPlaceholderText('users.search'), { target: { value: 'alice' } })
    expect(fetchUsers).toHaveBeenCalledTimes(1)

    await act(async () => {
      await (vi as any).advanceTimersByTimeAsync(300)
    })

    // Flush microtasks scheduled by React effect
    await act(async () => {})

    expect(fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alice', page: 1, limit: 10 })
    )

    vi.useRealTimers()
  })

  it('masks user email when piiMasked is true', () => {
    const fetchUsers = vi.fn(async () => {})
    authState = { user: { permissions: ['workbench:user_management'] } }
    workbenchState = {
      users: [
        {
          id: 'u1',
          email: 'a@b.com',
          displayName: 'Alice',
          role: 'user',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          sessionCount: 0,
        },
      ],
      usersLoading: false,
      usersError: null,
      usersPagination: { page: 1, limit: 10, total: 1, hasMore: false },
      fetchUsers,
      piiMasked: true,
    }

    render(<UserListView />)
    expect(screen.queryByText('a@b.com')).toBeNull()
    expect(screen.getByText(maskEmail('a@b.com'))).toBeVisible()
  })

  it('adds title tooltip for user name and respects piiMasked', () => {
    const fetchUsers = vi.fn(async () => {})
    authState = { user: { permissions: ['workbench:user_management'] } }

    const fullName = 'Antonina Boleyn'

    workbenchState = {
      users: [
        {
          id: 'u1',
          email: 'a@b.com',
          displayName: fullName,
          role: 'user',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          sessionCount: 0,
        },
      ],
      usersLoading: false,
      usersError: null,
      usersPagination: { page: 1, limit: 10, total: 1, hasMore: false },
      fetchUsers,
      piiMasked: false,
    }

    const { unmount } = render(<UserListView />)
    const nameEl = screen.getByText(fullName)
    expect(nameEl).toHaveAttribute('title', fullName)

    // Masked mode: tooltip must not reveal the full name.
    unmount()
    workbenchState = { ...workbenchState, piiMasked: true }
    render(<UserListView />)

    const masked = maskName(fullName)
    const maskedEl = screen.getByText(masked)
    expect(maskedEl).toHaveAttribute('title', masked)
    expect(maskedEl).not.toHaveAttribute('title', fullName)
  })
})


