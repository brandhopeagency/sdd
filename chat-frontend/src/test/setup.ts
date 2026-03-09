import '@testing-library/jest-dom/vitest'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

// Initialize an MSW server with no default handlers; tests can register per-suite.
export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Global i18n mocks to avoid repeating boilerplate in each test.
// Individual tests can override with `vi.mock(...)` if needed.
vi.mock('@/i18n', () => ({}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { init: vi.fn() },
}))

