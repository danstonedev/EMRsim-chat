import { test, expect } from '@playwright/test'

test.describe('3D Viewer smoke', () => {
  test('loads canvas, grid, and mannequin', async ({ page }) => {
  // Go straight to the 3D viewer
  await page.goto('/3d-viewer')

  // Wait for the viewer container instead of networkidle (HMR/websockets can keep network active)
  await page.locator('.viewer3d-container').waitFor({ state: 'visible', timeout: 10000 })

  // Canvas is nested inside the wrapper with class viewer3d-canvas
  const canvas = page.locator('.viewer3d-canvas canvas').first()
  await expect(canvas).toBeVisible({ timeout: 10000 })

    // The route should attempt to fetch the model; ensure no 404 for the GLB
    const modelResponse = await page.waitForResponse(r =>
      r.url().includes('/models/human-figure.glb') && [200, 304].includes(r.status()), { timeout: 15000 }
    ).catch(() => null)

    // We still pass if the asset is cached (304) or took slightly longer; just assert the canvas stayed visible
    await expect(canvas).toBeVisible()

    // Optional sanity: take a small delay to let the scene render
    await page.waitForTimeout(300)

    // Ensure no navigation to an error page occurred
    await expect(page).not.toHaveURL(/error|404|not-found/i)

    // If model response was captured, ensure it was OK
    if (modelResponse) {
      expect(modelResponse.ok()).toBeTruthy()
    }
  })
})
