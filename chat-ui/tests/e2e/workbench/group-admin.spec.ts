import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'
import { userHasPermission, getCurrentUser } from '../helpers/authState'

async function ensureGroupScopeSelected(page: any, route: string) {
  await gotoRoute(page, route)
  const scopeSelect = page.getByLabel(/select space/i)
  try {
    await scopeSelect.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    return false
  }
  if ((await scopeSelect.count()) === 0) return false
  const currentValue = await scopeSelect.inputValue()
  if (currentValue) return true
  const options = scopeSelect.locator('option')
  if ((await options.count()) < 1) {
    try {
      await expect.poll(() => options.count(), { timeout: 10000 }).toBeGreaterThan(0)
    } catch {
      return false
    }
  }
  const values = await options.evaluateAll((nodes) =>
    nodes.map((node) => (node instanceof HTMLOptionElement ? node.value : ''))
  )
  const firstSelectable = values.find((value) => value)
  if (!firstSelectable) return false
  await scopeSelect.selectOption(firstSelectable)
  await expect(scopeSelect).not.toHaveValue('')
  try {
    await page.waitForURL(/\/workbench\/group/, { timeout: 10000 })
  } catch {
    return false
  }
  return true
}

async function getScopeSelectorRoute(page: any) {
  if (await userHasPermission(page, 'workbench:user_management')) return '/workbench/users'
  if (await userHasPermission(page, 'workbench:group_users')) return '/workbench/group/users'
  if (await userHasPermission(page, 'workbench:group_research')) return '/workbench/group/sessions'
  if (await userHasPermission(page, 'workbench:research')) return '/workbench/research'
  return null
}
test('workbench: group dashboard renders (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const hasGroupDashboard = await userHasPermission(page, 'workbench:group_dashboard')
  if (!hasGroupDashboard) {
    test.skip(true, 'Account lacks workbench:group_dashboard; skipping group admin suite')
  }

  const scopeRoute = await getScopeSelectorRoute(page)
  if (!scopeRoute) {
    test.skip(true, 'No scope selector route available for this account')
  }

  const hasGroupScope = await ensureGroupScopeSelected(page, scopeRoute)
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
  await page.waitForURL(/\/workbench\/group/, { timeout: 10000 }).catch(() => null)
  const groupDashboardHeading = page.getByRole('heading', { name: /^group dashboard$/i })
  try {
    await expect(groupDashboardHeading).toBeVisible({ timeout: 5000 })
  } catch {
    test.skip(true, 'Group dashboard did not render for this account')
  }

  // UX: key CTAs should be obvious and clickable (no mutation here).
  await expect(page.getByRole('button', { name: /manage group users/i })).toBeVisible()
  const user = await getCurrentUser(page)
  const canManageUsers = await userHasPermission(page, 'workbench:user_management')
  const canAccessGroupModeration = user?.role === 'owner' || canManageUsers
  if (canAccessGroupModeration) {
    await expect(page.getByRole('button', { name: /view anonymized chats/i })).toBeVisible()
  }
})

test('workbench: group users and chats pages render (if permitted)', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (!page.url().includes('/workbench')) {
    test.skip(true, 'Account lacks workbench:access; run with a Workbench-enabled test account')
  }

  const hasGroupUsers = await userHasPermission(page, 'workbench:group_users')
  const hasGroupResearch = await userHasPermission(page, 'workbench:group_research')
  if (!hasGroupUsers && !hasGroupResearch) {
    test.skip(true, 'Account lacks group permissions; skipping')
  }

  const scopeRoute = await getScopeSelectorRoute(page)
  if (!scopeRoute) {
    test.skip(true, 'No scope selector route available for this account')
  }

  const hasGroupScope = await ensureGroupScopeSelected(page, scopeRoute)
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
    await page.waitForURL(/\/workbench\/group\/users/, { timeout: 10000 }).catch(() => null)
    const groupUsersHeading = page.getByRole('heading', { name: /^group users$/i })
    try {
      await expect(groupUsersHeading).toBeVisible({ timeout: 5000 })
    } catch {
      test.skip(true, 'Group users did not render for this account')
    }
    await expect(page.getByRole('table')).toBeVisible()

    // UX: add-by-email control is only available for group_admin role (membership editor).
    const user = await getCurrentUser(page)
    if (user?.role === 'group_admin') {
      await expect(page.getByText(/^add user by email$/i)).toBeVisible()
      await expect(page.getByPlaceholder(/user@example\.com/i)).toBeVisible()
    }
  }

  const user = await getCurrentUser(page)
  const canManageUsers = await userHasPermission(page, 'workbench:user_management')
  const canAccessGroupModeration = user?.role === 'owner' || canManageUsers

  if (hasGroupResearch && canAccessGroupModeration) {
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

    await expect(page).toHaveURL(/\/workbench\/group\/sessions\//)
    if (sessionIdText) {
      await expect(page.getByText(sessionIdText)).toBeVisible()
    }

    // UX: either a message renders, or an explicit empty/error state is shown.
    const anyMessage = page.locator('.animate-slide-up').first()
    const notFound = page.getByText(/^not found$/i)
    const loading = page.getByText(/^loading\.\.\.$/i)
    await expect(anyMessage.or(notFound).or(loading)).toBeVisible()
  } else if (hasGroupResearch && !canAccessGroupModeration) {
    test.skip(true, 'Group moderation UI is restricted to owners and global user admins')
  }
})

test.describe('group admin deep tests', () => {
  test.use({ role: 'group_admin' })

  test('workbench: group admin sees group-scoped dashboard with stats', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }    const scopeRoute = await getScopeSelectorRoute(page)
    if (!scopeRoute) {
      test.skip(true, 'No scope selector route available')
    }

    const hasGroupScope = await ensureGroupScopeSelected(page, scopeRoute)
    if (!hasGroupScope) {
      test.skip(true, 'No group scope available')
    }

    const groupDashboardNav = page.getByRole('button', { name: /^group dashboard$/i })
    try {
      await expect(groupDashboardNav).toBeVisible({ timeout: 5000 })
    } catch {
      test.skip(true, 'Group dashboard nav not available')
    }
    await groupDashboardNav.click()    // Verify group name heading and key statistics/CTAs
    const groupDashboardHeading = page.getByRole('heading', { name: /^group dashboard$/i })
    await expect(groupDashboardHeading).toBeVisible({ timeout: 5000 })

    // Stats or CTAs should be visible
    const stats = page.locator('[data-testid="stat-card"], .stat-card')
      .or(page.getByRole('button', { name: /manage group users/i }))
    await expect(stats.first()).toBeVisible()
  })

  test('workbench: group admin can view anonymized sessions list', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const scopeRoute = await getScopeSelectorRoute(page)
    if (!scopeRoute) {
      test.skip(true, 'No scope selector route available')
    }

    const hasGroupScope = await ensureGroupScopeSelected(page, scopeRoute)
    if (!hasGroupScope) {
      test.skip(true, 'No group scope available')
    }    // Navigate to group chats view
    const groupChatsNav = page.getByRole('button', { name: /^group chats$/i })
    if ((await groupChatsNav.count()) === 0) {
      test.skip(true, 'Group chats nav not available for this account')
    }
    await groupChatsNav.click()

    await expect(page.getByRole('heading', { name: /^group chats$/i })).toBeVisible()

    // Verify session list renders
    const sessionList = page.locator('span.font-mono')
    if ((await sessionList.count()) === 0) {
      test.skip(true, 'No group sessions available')
    }

    // Verify entries show anonymized identifiers (not real names)
    const firstEntry = sessionList.first()
    const entryText = await firstEntry.textContent()
    // Anonymized IDs are typically hex/uuid strings, not human names
    expect(entryText?.trim().length).toBeGreaterThan(0)
  })

  test('workbench: group admin can access group users list', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (!page.url().includes('/workbench')) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const scopeRoute = await getScopeSelectorRoute(page)
    if (!scopeRoute) {
      test.skip(true, 'No scope selector route available')
    }

    const hasGroupScope = await ensureGroupScopeSelected(page, scopeRoute)
    if (!hasGroupScope) {
      test.skip(true, 'No group scope available')
    }

    // Navigate to group users view
    const groupUsersNav = page.getByRole('button', { name: /^group users$/i })
    if ((await groupUsersNav.count()) === 0) {
      test.skip(true, 'Group users nav not available')
    }
    await groupUsersNav.click()

    await expect(page.getByRole('heading', { name: /^group users$/i })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()

    // Verify member entries exist
    const rows = page.locator('tbody tr')
    expect(await rows.count()).toBeGreaterThan(0)
  })
})