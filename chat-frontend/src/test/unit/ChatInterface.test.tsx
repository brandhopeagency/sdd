import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// NOTE: Vitest hoists vi.mock calls to the top of the module. Use `var` so the bindings exist at hoist-time.
// eslint-disable-next-line no-var
var authState: { user: any; logout: any }
// eslint-disable-next-line no-var
var isGuest: boolean
// eslint-disable-next-line no-var
var canAccessWorkbench: boolean
// eslint-disable-next-line no-var
var chatState: any

authState = { user: null, logout: vi.fn() }
isGuest = false
canAccessWorkbench = false
chatState = {
  session: null,
  messages: [],
  isTyping: false,
  agentMemory: null,
  memoryUpdateStatus: 'idle',
  endSessionInBackground: vi.fn(),
  beginMemoryUpdateWatcher: vi.fn(),
  resumeMemoryUpdateWatcher: vi.fn(),
  startSession: vi.fn(),
  endSession: vi.fn(),
  sendMessage: vi.fn(),
  retryFailedMessage: vi.fn(),
  submitFeedback: vi.fn(),
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authState,
  useIsGuest: () => isGuest,
  useCanAccessWorkbench: () => canAccessWorkbench,
}))

vi.mock('@/stores/chatStore', () => {
  const useChatStore: any = () => chatState
  useChatStore.getState = () => chatState
  return { useChatStore }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return { ...original, useNavigate: () => vi.fn() }
})

import ChatInterface from '@/features/chat/ChatInterface'

describe('ChatInterface', () => {
  beforeAll(() => {
    // JSDOM doesn't implement scrollIntoView; ChatInterface uses it in an effect.
    if (!Element.prototype.scrollIntoView) {
      ;(Element.prototype as any).scrollIntoView = vi.fn()
    }
  })

  it('starts a session on mount when no session exists', () => {
    authState = { user: { id: 'u1', permissions: [] }, logout: vi.fn() }
    isGuest = false
    canAccessWorkbench = false
    chatState = {
      ...chatState,
      session: null,
      isTyping: false,
      startSession: vi.fn(),
    }

    render(<ChatInterface />)
    return waitFor(() => {
      expect(chatState.startSession).toHaveBeenCalledWith('u1')
    })
  })

  it('does not send empty message', async () => {
    authState = { user: { id: 'u1', permissions: [] }, logout: vi.fn() }
    isGuest = false
    canAccessWorkbench = false
    chatState = {
      ...chatState,
      session: { id: 's1', status: 'active' },
      isTyping: false,
      sendMessage: vi.fn(),
    }

    render(<ChatInterface />)
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()

    const input = screen.getByPlaceholderText('chat.input.placeholder')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(sendBtn).toBeDisabled()
    fireEvent.click(sendBtn)
    expect(chatState.sendMessage).not.toHaveBeenCalled()
  })

  it('disables send while isTyping and blocks Enter submit', () => {
    authState = { user: { id: 'u1', permissions: [] }, logout: vi.fn() }
    isGuest = false
    canAccessWorkbench = false
    chatState = {
      ...chatState,
      session: { id: 's1', status: 'active' },
      isTyping: true,
      sendMessage: vi.fn(),
    }

    render(<ChatInterface />)
    const input = screen.getByPlaceholderText('chat.input.placeholder')
    fireEvent.change(input, { target: { value: 'hello' } })

    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()

    // Enter should not send while isTyping
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    expect(chatState.sendMessage).not.toHaveBeenCalled()
  })

  it('shows Workbench button only when canAccessWorkbench is true', () => {
    authState = { user: { id: 'u1', permissions: [] }, logout: vi.fn() }
    isGuest = false
    chatState = { ...chatState, session: { id: 's1', status: 'active' } }

    canAccessWorkbench = false
    const { rerender } = render(<ChatInterface />)
    expect(screen.queryByTitle('workbench.title')).toBeNull()

    canAccessWorkbench = true
    rerender(<ChatInterface />)
    expect(screen.getByTitle('workbench.title')).toBeInTheDocument()
  })

  it('renders guest registration CTA when isGuest is true', () => {
    authState = { user: null, logout: vi.fn() }
    isGuest = true
    canAccessWorkbench = false
    chatState = { ...chatState, session: { id: 's1', status: 'active' } }

    render(<ChatInterface />)
    expect(screen.getByText('chat.guest')).toBeVisible()
    expect(screen.getByText('chat.register')).toBeVisible()
  })

  it('New Session button shows loading/disabled while starting a new session', async () => {
    authState = { user: { id: 'u1', permissions: [] }, logout: vi.fn() }
    isGuest = false
    canAccessWorkbench = false

    let resolveStart: (() => void) | undefined
    const startSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve
        })
    )

    chatState = {
      ...chatState,
      session: { id: 's1', status: 'active' },
      isTyping: false,
      startSession,
    }

    render(<ChatInterface />)

    const newSessionBtn = screen.getByText('chat.session.new').closest('button') as HTMLButtonElement
    expect(newSessionBtn).toBeTruthy()
    expect(newSessionBtn.disabled).toBe(false)

    fireEvent.click(newSessionBtn)
    await waitFor(() => {
      expect((screen.getByText('chat.session.new').closest('button') as HTMLButtonElement).disabled).toBe(true)
    })

    if (!resolveStart) throw new Error('Expected startSession to create a pending promise')
    resolveStart()
    await waitFor(() => {
      expect((screen.getByText('chat.session.new').closest('button') as HTMLButtonElement).disabled).toBe(false)
    })
  })
})


