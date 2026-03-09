import type { Page } from '@playwright/test'

/**
 * App uses HashRouter, so all navigations should go through `#/...`.
 *
 * We support either:
 * - `PLAYWRIGHT_BASE_URL=http://localhost:4173` (local dev/prod server)
 * - `PLAYWRIGHT_BASE_URL=https://.../index.html` (static hosting entrypoint)
 */
export function getAppEntryUrl(): string {
  const raw = (process.env.PLAYWRIGHT_BASE_URL || '').trim()
  if (raw) return raw.replace(/\/$/, '')

  // Fallback for local runs where `playwright.config.ts` starts a dev server.
  const port = (process.env.PLAYWRIGHT_PORT || '4173').trim()
  return `http://localhost:${port}`
}

export function appUrl(route: string): string {
  const entry = getAppEntryUrl()
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`

  // If entry is `.../index.html`, we should keep it as-is.
  if (/\.(html?)$/i.test(entry)) {
    return `${entry}#${normalizedRoute}`
  }

  // If entry is a host or directory, ensure it ends with `/` before the hash.
  return `${entry.replace(/\/$/, '')}/#${normalizedRoute}`
}

export async function gotoRoute(page: Page, route: string) {
  await page.goto(appUrl(route))
}


