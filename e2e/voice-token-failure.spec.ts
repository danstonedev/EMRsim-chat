import { test, expect } from '@playwright/test'

const allowCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

test.describe('Voice error handling', () => {
  test('shows helpful message when token fetch fails and allows retry', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream())
    })

    await page.route('**/api/health', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', ...allowCorsHeaders },
      body: JSON.stringify({
        ok: true,
        uptime_s: 123,
        db: 'ok',
        openai: 'ok',
        features: { voiceEnabled: true, spsEnabled: true, voiceDebug: false },
      }),
    }))

    await page.route('**/api/sps/personas', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', ...allowCorsHeaders },
      body: JSON.stringify({
        personas: [
          { id: 'persona-1', display_name: 'Test Persona', headline: 'Demo', tags: [] },
        ],
      }),
    }))

    await page.route('**/api/sps/scenarios', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', ...allowCorsHeaders },
      body: JSON.stringify({
        scenarios: [
          {
            scenario_id: 'scenario-1',
            title: 'Test Scenario',
            region: 'ND',
            setting: 'Clinic',
            difficulty: 'easy',
            persona_id: 'persona-1',
          },
        ],
      }),
    }))

    await page.route('**/api/sessions', route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: allowCorsHeaders })
      }
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', ...allowCorsHeaders },
        body: JSON.stringify({ session_id: 'session-1', phase: 'subjective' }),
      })
    })

    let tokenCalls = 0
    await page.route('**/api/voice/token', route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: allowCorsHeaders })
      }
      tokenCalls += 1
      return route.fulfill({
        status: 429,
        headers: { 'Content-Type': 'application/json', ...allowCorsHeaders },
        body: JSON.stringify({ message: 'Rate limit' }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const personaPanel = page.locator('.persona-panel').first()
    await personaPanel.getByLabel('Persona search').click()
    await personaPanel.locator('.persona-search__option').first().click()

    const scenarioPanel = page.locator('.scenario-panel')
    await scenarioPanel.getByLabel('Scenario search').click()
    await scenarioPanel.locator('.persona-search__option').first().click()

    await page.waitForResponse(response =>
      response.url().includes('/api/sessions') && response.request().method() === 'POST',
    )

    const startButton = page.getByRole('button', { name: 'Start voice chat' })
    await expect(startButton).toBeEnabled()

    await startButton.click()

    await expect.poll(() => tokenCalls, { message: 'Expected voice token request to fire' }).toBe(1)

    const errorBanner = page.locator('.voice-error-banner')
    await expect(errorBanner).toHaveText('Could not fetch a voice token. Check backend logs or retry shortly.')

    await expect(startButton).toBeEnabled()

    await startButton.click()
    await expect.poll(() => tokenCalls).toBe(2)
  })
})
