const { defineConfig, devices } = require('@playwright/test')

const PORT = process.env.PLAYWRIGHT_PORT || '4173'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

module.exports = defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chat',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CHAT_BASE_URL || 'https://dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/chat/**/*.spec.ts',
        '**/e2e/responsive/chat-*.spec.ts',
        '**/e2e/pwa/chat-*.spec.ts',
        '**/cross-surface*.spec.ts',
        '**/legacy-redirects*.spec.ts',
      ],
    },
    {
      name: 'chat-mobile',
      use: {
        ...devices['iPhone 14'],
        baseURL: process.env.CHAT_BASE_URL || 'https://dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/responsive/chat-*.spec.ts',
      ],
    },
    {
      name: 'chat-tablet',
      use: {
        ...devices['iPad Mini'],
        baseURL: process.env.CHAT_BASE_URL || 'https://dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/responsive/chat-*.spec.ts',
      ],
    },
    {
      name: 'workbench',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.WORKBENCH_BASE_URL || 'https://workbench.dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/workbench/**/*.spec.ts',
        '**/e2e/responsive/workbench-*.spec.ts',
        '**/e2e/pwa/workbench-*.spec.ts',
        '**/cross-surface*.spec.ts',
      ],
    },
    {
      name: 'workbench-mobile',
      use: {
        ...devices['iPhone 14'],
        baseURL: process.env.WORKBENCH_BASE_URL || 'https://workbench.dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/responsive/workbench-*.spec.ts',
      ],
    },
    {
      name: 'workbench-tablet',
      use: {
        ...devices['iPad Mini'],
        baseURL: process.env.WORKBENCH_BASE_URL || 'https://workbench.dev.mentalhelp.chat',
      },
      testMatch: [
        '**/e2e/responsive/workbench-*.spec.ts',
      ],
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host --port ${PORT}`,
        port: Number(PORT),
        reuseExistingServer: true,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})

