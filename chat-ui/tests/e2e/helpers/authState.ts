import type { Page } from '@playwright/test'

export interface PersistedAuthState {
  state?: {
    user?: {
      id: string
      email: string
      displayName: string
      role: string
      permissions: string[]
      groupId?: string | null
    } | null
    isAuthenticated?: boolean
    isGuest?: boolean
  }
  version?: number
}

export async function getPersistedAuthState(page: Page): Promise<PersistedAuthState | null> {
  const raw = await page.evaluate(() => window.localStorage.getItem('auth-storage'))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedAuthState
  } catch {
    return null
  }
}

export async function getCurrentUser(page: Page): Promise<PersistedAuthState['state']['user'] | null> {
  const persisted = await getPersistedAuthState(page)
  return persisted?.state?.user ?? null
}

export async function userHasPermission(page: Page, permission: string): Promise<boolean> {
  const user = await getCurrentUser(page)
  return Array.isArray(user?.permissions) ? user!.permissions.includes(permission) : false
}

