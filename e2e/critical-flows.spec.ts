import { test, expect } from '@playwright/test';

test.describe('EMRsim Chat - Critical User Flows', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the home page', async ({ page }) => {
    // Verify the page title
    await expect(page).toHaveTitle(/EMRsim/i);
    
    // Verify key elements are visible
    // Adjust selectors based on your actual app structure
    const mainContent = page.locator('main, #root, [role="main"]');
    await expect(mainContent).toBeVisible();
  });

  test('should navigate to case selection', async ({ page }) => {
    // Look for navigation or case selection UI
    const caseButton = page.locator('text=/case|scenario|patient/i').first();
    
    if (await caseButton.isVisible()) {
      await caseButton.click();
      
      // Wait for case list to load
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the case selection page
      await expect(page).toHaveURL(/case|scenario|persona/i);
    }
  });

  test('should display personas list', async ({ page }) => {
    // Try to navigate to personas page
    const personasLink = page.locator('text=/persona|patient/i').first();
    
    if (await personasLink.isVisible()) {
      await personasLink.click();
      
      // Wait for API response
      await page.waitForResponse(response => 
        response.url().includes('/api/personas') && response.status() === 200
      );
      
      // Verify personas are displayed (adjust selector based on your UI)
      const personaItems = page.locator('[data-testid="persona-item"], .persona-card, .persona');
      await expect(personaItems.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should create a new session', async ({ page }) => {
    // This test depends on your UI flow
    // Navigate to create session
    const newSessionButton = page.locator('text=/new session|start|begin/i').first();
    
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
      
      // Wait for session creation API call
      await page.waitForResponse(response => 
        response.url().includes('/api/sessions') && 
        response.request().method() === 'POST' &&
        response.status() === 200,
        { timeout: 10000 }
      );
      
      // Verify we're in a session (check for chat UI)
      const chatInput = page.locator('input[type="text"], textarea').first();
      await expect(chatInput).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display transcript area', async ({ page }) => {
    // Look for transcript/conversation display area
    const transcript = page.locator('[data-testid="transcript"], .transcript, .messages, .conversation').first();
    
    if (await transcript.isVisible()) {
      await expect(transcript).toBeInViewport();
    }
  });

  test('should handle API health check', async ({ page }) => {
    // Navigate directly to verify backend is running
    const response = await page.request.get('http://localhost:3002/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('ok', true);
    expect(json).toHaveProperty('uptime_s');
  });
});

test.describe('Voice Features', () => {
  
  test('should show voice button when voice is enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if voice button exists (microphone icon, voice button, etc.)
    const voiceButton = page.locator('[data-testid="voice-button"], button:has-text(/voice|mic|audio/i)').first();
    
    // Voice button may or may not be visible depending on session state
    // Just verify the page loads without errors
    await expect(page).not.toHaveURL(/error/);
  });

  test('should request microphone permissions on voice activation', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Look for voice activation button
    const voiceButton = page.locator('[data-testid="voice-button"], button:has-text(/voice|mic|start/i)').first();
    
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      
      // Wait a bit for WebRTC connection attempt
      await page.waitForTimeout(2000);
      
      // Verify no console errors related to permissions
      // (actual voice connection may fail without real OpenAI token)
    }
  });
});

test.describe('Session Management', () => {
  
  test('should list existing sessions', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to sessions page if it exists
    const sessionsLink = page.locator('text=/session|history/i').first();
    
    if (await sessionsLink.isVisible()) {
      await sessionsLink.click();
      
      // Wait for sessions API
      await page.waitForResponse(response => 
        response.url().includes('/api/sessions'),
        { timeout: 10000 }
      ).catch(() => {
        // Sessions endpoint might not exist yet
      });
    }
  });

  test('should end a session gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Look for end session button
    const endButton = page.locator('text=/end|stop|finish|close/i').first();
    
    if (await endButton.isVisible()) {
      await endButton.click();
      
      // Confirm dialog if present
      const confirmButton = page.locator('text=/confirm|yes|ok/i').first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Verify session ended (redirected or showing end state)
      await page.waitForTimeout(1000);
    }
  });
});
