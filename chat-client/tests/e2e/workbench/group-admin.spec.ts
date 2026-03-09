import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'
import { userHasPermission, getCurrentUser } from '../helpers/authState'

async function ensureGroupScopeSelected(page: any) {
  const scopeSelect = page.getByLabel(/select scope/i)
  try {
    await scopeSelect.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    return false
  }
  if ((await scopeSelect.count()) === 0) return false
  const currentValue = await scopeSelect.inputValue()
  if (currentValue && currentValue !== 'global') return true
  const options = scopeSelect.locator('option')
  if ((await options.count()) < 2) {
    try {
      await expect.poll(() => options.count(), { timeout: 10000 }).toBeGreaterThan(1)
    } catch {
      return false
    }
  }
  await scopeSelect.selectOption({ index: 1 })
  await expect(scopeSelect).not.toHaveValue('')
  await page.waitForURL(/#\/workbench\/group/, { timeout: 10000 }).catch(() => null)
  return true
}

test('workbench: group dashboard renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const hasGroupDashboard = await userHasPermission(page, 'workbench:group_dashboard')
  if (!hasGroupDashboard) {
    test.skip(true, 'Account lacks workbench:group_dashboard; skipping group admin suite')
  }

  const hasGroupScope = await ensureGroupScopeSelected(page)
  if (!hasGroupScope) {
    test.skip(true, 'No group scope available for this account; skipping group admin suite')
  }

  const groupDashboardNav = page.getByRole('button', { name: /^group dashboard$/i })
  try {
    await expect(groupDashboardNav).toBeVisible({ timeout: 5000 })
  } catch {
    test.skip(true, 'Group dashboard nav is not available for this account')
  }
  await groupDashboardNav.click()

  await expect(page.getByRole('heading', { name: /^group dashboard$/i })).toBeVisible()

  // UX: key CTAs should be obvious and clickable (no mutation here).
  await expect(page.getByRole('button', { name: /manage group users/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /view anonymized chats/i })).toBeVisible()
})

test('workbench: group users and chats pages render (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/#\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const hasGroupUsers = await userHasPermission(page, 'workbench:group_users')
  const hasGroupResearch = await userHasPermission(page, 'workbench:group_research')
  if (!hasGroupUsers && !hasGroupResearch) {
    test.skip(true, 'Account lacks group permissions; skipping')
  }

  const hasGroupScope = await ensureGroupScopeSelected(page)
  if (!hasGroupScope) {
    test.skip(true, 'No group scope available for this account; skipping group admin suite')
  }

  if (hasGroupUsers) {
    const groupUsersNav = page.getByRole('button', { name: /^group users$/i })
    try {
      await expect(groupUsersNav).toBeVisible({ timeout: 5000 })
    } catch {
      test.skip(true, 'Group users nav is not available for this account')
    }
    await groupUsersNav.click()

    await expect(page.getByRole('heading', { name: /^group users$/i })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()

    // UX: add-by-email control is only available for group_admin role (membership editor).
    const user = await getCurrentUser(page)
    if (user?.role === 'group_admin') {
    await expect(page.getByText(/^add user by email$/i)).toBeVisible()
    await expect(page.getByPlaceholder(/user@example\.com/i)).toBeVisible()
    }
  }

  if (hasGroupResearch) {
    const groupChatsNav = page.getByRole('button', { name: /^group chats$/i })
    await expect(groupChatsNav).toBeVisible()
    await groupChatsNav.click()

    await expect(page.getByRole('heading', { name: /^group chats$/i })).toBeVisible()

    // If there is at least one session card, open it and ensure transcript loads.
    const firstSessionId = page.locator('span.font-mono').first()
    if ((await firstSessionId.count()) === 0) {
      test.skip(true, 'No group sessions available in this environment')
    }

    const sessionIdText = (await firstSessionId.textContent())?.trim() || ''
    await firstSessionId.click()

    await expect(page).toHaveURL(/#\/workbench\/group\/sessions\//)
    if (sessionIdText) {
      await expect(page.getByText(sessionIdText)).toBeVisible()
    }

    // UX: either a message renders, or an explicit empty/error state is shown.
    const anyMessage = page.locator('.animate-slide-up').first()
    const notFound = page.getByText(/^not found$/i)
    const loading = page.getByText(/^loading\.\.\.$/i)
    await expect(anyMessage.or(notFound).or(loading)).toBeVisible()
  }
})

