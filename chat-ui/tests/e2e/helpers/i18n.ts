import type { Page } from '@playwright/test'

/**
 * Force deterministic language before the app boots.
 * App stores language under `localStorage.language` (see `src/i18n.ts`).
 */
export async function initLanguage(page: Page, lang: 'en' | 'uk' | 'ru' = 'en') {
  await page.addInitScript((lng: string) => {
    window.localStorage.setItem('language', lng)
  }, lang)
}


