/// <reference types="vitest/globals" />
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import App from '@/App'
import { useAuthStore, useIsGuest } from '@/stores/authStore'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    enterAsGuest: vi.fn(),
    logout: vi.fn(),
    guestModeEnabled: true,
    loadPublicSettings: vi.fn(),
  })),
  useIsGuest: vi.fn(() => false),
}))

describe('App', () => {
  it('renders the welcome screen', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('app.name')).toBeInTheDocument()
    expect(screen.getByText('welcome.startConversation')).toBeInTheDocument()
    expect(screen.getByText('welcome.privacyNote')).toBeInTheDocument()
  })

  it('shows signed-in user and sign out on home', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { displayName: 'Test User' } as any,
      enterAsGuest: vi.fn(),
      logout: vi.fn(),
      guestModeEnabled: true,
      loadPublicSettings: vi.fn(),
    } as any)
    vi.mocked(useIsGuest).mockReturnValue(false)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('welcome.signedInAs:Test User')).toBeInTheDocument()
    expect(screen.getByText('common.signOut')).toBeInTheDocument()
  })

  it('hides the sign-in link when guest mode is disabled', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      user: null,
      enterAsGuest: vi.fn(),
      logout: vi.fn(),
      guestModeEnabled: false,
      loadPublicSettings: vi.fn(),
    } as any)
    vi.mocked(useIsGuest).mockReturnValue(false)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('welcome.signInToStart')).toBeInTheDocument()
    expect(screen.queryByText('welcome.signIn')).not.toBeInTheDocument()
  })
})

