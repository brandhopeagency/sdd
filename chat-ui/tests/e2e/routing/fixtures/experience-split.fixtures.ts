import { test as base } from '@playwright/test'

interface SplitFixtures {
  chatBaseUrl: string
  workbenchBaseUrl: string
  chatApiUrl: string
  workbenchApiUrl: string
}

export const test = base.extend<SplitFixtures>({
  chatBaseUrl: async ({}, use) => {
    await use(process.env.PLAYWRIGHT_CHAT_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173')
  },
  workbenchBaseUrl: async ({}, use) => {
    await use(process.env.PLAYWRIGHT_WORKBENCH_URL || 'http://localhost:4174')
  },
  chatApiUrl: async ({}, use) => {
    await use(process.env.PLAYWRIGHT_CHAT_API_URL || 'http://localhost:3001')
  },
  workbenchApiUrl: async ({}, use) => {
    await use(process.env.PLAYWRIGHT_WORKBENCH_API_URL || 'http://localhost:3002')
  },
})

export { expect } from '@playwright/test'
