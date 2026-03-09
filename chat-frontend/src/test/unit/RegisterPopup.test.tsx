import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const upgradeFromGuest = vi.fn()
const resetOtpState = vi.fn()
const bindSessionToUser = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ upgradeFromGuest, resetOtpState }),
}))

vi.mock('@/stores/chatStore', () => ({
  useChatStore: () => ({ bindSessionToUser }),
}))

// Replace OtpLoginForm with a deterministic stub to trigger onSuccess.
vi.mock('@/components/OtpLoginForm', () => ({
  default: ({ onSuccess }: any) => (
    <button
      type="button"
      onClick={() => onSuccess({ id: 'u1', email: 'a@b.com', displayName: 'A' }, true)}
    >
      trigger success
    </button>
  ),
}))

import RegisterPopup from '@/components/RegisterPopup'

describe('RegisterPopup', () => {
  it('calls resetOtpState + onClose when clicking backdrop', () => {
    const onClose = vi.fn()
    render(<RegisterPopup onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    expect(resetOtpState).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('binds session and upgrades guest on successful OTP', () => {
    const onClose = vi.fn()
    render(<RegisterPopup onClose={onClose} />)

    fireEvent.click(screen.getByText(/trigger success/i))
    expect(bindSessionToUser).toHaveBeenCalledWith('u1')
    expect(upgradeFromGuest).toHaveBeenCalledWith({ id: 'u1', email: 'a@b.com', displayName: 'A' })
    expect(onClose).toHaveBeenCalled()
  })
})


