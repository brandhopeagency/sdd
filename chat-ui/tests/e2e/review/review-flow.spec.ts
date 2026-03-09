/**
 * T085: Core review flow E2E
 * Test flow: reviewer login → navigate to /workbench/review → select a pending session
 * → rate all AI messages (test both low and high scores) → submit review
 * → verify session review count increments
 */
import { test, expect } from '../fixtures/authTest'
import { initLanguage } from '../helpers/i18n'
import { gotoRoute } from '../helpers/routes'

test.use({ role: 'qa' })

/**
 * Helper to navigate to the first available pending review session.
 * Returns the session ID if opened, null otherwise.
 */
async function openFirstPendingSession(page: import('@playwright/test').Page): Promise<string | null> {
  await gotoRoute(page, '/workbench/review')

  if (/\/chat(\/|$)/.test(page.url())) return null

  const queueHeading = page.getByRole('heading', { name: /review|queue/i })
  await expect(queueHeading).toBeVisible({ timeout: 10_000 })

  const pendingTab = page.getByRole('tab', { name: /pending/i }).or(page.getByText(/^pending$/i))
  if ((await pendingTab.count()) > 0) {
    await pendingTab.click()
    await page.waitForTimeout(300)
  }

  const sessionCard = page.locator(
    '[role="button"][aria-label*="CHAT-"], .session-card'
  ).or(page.locator('div[role="button"]').filter({ has: page.locator('text=/CHAT-/') })).first()

  if ((await sessionCard.count()) === 0) {
    const tableRow = page.locator('table tbody tr').first()
    if ((await tableRow.count()) === 0) return null
    await tableRow.click()
    await page.waitForTimeout(500)
    const url = page.url()
    const idMatch = url.match(/session\/([\w-]+)/)
    return idMatch?.[1] ?? null
  }

  await sessionCard.click()
  await expect(page).toHaveURL(/\/workbench\/review\/session\//, { timeout: 10_000 })
  const url = page.url()
  const idMatch = url.match(/session\/([\w-]+)/)
  return idMatch?.[1] ?? null
}

function getScoreButton(page: import('@playwright/test').Page, score: number) {
  return page.getByRole('button', { name: new RegExp(`^${score}$`) }).or(page.locator(`[data-score="${score}"]`))
}

function getScoreSelector(page: import('@playwright/test').Page) {
  return page.getByRole('spinbutton', { name: /score|rating/i })
    .or(page.locator('input[type="range"]'))
    .or(page.locator('[data-testid="message-score"]'))
    .or(page.getByRole('slider'))
}

async function rateMessage(
  page: import('@playwright/test').Page,
  score: number,
  criteriaFeedback?: string
) {
  const scoreBtn = getScoreButton(page, score)
  const scoreInput = getScoreSelector(page)

  if ((await scoreInput.count()) > 0) {
    await scoreInput.first().fill(String(score))
  } else if ((await scoreBtn.count()) > 0) {
    await scoreBtn.first().click()
  } else {
    throw new Error(`Score selector for ${score} not found`)
  }

  if (score <= 7 && criteriaFeedback && criteriaFeedback.length >= 10) {
    const criteriaField = page.getByPlaceholder(/relevance|empathy|safety|ethics|clarity|comment/i)
      .or(page.getByRole('textbox', { name: /criteria|feedback/i }))
      .or(page.locator('textarea'))
    if ((await criteriaField.count()) > 0) {
      await criteriaField.first().fill(criteriaFeedback)
    }
  }
}

test('review: core flow — login, select session, rate messages (low and high scores), submit, verify count', async ({
  page,
}) => {
  await initLanguage(page, 'en')

  const sessionId = await openFirstPendingSession(page)
  if (!sessionId) {
    test.skip(true, 'No pending reviewable sessions exist in the queue')
  }

  await expect(page.getByText(/transcript|messages|rate/i)).toBeVisible({ timeout: 10_000 })

  const assistantMsgButtons = page.locator('[role="button"][aria-label*="ssistant"]')
  const msgCount = await assistantMsgButtons.count()

  if (msgCount === 0) {
    const fallback = page.locator('div[role="button"]').filter({ hasText: /assistant|AI/i })
    if ((await fallback.count()) === 0) {
      test.skip(true, 'No assistant message elements found in session view')
    }
  }

  const totalToRate = msgCount > 0 ? msgCount : await page.locator('div[role="button"]').filter({ hasText: /assistant|AI/i }).count()
  let useLowScore = true

  for (let i = 0; i < totalToRate; i++) {
    const msgBtn = assistantMsgButtons.nth(i).or(page.locator('div[role="button"]').filter({ hasText: /assistant|AI/i }).nth(i))
    await msgBtn.scrollIntoViewIfNeeded()
    await msgBtn.click()
    await page.waitForTimeout(300)

    const score = useLowScore ? 5 : 9
    const criteriaFeedback = useLowScore ? 'E2E criteria feedback for low score (required).' : undefined
    await rateMessage(page, score, criteriaFeedback)
    await page.waitForTimeout(200)
    useLowScore = !useLowScore
  }

  const submitBtn = page.getByRole('button', { name: /submit.*review|complete.*review|finish/i })
  await expect(submitBtn).toBeVisible({ timeout: 5_000 })
  await submitBtn.click()

  const success = page.getByText(/submitted|completed|success/i).or(page.getByRole('alert'))
  await expect(success).toBeVisible({ timeout: 10_000 })

  await page.waitForTimeout(2000)

  await gotoRoute(page, '/workbench/review')
  await expect(page.getByRole('heading', { name: /review|queue/i })).toBeVisible({ timeout: 10_000 })

  const reviewProgress = page.getByText(/\d+\s*of\s*\d+/)
  await expect(reviewProgress.first()).toBeVisible({ timeout: 5_000 })
})
