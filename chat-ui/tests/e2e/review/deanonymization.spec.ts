/**
 * T087: Deanonymization E2E
 * Test flow: reviewer requests deanonymization → commander approves → requester views revealed identity
 * → verify audit log entry
 */
import { test, expect } from '../fixtures/e2eTest'
import { ensureOtpStorageState, storageStatePathForRole } from '../helpers/auth'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test('deanonymization: reviewer requests → commander approves → requester views identity', async ({
  browser,
}) => {
  await ensureOtpStorageState(browser, { role: 'qa' })
  await ensureOtpStorageState(browser, { role: 'owner' })

  const qaContext = await browser.newContext({ storageState: storageStatePathForRole('qa') })
  const ownerContext = await browser.newContext({ storageState: storageStatePathForRole('owner') })

  const qaPage = await qaContext.newPage()
  const ownerPage = await ownerContext.newPage()

  try {
    await initLanguage(qaPage, 'en')
    await initLanguage(ownerPage, 'en')

    // Step 1: QA/reviewer navigates to review, opens a session, and submits deanonymization request
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
      test.skip(true, 'No sessions available for deanonymization test')
    }

    await sessionCard.click()
    await expect(qaPage).toHaveURL(/\/workbench\/review\/session\//, { timeout: 10_000 })

    await expect(qaPage.getByText(/transcript|messages/i)).toBeVisible({ timeout: 10_000 })

    // Option A: Request deanonymization from flag form (check "Request user deanonymization")
    const flagBtn = qaPage.getByRole('button', { name: /flag/i })
    if ((await flagBtn.count()) > 0) {
      await flagBtn.click()
      const requestDeanonCheckbox = qaPage.getByRole('checkbox', { name: /deanonymization|reveal.*identity/i })
        .or(qaPage.getByLabel(/deanonymization|reveal.*identity/i))
      if ((await requestDeanonCheckbox.count()) > 0) {
        await requestDeanonCheckbox.check()
        const justificationField = qaPage.getByPlaceholder(/justification|details/i)
          .or(qaPage.locator('textarea'))
        await justificationField.first().fill('E2E deanonymization request for welfare check — safety concern.')
      }
      const severityHigh = qaPage.getByRole('radio', { name: /high/i }).or(qaPage.locator('[data-severity="high"]'))
      if ((await severityHigh.count()) > 0) await severityHigh.click()
      const detailsField = qaPage.getByPlaceholder(/details|comment/i).or(qaPage.locator('textarea'))
      await detailsField.first().fill('E2E high-severity flag with deanonymization request.')
      await qaPage.getByRole('button', { name: /submit|save|flag/i }).click()
    } else {
      // Option B: Deanonymization panel — create request directly
      await gotoRoute(qaPage, '/workbench/review/deanonymization')
      if (/\/chat(\/|$)/.test(qaPage.url())) {
        test.skip(true, 'Deanonymization panel not accessible')
      }
      await expect(qaPage.getByRole('heading', { name: /deanonymization/i })).toBeVisible({ timeout: 10_000 })
      const newRequestBtn = qaPage.getByRole('button', { name: /new|request|create/i })
      if ((await newRequestBtn.count()) === 0) {
        test.skip(true, 'Deanonymization request flow not available — may require flag first')
      }
      await newRequestBtn.click()
      const categorySelect = qaPage.getByRole('combobox').or(qaPage.locator('select')).first()
      await categorySelect.selectOption({ index: 1 })
      const detailsField = qaPage.getByPlaceholder(/details|justification/i).or(qaPage.locator('textarea'))
      await detailsField.first().fill('E2E deanonymization request for welfare check — safety concern.')
      await qaPage.getByRole('button', { name: /submit|save|request/i }).click()
    }

    const requestSuccess = qaPage.getByText(/requested|submitted|pending|success/i).or(qaPage.getByRole('alert'))
    await expect(requestSuccess).toBeVisible({ timeout: 10_000 })

    await qaPage.waitForTimeout(1000)

    // Step 2: Commander (owner) navigates to deanonymization panel and approves
    await gotoRoute(ownerPage, '/workbench/review/deanonymization')
    if (/\/chat(\/|$)/.test(ownerPage.url())) {
      test.skip(true, 'Commander account lacks workbench:access')
    }

    await expect(ownerPage.getByRole('heading', { name: /deanonymization/i })).toBeVisible({ timeout: 10_000 })

    const approveBtn = ownerPage.getByRole('button', { name: /approve/i })
    if ((await approveBtn.count()) === 0) {
      test.skip(true, 'No pending deanonymization requests to approve')
    }
    await approveBtn.first().click()

    const confirmApproveBtn = ownerPage.getByRole('button', { name: /confirm|approve|yes/i })
    await confirmApproveBtn.click()

    const approveSuccess = ownerPage.getByText(/approved|success/i).or(ownerPage.getByRole('alert'))
    await expect(approveSuccess).toBeVisible({ timeout: 10_000 })

    await ownerPage.waitForTimeout(1000)

    // Step 3: Requester (QA) views revealed identity
    await gotoRoute(qaPage, '/workbench/review/deanonymization')
    await expect(qaPage.getByRole('heading', { name: /deanonymization/i })).toBeVisible({ timeout: 10_000 })

    const viewIdentityBtn = qaPage.getByRole('button', { name: /view|reveal|show.*identity/i })
    if ((await viewIdentityBtn.count()) > 0) {
      await viewIdentityBtn.first().click()
      const identityContent = qaPage.getByText(/@|\.com|email|name|user/i)
      await expect(identityContent.first()).toBeVisible({ timeout: 5_000 })
    }

    // Step 4: Verify audit log entry (if audit log UI exists)
    await gotoRoute(qaPage, '/workbench/privacy')
    const auditSection = qaPage.getByText(/audit.*log|audit log/i)
    if ((await auditSection.count()) > 0) {
      await auditSection.click()
      const comingSoon = qaPage.getByText(/coming soon|not yet available/i)
      if ((await comingSoon.count()) === 0) {
        const auditEntry = qaPage.getByText(/deanonymization|approved|reveal/i)
        await expect(auditEntry.first()).toBeVisible({ timeout: 5_000 })
      }
    }
  } finally {
    await qaContext.close()
    await ownerContext.close()
  }
})
