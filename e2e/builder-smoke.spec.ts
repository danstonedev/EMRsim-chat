import { test, expect } from '@playwright/test'

/**
 * Case Builder smoke test
 * - Navigates to /builder
 * - Verifies header and main layout render
 * - Confirms primary scroll container exists and is scrollable
 * - Opens the Generate Scenario modal and closes it
 */

// Legacy Case Builder route was removed; skip this suite to avoid failures.
test.describe.skip('Case Builder smoke (removed)', () => {
  test('renders and scrolls', async ({ page }) => {
    await page.goto('/builder')

    // Header present
    const header = page.locator('header.header.app-nav')
    await expect(header).toBeVisible()

    // Case Builder title visible
    await expect(page.locator('.casebuilder-hero-title', { hasText: 'Case Builder' })).toBeVisible()

    // Main layout present
    const main = page.locator('main.casebuilder-layout')
    await expect(main).toBeVisible()

    // Ensure scrollable: artificially set big content via JS if needed and attempt scroll
    // But first, check computed scrollHeight > clientHeight (tolerate small pages)
    const hasScroll = await main.evaluate((el) => el.scrollHeight > el.clientHeight)
    if (!hasScroll) {
      // Try scrolling just in case; shouldn't throw
      await main.evaluate((el) => { el.scrollTop = 0; el.scrollTop = 9999 })
    }

    // Toolbar and Generate button visible
    await expect(page.locator('.cb-toolbar')).toBeVisible()
    const genBtn = page.locator('button.cb-btn.cb-btn-primary', { hasText: 'Generate New Scenario' })
    await expect(genBtn).toBeVisible()

    // Open and close modal
    await genBtn.click()
    const modal = page.locator('.cb-modal')
    await expect(modal).toBeVisible()

    // Close via overlay click or close button
    const closeBtn = page.locator('.cb-modal-close')
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    } else {
      await page.locator('.cb-modal-overlay').click({ position: { x: 10, y: 10 } })
    }

    await expect(modal).toBeHidden({ timeout: 5000 })
  })
})
