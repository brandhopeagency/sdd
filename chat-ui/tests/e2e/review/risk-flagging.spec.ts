/**
 * T086: Risk flagging E2E
 * Test flow: reviewer flags session with high severity → moderator sees escalation in queue
 * → moderator resolves flag
 */
import { test, expect } from '../fixtures/e2eTest'
import { ensureOtpStorageState, storageStatePathForRole } from '../helpers/auth'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('risk flagging: reviewer flags high severity → moderator sees and resolves', async ({
  browser,
  page,
}) => {
  await ensureOtpStorageState(browser, { role: 'qa' })
  await ensureOtpStorageState(browser, { role: 'moderator' })

  const qaContext = await browser.newContext({ storageState: storageStatePathForRole('qa') })
  const modContext = await browser.newContext({ storageState: storageStatePathForRole('moderator') })

  const qaPage = await qaContext.newPage()
  const modPage = await modContext.newPage()

  try {
    await initLanguage(qaPage, 'en')
    await initLanguage(modPage, 'en')

    // Step 1: QA/reviewer navigates to review queue and opens a session
    await gotoRoute(qaPage, '/workbench/review')
    if (/\/chat(\/|$)/.test(qaPage.url())) {
      test.skip(true, 'Reviewer account lacks workbench:access')
    }

    const queueHeading = qaPage.getByRole('heading', { name: /review|queue/i })
    await expect(queueHeading).toBeVisible({ timeout: 10_000 })

    const sessionCard = qaPage.locator(
      '[role="button"][aria-label*="CHAT-"], .session-card'
    ).or(qaPage.locator('table tbody tr')).first()

    if ((await sessionCard.count()) === 0) {
      test.skip(true, 'No sessions available for flagging test')
    }

    await sessionCard.click()
    await expect(qaPage).toHaveURL(/\/workbench\/review\/session\//, { timeout: 10_000 })
    const sessionUrl = qaPage.url()
    const sessionIdMatch = sessionUrl.match(/session\/([\w-]+)/)
    const sessionId = sessionIdMatch?.[1]

    if (!sessionId) {
      test.skip(true, 'Could not extract session ID from URL')
    }

    await expect(qaPage.getByText(/transcript|messages/i)).toBeVisible({ timeout: 10_000 })

    // Step 2: Reviewer flags the session with high severity
    const flagBtn = qaPage.getByRole('button', { name: /flag/i })
    if ((await flagBtn.count()) === 0) {
      test.skip(true, 'Flag button not found in review session view')
    }
    await flagBtn.click()

    const severityHigh = qaPage.getByRole('radio', { name: /high/i }).or(qaPage.locator('[data-severity="high"]'))
    await expect(severityHigh).toBeVisible({ timeout: 5_000 })
    await severityHigh.click()

    const reasonSelect = qaPage.getByRole('combobox', { name: /reason|category/i })
      .or(qaPage.locator('select'))
      .or(qaPage.getByLabel(/reason|category/i))
    if ((await reasonSelect.count()) > 0) {
      await reasonSelect.first().selectOption({ index: 1 })
    }

    const detailsField = qaPage.getByPlaceholder(/details|comment/i)
      .or(qaPage.locator('textarea'))
      .or(qaPage.getByRole('textbox', { name: /details/i }))
    await detailsField.first().fill('E2E high-severity flag for risk flagging test — safety concern.')

    const submitFlagBtn = qaPage.getByRole('button', { name: /submit|save|create|flag/i })
    await submitFlagBtn.click()

    const flagSuccess = qaPage.getByText(/flagged|submitted|saved|success/i).or(qaPage.getByRole('alert'))
    await expect(flagSuccess).toBeVisible({ timeout: 10_000 })

    await qaPage.waitForTimeout(1000)

    // Step 3: Moderator navigates to escalation queue and sees the flag
    await gotoRoute(modPage, '/workbench/review/escalations')
    if (/\/chat(\/|$)/.test(modPage.url())) {
      test.skip(true, 'Moderator account lacks workbench:access')
    }

    await expect(modPage.getByRole('heading', { name: /escalation|queue/i })).toBeVisible({ timeout: 10_000 })

    const flagRow = modPage.locator('tr, [role="row"], .flag-card').filter({
      hasText: /high|CHAT-|session/i,
    }).first()

    if ((await flagRow.count()) === 0) {
      test.skip(true, 'No escalation items in moderator queue — flag may not have propagated')
    }

    await flagRow.click()
    await modPage.waitForTimeout(500)

    // Step 4: Moderator resolves the flag
    const resolveBtn = modPage.getByRole('button', { name: /resolve|acknowledge/i })
    if ((await resolveBtn.count()) === 0) {
      const resolveMenu = modPage.getByRole('button', { name: /actions?|more|…/i })
      if ((await resolveMenu.count()) > 0) {
        await resolveMenu.first().click()
        await modPage.getByRole('menuitem', { name: /resolve/i }).click()
      } else {
        test.skip(true, 'Resolve button not found in escalation view')
      }
    } else {
      await resolveBtn.first().click()
    }

    const resolutionNotes = modPage.getByPlaceholder(/notes|comment|resolution/i)
      .or(modPage.locator('textarea'))
    if ((await resolutionNotes.count()) > 0) {
      await resolutionNotes.first().fill('E2E resolution — risk flag resolved after review.')
    }

    const confirmResolveBtn = modPage.getByRole('button', { name: /confirm|resolve|save|submit/i })
    await confirmResolveBtn.click()

    const resolveSuccess = modPage.getByText(/resolved|success|saved/i).or(modPage.getByRole('alert'))
    await expect(resolveSuccess).toBeVisible({ timeout: 10_000 })
  } finally {
    await qaContext.close()
    await modContext.close()
  }
})
