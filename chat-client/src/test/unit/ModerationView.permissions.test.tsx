/// <reference types="vitest/globals" />

import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import ModerationView from '@/features/workbench/research/ModerationView'
import { Permission } from '@/types'
vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: vi.fn(() => ({
    selectedSession: {
      id: 'sess-1',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      moderationStatus: 'pending',
      tags: [],
      userName: 'Test User',
    },
    sessionMessages: [],
    tags: [],
    annotations: [],
    selectSession: vi.fn(),
    fetchTags: vi.fn(),
    updateSessionStatus: vi.fn(),
    addTagToSession: vi.fn(),
    removeTagFromSession: vi.fn(),
    saveAnnotation: vi.fn(),
    piiMasked: true,
  })),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: {
      id: 'u1',
      email: 't@example.com',
      displayName: 'Test User',
      role: 'researcher',
      permissions: [Permission.WORKBENCH_ACCESS, Permission.WORKBENCH_RESEARCH],
      groupId: null,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    },
  })),
}))

// Keep these lightweight for this test suite.
vi.mock('@/features/chat/MessageBubble', () => ({
  default: () => null,
}))
vi.mock('@/components/TechnicalDetails', () => ({
  TechnicalDetails: () => null,
}))

describe('ModerationView RBAC', () => {
  it('disables write actions without workbench:moderation', () => {
    render(
      <MemoryRouter initialEntries={['/workbench/research/session/sess-1']}>
        <Routes>
          <Route path="/workbench/research/session/:sessionId" element={<ModerationView />} />
        </Routes>
      </MemoryRouter>,
    )

    // Buttons exist, but should be disabled without moderation permission.
    const save = screen.getByRole('button', { name: 'moderation.annotation.save' })
    const markComplete = screen.getByRole('button', { name: 'moderation.annotation.markComplete' })
    expect(save).toBeDisabled()
    expect(markComplete).toBeDisabled()
  })
})


