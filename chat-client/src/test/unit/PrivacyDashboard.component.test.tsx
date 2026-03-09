import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let workbenchState: any

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => workbenchState,
}))

import PrivacyDashboard from '@/features/workbench/privacy/PrivacyDashboard'

describe('PrivacyDashboard (component)', () => {
  it('calls fetchUsers on mount and toggles PII mask on click', () => {
    const fetchUsers = vi.fn()
    const togglePIIMask = vi.fn()

    workbenchState = {
      users: [],
      fetchUsers,
      piiMasked: true,
      togglePIIMask,
    }

    render(<PrivacyDashboard />)
    expect(fetchUsers).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('workbench.pii.masked'))
    expect(togglePIIMask).toHaveBeenCalledTimes(1)
  })
})


