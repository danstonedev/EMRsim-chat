import { test, expect } from '@playwright/test';

// Test the complete simulation workflow
test.describe('Simulation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete and redirect to home
    await page.waitForURL('**/');
  });
  
  test('should be able to complete a full simulation', async ({ page }) => {
    // Step 1: Navigate to available simulations page
    await page.click('text=Simulations');
    await expect(page).toHaveURL('**/simulations');
    
    // Step 2: Select the first simulation
    await expect(page.locator('.simulation-card')).toBeVisible();
    await page.click('.simulation-card >> text=Start Simulation');
    
    // Step 3: Check that simulation workspace loads
    await expect(page).toHaveURL(/\/simulation\/[\w-]+/);
    await expect(page.locator('.simulation-title')).toBeVisible();
    
    // Step 4: Check patient information is displayed
    await expect(page.locator('.patient-info')).toBeVisible();
    await expect(page.locator('.patient-name')).toContainText(/\w+/);
    
    // Step 5: Start the conversation
    await page.click('button:has-text("Begin Interview")');
    await expect(page.locator('.conversation-active')).toBeVisible();
    
    // Step 6: Send messages in the conversation
    const messageInput = page.locator('.message-input input');
    await expect(messageInput).toBeVisible();
    
    // Send first message
    await messageInput.fill('Hello, how are you feeling today?');
    await page.click('.message-input button');
    
    // Wait for response from the simulated patient
    await expect(page.locator('.message-patient')).toBeVisible();
    await expect(page.locator('.message-patient')).toContainText(/\w+/);
    
    // Send follow-up question
    await messageInput.fill('Can you describe your symptoms?');
    await page.click('.message-input button');
    
    // Wait for response
    await expect(page.locator('.message-patient >> nth=1')).toBeVisible();
    
    // Step 7: Access medical history
    await page.click('button:has-text("Medical History")');
    await expect(page.locator('.medical-history-panel')).toBeVisible();
    
    // Step 8: Order diagnostic tests
    await page.click('button:has-text("Order Tests")');
    await expect(page.locator('.diagnostic-tests-panel')).toBeVisible();
    
    // Select a test
    await page.click('.test-option >> text=Complete Blood Count');
    await page.click('button:has-text("Order Selected Tests")');
    
    // Wait for test results
    await expect(page.locator('.test-results')).toBeVisible();
    
    // Step 9: Make a diagnosis
    await page.click('button:has-text("Diagnose")');
    await expect(page.locator('.diagnosis-panel')).toBeVisible();
    
    // Select diagnosis
    await page.fill('.diagnosis-search input', 'Common Cold');
    await page.click('.diagnosis-option >> text=Common Cold');
    
    // Provide justification
    await page.fill('.diagnosis-justification textarea', 
      'Based on the symptoms of sore throat, runny nose, and absence of fever.');
    
    // Submit diagnosis
    await page.click('button:has-text("Submit Diagnosis")');
    
    // Step 10: Recommend treatment
    await expect(page.locator('.treatment-panel')).toBeVisible();
    await page.click('.treatment-option >> text=Rest and fluids');
    await page.click('.treatment-option >> text=Over-the-counter pain relievers');
    
    await page.fill('.treatment-notes textarea', 
      'Take acetaminophen for pain as needed. Rest for at least 3 days and maintain hydration.');
    
    // Submit treatment plan
    await page.click('button:has-text("Submit Treatment Plan")');
    
    // Step 11: Complete simulation and verify feedback
    await expect(page.locator('.simulation-complete')).toBeVisible();
    await expect(page.locator('.simulation-score')).toBeVisible();
    await expect(page.locator('.feedback-section')).toBeVisible();
    
    // Check that all required feedback categories are present
    const feedbackCategories = [
      'History Taking',
      'Diagnostic Testing',
      'Clinical Reasoning',
      'Treatment Plan'
    ];
    
    for (const category of feedbackCategories) {
      await expect(page.locator(`.feedback-category:has-text("${category}")`))
        .toBeVisible();
    }
    
    // Step 12: Return to dashboard
    await page.click('button:has-text("Return to Dashboard")');
    await expect(page).toHaveURL('**/');
    
    // Step 13: Verify the simulation appears in completed simulations
    await page.click('text=History');
    await expect(page.locator('.completed-simulations')).toBeVisible();
    
    // Should see the simulation we just completed
    await expect(page.locator('.completed-simulation-card >> nth=0'))
      .toContainText('Common Cold');
  });
  
  test('should handle network interruptions during simulation', async ({ page, context }) => {
    // Step 1: Navigate to simulations and start one
    await page.click('text=Simulations');
    await page.click('.simulation-card >> text=Start Simulation');
    await expect(page.locator('.simulation-title')).toBeVisible();
    
    // Step 2: Start conversation
    await page.click('button:has-text("Begin Interview")');
    
    // Step 3: Send initial message
    const messageInput = page.locator('.message-input input');
    await messageInput.fill('Hello, how are you feeling today?');
    await page.click('.message-input button');
    
    // Wait for response
    await expect(page.locator('.message-patient')).toBeVisible();
    
    // Step 4: Simulate network disconnection
    await context.setOffline(true);
    
    // Step 5: Try to send another message
    await messageInput.fill('Can you describe your pain?');
    await page.click('.message-input button');
    
    // Should see connection error
    await expect(page.locator('.connection-status')).toContainText('disconnected');
    await expect(page.locator('.error-state')).toBeVisible();
    
    // Step 6: Restore connection
    await context.setOffline(false);
    
    // Step 7: Reconnect
    await page.click('.error-state button:has-text("Reconnect")');
    
    // Connection should be restored
    await expect(page.locator('.connection-status')).toContainText('connected');
    
    // Step 8: Should be able to continue the conversation
    await messageInput.fill('Sorry about that. Can you describe your symptoms?');
    await page.click('.message-input button');
    
    // Should get a response
    await expect(page.locator('.message-patient >> nth=1')).toBeVisible();
  });
});
