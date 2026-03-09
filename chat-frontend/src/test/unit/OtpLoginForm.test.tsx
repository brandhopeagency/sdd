import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let storeState: any

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => storeState,
}))

import OtpLoginForm from '@/components/OtpLoginForm'

describe('OtpLoginForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('validates email before calling sendOtp', async () => {
    const sendOtp = vi.fn()
    const resetOtpState = vi.fn()

    storeState = {
      sendOtp,
      verifyOtp: vi.fn(),
      resetOtpState,
      otpSent: false,
      pendingEmail: null,
      otpError: null,
      isLoading: false,
    }

    render(<OtpLoginForm onSuccess={vi.fn()} />)

    const input = screen.getByPlaceholderText('login.otp.emailPlaceholder')
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.submit(input.closest('form')!)

    expect(sendOtp).not.toHaveBeenCalled()
    expect(screen.getByText('login.otp.invalidEmail')).toBeVisible()
  })

  it('sendOtp called with email and verifyOtp calls onSuccess on success', async () => {
    const sendOtp = vi.fn(async () => {})
    const verifyOtp = vi.fn(async () => ({ success: true, user: { id: 'u1' }, isNewUser: false }))
    const resetOtpState = vi.fn()
    const onSuccess = vi.fn()

    // Step 1: email form
    storeState = {
      sendOtp,
      verifyOtp,
      resetOtpState,
      otpSent: false,
      pendingEmail: null,
      otpError: null,
      isLoading: false,
    }

    const { rerender, unmount } = render(<OtpLoginForm onSuccess={onSuccess} />)

    const emailInput = screen.getByPlaceholderText('login.otp.emailPlaceholder')
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } })
    fireEvent.submit(emailInput.closest('form')!)
    expect(sendOtp).toHaveBeenCalledWith('a@b.com')

    // Step 2: OTP form
    storeState = {
      ...storeState,
      otpSent: true,
      pendingEmail: 'a@b.com',
    }
    rerender(<OtpLoginForm onSuccess={onSuccess} />)

    const otpInput = screen.getByPlaceholderText('000000')
    fireEvent.change(otpInput, { target: { value: '123456' } })
    await fireEvent.submit(otpInput.closest('form')!)

    expect(verifyOtp).toHaveBeenCalledWith('a@b.com', '123456', undefined)
    // onSuccess called with user + isNewUser
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: 'u1' }, false)
    })

    // unmount should reset state
    unmount()
    expect(resetOtpState).toHaveBeenCalled()
  })

  it('back button resets otp state and returns to email step', async () => {
    const resetOtpState = vi.fn()
    storeState = {
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
      resetOtpState,
      otpSent: true,
      pendingEmail: 'a@b.com',
      otpError: null,
      isLoading: false,
    }

    render(<OtpLoginForm onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByText('login.otp.changeEmail'))
    expect(resetOtpState).toHaveBeenCalled()
  })
})


