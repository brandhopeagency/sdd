import type { Page } from '@playwright/test'

/**
 * Navigate to a route using the project's configured baseURL.
 * Uses relative path so Playwright resolves against the project's baseURL,
 * which differs between chat and workbench projects.
 */
export async function gotoRoute(page: Page, route: string) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  await page.goto(normalizedRoute)
}

/**
 * Build an absolute URL from a base URL and route (for split-surface helpers
 * that need to construct cross-domain URLs).
 */
export function appUrl(baseUrl: string, route: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${base}${normalizedRoute}`
}


