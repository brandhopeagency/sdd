import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PLAYWRIGHT_PORT || '4173'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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

