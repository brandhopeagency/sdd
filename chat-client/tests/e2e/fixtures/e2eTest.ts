import { test as base, expect, type ConsoleMessage, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'

type ConsoleEntry = {
  type: string
  text: string
  url?: string
  lineNumber?: number
  columnNumber?: number
  timestamp: string
}

type RequestFailureEntry = {
  url: string
  method: string
  failure?: string | null
  timestamp: string
}

type Collector = {
  console: ConsoleEntry[]
  pageErrors: { message: string; stack?: string; timestamp: string }[]
  requestFailures: RequestFailureEntry[]
}

function nowIso() {
  return new Date().toISOString()
}

function sanitizeConsoleText(text: string): string {
  // Avoid leaking OTP dev codes into CI artifacts/logs.
  // Example logged line: "║  Code:    123456                                             ║"
  return text.replace(/\b(Code:\s*)(\d{6})\b/g, '$1******')
}

function consoleToEntry(msg: ConsoleMessage): ConsoleEntry {
  const loc = msg.location?.()
  return {
    type: msg.type(),
    text: sanitizeConsoleText(msg.text()),
    url: loc?.url,
    lineNumber: loc?.lineNumber,
    columnNumber: loc?.columnNumber,
    timestamp: nowIso(),
  }
}

function shouldIgnoreConsoleError(entry: ConsoleEntry): boolean {
  // Keep this allowlist very small; expand only when we have a proven benign baseline.
  // OTP dev banner is `console.log`, not `console.error`, so no special-casing needed.

  // Some browsers occasionally emit benign resize observer warnings as errors in certain builds.
  if (/ResizeObserver loop limit exceeded/i.test(entry.text)) return true

  return false
}

async function attachCollector(testInfo: TestInfo, collector: Collector) {
  await testInfo.attach('browser-logs.json', {
    body: JSON.stringify(collector, null, 2),
    contentType: 'application/json',
  })
}

async function installCollectors(page: Page): Promise<Collector> {
  const collector: Collector = {
    console: [],
    pageErrors: [],
    requestFailures: [],
  }

  page.on('console', (msg) => collector.console.push(consoleToEntry(msg)))
  page.on('pageerror', (err) =>
    collector.pageErrors.push({ message: String(err?.message || err), stack: (err as any)?.stack, timestamp: nowIso() })
  )
  page.on('requestfailed', (req) =>
    collector.requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? null,
      timestamp: nowIso(),
    })
  )

  return collector
}

export const test = base.extend<{ collector: Collector }>({
  collector: async ({ page }, provide, testInfo) => {
    const collector = await installCollectors(page)
    await provide(collector)

    const writeReproArtifacts = async (reason: string) => {
      const repro = [
        '# Steps to reproduce (Playwright UI E2E)',
        '',
        `- Reason: ${reason}`,
        `- Test: ${testInfo.title}`,
        `- File: ${testInfo.file}`,
        `- Project: ${testInfo.project.name}`,
        `- Base URL: ${process.env.PLAYWRIGHT_BASE_URL || '(not set)'}`,
        `- Current URL: ${page.url()}`,
        `- Time: ${nowIso()}`,
        '',
        '## Repro command (dev env)',
        '',
        '```bash',
        `PLAYWRIGHT_BASE_URL="${process.env.PLAYWRIGHT_BASE_URL || ''}" \\`,
        `PLAYWRIGHT_EMAIL="${process.env.PLAYWRIGHT_EMAIL || 'playwright@mentalhelp.global'}" \\`,
        `npx playwright test "${testInfo.file}" --grep ${JSON.stringify(testInfo.title)} --project=${testInfo.project.name} --headed --timeout=90000`,
        '```',
        '',
      ].join('\n')

      const reproPath = testInfo.outputPath('repro.md')
      fs.writeFileSync(reproPath, repro, 'utf8')
      await testInfo.attach('repro.md', { path: reproPath, contentType: 'text/markdown' })

      const screenshotPath = testInfo.outputPath('failure.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      await testInfo.attach('failure.png', { path: screenshotPath, contentType: 'image/png' })
    }

    // If test body already failed, attach repro + screenshot right away.
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeReproArtifacts('Test failed before log assertions (test body failure)')
    }

    // Always attach logs, even on pass, for auditability/debugging.
    await attachCollector(testInfo, collector)

    // Assertions (and if these fail, also attach repro + screenshot)
    try {
      expect(collector.pageErrors, 'No uncaught page errors').toEqual([])
      expect(collector.requestFailures, 'No failed network requests').toEqual([])

      const consoleErrors = collector.console.filter((c) => c.type === 'error' && !shouldIgnoreConsoleError(c))
      expect(consoleErrors, 'No console.error messages').toEqual([])
    } catch (err) {
      await writeReproArtifacts('Failed log assertions (console/pageerror/requestfailed)')
      throw err
    }
  },
})

export { expect }


