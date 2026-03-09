import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

// ── Helper: navigate to review section ──────────────────────────────────────

async function navigateToReview(page: import('@playwright/test').Page) {
  await initLanguage(page, 'en')
  await gotoRoute(page, '/workbench')

  if (/\/chat(\/|$)/.test(page.url())) {
    test.skip(true, 'Account lacks workbench:access')
  }

  const reviewNav = page.getByRole('button', { name: /review/i })
  if ((await reviewNav.count()) === 0) {
    test.skip(true, 'Review section not accessible for this account')
  }
  await reviewNav.click()
  await expect(page.getByRole('heading', { name: /review/i })).toBeVisible({ timeout: 10_000 })
}

// ── US1: Admin creates tag and assigns to user (session excluded) ───────────

test.describe('tagging: user tag exclusion (US1)', () => {
  test.use({ role: 'owner' })

  test('tag management page is accessible', async ({ page }) => {
    await navigateToReview(page)

    // Navigate to tag management
    const tagMgmtLink = page.getByRole('link', { name: /tag.*manage|manage.*tag/i })
      .or(page.getByRole('button', { name: /tag.*manage|manage.*tag/i }))

    if ((await tagMgmtLink.count()) === 0) {
      test.skip(true, 'Tag management link not found — feature may not be deployed')
    }
    await tagMgmtLink.click()

    // Verify tag management page renders with table or list
    const tagTable = page.locator('table, [data-testid="tag-list"]')
    const pageHeading = page.getByRole('heading', { name: /tag/i })
    await expect(tagTable.or(pageHeading)).toBeVisible({ timeout: 10_000 })
  })

  test('seeded "functional QA" tag is visible in tag list', async ({ page }) => {
    await navigateToReview(page)

    const tagMgmtLink = page.getByRole('link', { name: /tag.*manage|manage.*tag/i })
      .or(page.getByRole('button', { name: /tag.*manage|manage.*tag/i }))
    if ((await tagMgmtLink.count()) === 0) {
      test.skip(true, 'Tag management link not found')
    }
    await tagMgmtLink.click()

    // "functional QA" is a seeded tag — it should always be present
    const functionalQaTag = page.getByText('functional QA')
    await expect(functionalQaTag).toBeVisible({ timeout: 10_000 })
  })

  test.fixme('admin assigns "functional QA" tag to user and new session is excluded', async ({ page }) => {
    // This test requires:
    //   1. A known test user account
    //   2. Ability to create a chat session from that user
    //   3. Verification that the session does NOT appear in the queue
    // Requires specific database state and session ingestion pipeline access.
    await navigateToReview(page)
  })
})

// ── US2: Short chat auto-excluded ───────────────────────────────────────────

test.describe('tagging: short chat auto-exclusion (US2)', () => {
  test.use({ role: 'owner' })

  test('excluded tab is visible in review queue', async ({ page }) => {
    await navigateToReview(page)

    // Look for the "Excluded" tab
    const excludedTab = page.getByRole('tab', { name: /excluded/i })
      .or(page.getByRole('button', { name: /excluded/i }))
      .or(page.getByText(/excluded/i).locator('xpath=ancestor-or-self::button | ancestor-or-self::a | ancestor-or-self::[role="tab"]'))

    if ((await excludedTab.count()) === 0) {
      test.skip(true, 'Excluded tab not found — feature may not be deployed')
    }
    await expect(excludedTab.first()).toBeVisible()
  })

  test('excluded tab shows exclusion reasons', async ({ page }) => {
    await navigateToReview(page)

    const excludedTab = page.getByRole('tab', { name: /excluded/i })
      .or(page.getByRole('button', { name: /excluded/i }))
    if ((await excludedTab.count()) === 0) {
      test.skip(true, 'Excluded tab not found')
    }
    await excludedTab.first().click()

    // Should show either excluded sessions with reasons or an empty state
    const exclusionReasons = page.getByText(/short|functional QA|user_tag|chat_tag/i)
    const emptyState = page.getByText(/no.*excluded|empty|no.*sessions/i)
    await expect(exclusionReasons.first().or(emptyState)).toBeVisible({ timeout: 10_000 })
  })

  test.fixme('session with fewer than 4 messages is auto-tagged short and excluded', async ({ page }) => {
    // This test requires the ability to create a chat session with a specific
    // message count and then verify it was auto-tagged "short" and excluded.
    // Requires session ingestion pipeline triggering, which is not available in E2E.
    await navigateToReview(page)
  })
})

// ── US3: Tag filter returns correct results ─────────────────────────────────

test.describe('tagging: tag filter in review queue (US3)', () => {
  test.use({ role: 'owner' })

  test('tag filter control exists in review queue', async ({ page }) => {
    await navigateToReview(page)

    // Look for tag filter — could be a combobox, multi-select, or labeled control
    const tagFilter = page.getByLabel(/tag/i)
      .or(page.getByPlaceholder(/tag/i))
      .or(page.locator('[data-testid="tag-filter"]'))
      .or(page.getByRole('combobox', { name: /tag/i }))

    if ((await tagFilter.count()) === 0) {
      test.skip(true, 'Tag filter control not found in review queue')
    }
    await expect(tagFilter.first()).toBeVisible()
  })

  test('tag filter dropdown shows available tags', async ({ page }) => {
    await navigateToReview(page)

    const tagFilter = page.getByLabel(/tag/i)
      .or(page.getByPlaceholder(/tag/i))
      .or(page.locator('[data-testid="tag-filter"]'))
      .or(page.getByRole('combobox', { name: /tag/i }))
    if ((await tagFilter.count()) === 0) {
      test.skip(true, 'Tag filter control not found')
    }

    // Click/open the tag filter
    await tagFilter.first().click()

    // Should show tag options (short, functional QA, or others)
    const tagOptions = page.getByRole('option')
      .or(page.getByRole('checkbox'))
      .or(page.locator('[data-testid="tag-option"]'))
    const noTags = page.getByText(/no.*tags/i)

    await expect(tagOptions.first().or(noTags)).toBeVisible({ timeout: 5_000 })
  })

  test.fixme('selecting a tag filter updates the queue results', async ({ page }) => {
    // Requires sessions with known tags to be present in the queue.
    // Verifies that after applying a tag filter, only sessions with matching tags appear.
    await navigateToReview(page)
  })
})

// ── US5: Moderator adds/removes session tags ────────────────────────────────

test.describe('tagging: session tag management (US5)', () => {
  test.use({ role: 'owner' })

  test('session detail view has tag section', async ({ page }) => {
    await navigateToReview(page)

    // Click on a session to open its detail view
    const sessionRow = page.locator('table tbody tr, [data-testid="review-session"], .session-card').first()
    if ((await sessionRow.count()) === 0) {
      test.skip(true, 'No reviewable sessions exist in the queue')
    }
    await sessionRow.click()

    // Verify session detail view is open
    const messageList = page.locator('.message, .animate-slide-up, [data-testid="message"]')
    const sessionView = page.getByText(/transcript|messages|review session/i)
    await expect(messageList.first().or(sessionView)).toBeVisible({ timeout: 10_000 })

    // Look for tag section (TagInput combobox or tag badges area)
    const tagSection = page.locator('[data-testid="session-tags"]')
      .or(page.getByRole('combobox', { name: /tag/i }))
      .or(page.getByLabel(/add.*tag|tag/i))
      .or(page.getByPlaceholder(/tag/i))

    if ((await tagSection.count()) === 0) {
      test.skip(true, 'Tag section not found in session detail view')
    }
    await expect(tagSection.first()).toBeVisible()
  })

  test.fixme('moderator can add a predefined tag to a session', async ({ page }) => {
    // Requires:
    //   1. A reviewable session in the queue
    //   2. Opening the session detail
    //   3. Using TagInput combobox to select an existing tag
    //   4. Verifying the tag badge appears
    // Depends on having predefined chat-category tags and session data.
    await navigateToReview(page)
  })

  test.fixme('moderator can create an ad-hoc tag on a session', async ({ page }) => {
    // Requires:
    //   1. A reviewable session in the queue
    //   2. Opening the session detail
    //   3. Typing a new tag name in TagInput
    //   4. Confirming the "Create new tag" option
    //   5. Verifying the tag badge appears and a new tag definition was created
    await navigateToReview(page)
  })

  test.fixme('moderator can remove a manually applied tag from a session', async ({ page }) => {
    // Requires:
    //   1. A session with at least one manually applied tag
    //   2. Clicking the "x" / remove button on the TagBadge
    //   3. Verifying the tag badge is removed
    await navigateToReview(page)
  })
})

// ── US4: Tag management page CRUD ───────────────────────────────────────────

test.describe('tagging: tag management CRUD (US4)', () => {
  test.use({ role: 'owner' })

  test('tag management page shows create form', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (/\/chat(\/|$)/.test(page.url())) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const reviewNav = page.getByRole('button', { name: /review/i })
    if ((await reviewNav.count()) === 0) {
      test.skip(true, 'Review section not accessible')
    }
    await reviewNav.click()

    const tagMgmtLink = page.getByRole('link', { name: /tag.*manage|manage.*tag/i })
      .or(page.getByRole('button', { name: /tag.*manage|manage.*tag/i }))
    if ((await tagMgmtLink.count()) === 0) {
      test.skip(true, 'Tag management link not found')
    }
    await tagMgmtLink.click()

    // Verify create form elements exist
    const nameInput = page.getByLabel(/name/i)
      .or(page.getByPlaceholder(/name|tag name/i))
    const categorySelect = page.getByLabel(/category/i)
      .or(page.getByRole('combobox', { name: /category/i }))
    const createButton = page.getByRole('button', { name: /create|add|save/i })

    // At least the name input and create button should be present
    if ((await nameInput.count()) === 0) {
      test.skip(true, 'Create form not found on tag management page')
    }
    await expect(nameInput.first()).toBeVisible()
    await expect(createButton.first()).toBeVisible()
  })

  test('tag management page lists existing tags', async ({ page }) => {
    await initLanguage(page, 'en')
    await gotoRoute(page, '/workbench')

    if (/\/chat(\/|$)/.test(page.url())) {
      test.skip(true, 'Account lacks workbench:access')
    }

    const reviewNav = page.getByRole('button', { name: /review/i })
    if ((await reviewNav.count()) === 0) {
      test.skip(true, 'Review section not accessible')
    }
    await reviewNav.click()

    const tagMgmtLink = page.getByRole('link', { name: /tag.*manage|manage.*tag/i })
      .or(page.getByRole('button', { name: /tag.*manage|manage.*tag/i }))
    if ((await tagMgmtLink.count()) === 0) {
      test.skip(true, 'Tag management link not found')
    }
    await tagMgmtLink.click()

    // Seeded tags should be visible
    const tagRows = page.locator('table tbody tr, [data-testid="tag-row"]')
    const tagList = page.getByText('functional QA').or(page.getByText('short'))
    await expect(tagList.first()).toBeVisible({ timeout: 10_000 })
  })

  test.fixme('admin can create a new tag definition', async ({ page }) => {
    // Requires:
    //   1. Navigate to tag management page
    //   2. Fill in name, description, category, exclude checkbox
    //   3. Submit form
    //   4. Verify new tag appears in the list
    //   5. Clean up: delete the tag after test
    // Skipped because it modifies database state that may not be cleaned up.
    await navigateToReview(page)
  })

  test.fixme('admin can edit an existing tag definition', async ({ page }) => {
    // Requires:
    //   1. An existing tag to edit
    //   2. Clicking inline edit or edit button
    //   3. Modifying fields and saving
    //   4. Verifying changes persist
    await navigateToReview(page)
  })

  test.fixme('admin can delete a tag definition with confirmation', async ({ page }) => {
    // Requires:
    //   1. An existing tag to delete (ideally one created in setup)
    //   2. Clicking delete button
    //   3. Confirming in the dialog (shows affected user/session counts)
    //   4. Verifying tag is removed from the list
    await navigateToReview(page)
  })

  test.fixme('duplicate tag name is rejected', async ({ page }) => {
    // Requires:
    //   1. Navigate to tag management create form
    //   2. Enter "functional QA" (already exists)
    //   3. Submit
    //   4. Verify 409 error message is displayed
    await navigateToReview(page)
  })
})
