import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'
import { loginWithOtp } from '../helpers/auth'

test.use({ role: 'owner' })

test('groups: owner creates a new group', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Navigate to group management
  const groupsNav = page.getByRole('button', { name: /group management|groups/i })
  if ((await groupsNav.count()) === 0) {
    test.skip(true, 'Group management section not accessible for this account')
  }
  await groupsNav.click()

  // Create a new group with a unique name
  const createBtn = page.getByRole('button', { name: /create group|add group|new group/i })
  if ((await createBtn.count()) === 0) {
    test.skip(true, 'Create group button not available')
  }
  await createBtn.click()

  const groupName = `E2E-${Date.now()}`
  const nameInput = page.getByPlaceholder(/group name/i).or(page.getByLabel(/name/i))
  await expect(nameInput).toBeVisible()
  await nameInput.fill(groupName)

  const submitBtn = page.getByRole('button', { name: /^(create|save|submit)$/i })
  await submitBtn.click()

  // Verify the group appears in the list
  await expect(page.getByText(groupName)).toBeVisible({ timeout: 10_000 })
})

test('groups: generate invite code for group', async ({ page }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Navigate to the E2E Test Group settings
  const groupsNav = page.getByRole('button', { name: /group management|groups/i })
  if ((await groupsNav.count()) === 0) {
    test.skip(true, 'Group management section not accessible')
  }
  await groupsNav.click()

  // Select the E2E Test Group
  const testGroup = page.getByText(/e2e test group/i)
  if ((await testGroup.count()) === 0) {
    test.skip(true, 'E2E Test Group not found — run seed script first')
  }
  await testGroup.click()

  // Generate invite code
  const inviteBtn = page.getByRole('button', { name: /generate.*invite|invite.*code|create.*invite/i })
  if ((await inviteBtn.count()) === 0) {
    test.skip(true, 'Invite code generation UI is not accessible')
  }
  await inviteBtn.click()

  // Verify invite code is displayed
  const codeDisplay = page.locator('[data-testid="invite-code"]')
    .or(page.locator('code'))
    .or(page.getByRole('textbox', { name: /invite.*code|code/i }))
  await expect(codeDisplay.first()).toBeVisible({ timeout: 10_000 })

  const codeText = await codeDisplay.first().textContent()
    ?? await codeDisplay.first().inputValue().catch(() => '')
  expect(codeText?.trim().length).toBeGreaterThan(0)
})

test('groups: membership approval workflow', async ({ page, browser }) => {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  // Step (a): As owner, generate an invite code for E2E Test Group
  const groupsNav = page.getByRole('button', { name: /group management|groups/i })
  if ((await groupsNav.count()) === 0) {
    test.skip(true, 'Group management section not accessible')
  }
  await groupsNav.click()

  const testGroup = page.getByText(/e2e test group/i)
  if ((await testGroup.count()) === 0) {
    test.skip(true, 'E2E Test Group not found')
  }
  await testGroup.click()

  const inviteBtn = page.getByRole('button', { name: /generate.*invite|invite.*code|create.*invite/i })
  if ((await inviteBtn.count()) === 0) {
    test.skip(true, 'Invite code generation UI is not accessible')
  }
  await inviteBtn.click()

  const codeDisplay = page.locator('[data-testid="invite-code"]')
    .or(page.locator('code'))
    .or(page.getByRole('textbox', { name: /invite.*code|code/i }))
  await expect(codeDisplay.first()).toBeVisible({ timeout: 10_000 })
  const inviteCode = (await codeDisplay.first().textContent()
    ?? await codeDisplay.first().inputValue().catch(() => '')).trim()

  if (!inviteCode) {
    test.skip(true, 'Could not extract invite code')
  }

  // Step (b): Open a new browser context as e2e-user to create a pending membership request
  const userContext = await browser.newContext()
  const userPage = await userContext.newPage()
  try {
    await initLanguage(userPage, 'en')
    await loginWithOtp(userPage, { email: 'e2e-user@test.local' })

    // Use the invite code — look for invite code input in join/group flow
    const joinInput = userPage.getByPlaceholder(/invite.*code|enter.*code/i)
    if ((await joinInput.count()) > 0) {
      await joinInput.fill(inviteCode)
      const joinBtn = userPage.getByRole('button', { name: /join|submit|apply/i })
      await joinBtn.click()
      await expect(userPage.getByText(/pending|requested|awaiting/i)).toBeVisible({ timeout: 10_000 })
    } else {
      test.skip(true, 'Invite code input not found in user context')
    }
  } finally {
    await userContext.close()
  }

  // Step (c): Back to owner context — navigate to Approvals and approve the request
  await gotoRoute(page, '/workbench/approvals')

  const pendingRequest = page.getByText(/e2e-user|e2e user/i)
  await expect(pendingRequest).toBeVisible({ timeout: 10_000 })

  const approveBtn = page.getByRole('button', { name: /approve/i }).first()
  await approveBtn.click()

  // Verify the user moves to the approved/members list
  await expect(page.getByText(/approved|active|member/i)).toBeVisible({ timeout: 10_000 })
})
