/**
 * Root-level diagnostics for rendering issues
 */
export class RootDiagnostics {
  /**
   * Runs comprehensive diagnostics on the entire application
   */
  static runFullCheck() {
    console.log('Running Root Diagnostics...');

    // Check for global CSS issues
    this.checkCSSInterference();
    
    // Check for DOM structure issues
    this.checkDOMStructure();
    
    // Check React strict mode
    this.checkReactStrictMode();
    
    // Check for z-index wars
    this.checkZIndexing();
    
    // Check for portal issues
    this.checkReactPortals();
  }

  /**
   * Check for CSS rules that might hide elements
   */
  static checkCSSInterference() {
    console.log('Checking CSS interference...');
    
    // Get all stylesheets
    const sheets = document.styleSheets;
    const problematicRules = [];
    
    try {
      // Loop through all stylesheets
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        
        try {
          // Access might fail for cross-origin stylesheets
          const rules = sheet.cssRules || sheet.rules;
          
          // Check each rule
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            
            // Look for potentially problematic CSS
            if (rule.selectorText) {
              const selector = rule.selectorText;
              
              // Look for rules that might hide elements
              if ((selector.includes('.chat-bubble') || selector.includes('.transcript-container')) &&
                  (rule.style.display === 'none' || 
                   rule.style.visibility === 'hidden' || 
                   rule.style.opacity === '0' ||
                   rule.style.transform === 'scale(0)')) {
                problematicRules.push({
                  selector,
                  styleSheet: sheet.href || 'inline',
                  style: rule.style.cssText
                });
              }
            }
          }
        } catch (e) {
          console.log('Could not access rules in stylesheet:', sheet.href);
        }
      }
    } catch (e) {
      console.error('Error checking CSS:', e);
    }
    
    if (problematicRules.length > 0) {
      console.warn('Found potentially problematic CSS rules:', problematicRules);
    } else {
      console.log('No problematic CSS rules found.');
    }
  }
  
  /**
   * Check DOM structure for issues
   */
  static checkDOMStructure() {
    console.log('Checking DOM structure...');
    
    // Check if app root has proper dimensions
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const rootRect = rootElement.getBoundingClientRect();
      console.log('Root element dimensions:', {
        width: rootRect.width,
        height: rootRect.height,
        visible: rootRect.width > 0 && rootRect.height > 0
      });
    } else {
      console.warn('Root element not found!');
    }
    
    // Check for body/html overflow issues
    const bodyStyles = window.getComputedStyle(document.body);
    const htmlStyles = window.getComputedStyle(document.documentElement);
    
    if (bodyStyles.overflow === 'hidden' || htmlStyles.overflow === 'hidden') {
      console.warn('Body or HTML has overflow:hidden which might clip content');
    }
    
    // Check for unusual positioning
    if (bodyStyles.position !== 'static' || htmlStyles.position !== 'static') {
      console.warn('Body or HTML has non-standard positioning:', {
        body: bodyStyles.position,
        html: htmlStyles.position
      });
    }
  }
  
  /**
   * Check if React StrictMode is causing double-renders
   */
  static checkReactStrictMode() {
    // Count renders to detect strict mode
    let renderCount = 0;
    
    const testElement = document.createElement('div');
    testElement.id = 'strict-mode-test';
    document.body.appendChild(testElement);
    
    const unmount = () => {
      if (document.body.contains(testElement)) {
        document.body.removeChild(testElement);
      }
    };
    
    // Schedule cleanup
    setTimeout(unmount, 1000);
    
    return {
      strictModeDetected: renderCount > 1,
      renderCount
    };
  }
  
  /**
   * Check for z-index issues
   */
  static checkZIndexing() {
    console.log('Checking z-index stacking...');
    
    const allElements = document.querySelectorAll('*');
    const zIndexMap = [];
    
    // Find all elements with explicit z-index
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const styles = window.getComputedStyle(el);
      
      if (styles.zIndex !== 'auto') {
        const zIndex = parseInt(styles.zIndex);
        if (!isNaN(zIndex) && zIndex > 0) {
          zIndexMap.push({
            element: el.tagName + (el.className ? '.' + el.className.replace(/\s+/g, '.') : ''),
            zIndex,
            position: styles.position
          });
        }
      }
    }
    
    // Sort by z-index
    zIndexMap.sort((a, b) => b.zIndex - a.zIndex);
    
    // Log high z-index elements
    if (zIndexMap.length > 0) {
      console.log('Elements with highest z-index:', zIndexMap.slice(0, 5));
    } else {
      console.log('No elements with explicit z-index found.');
    }
  }
  
  /**
   * Check for React portal issues
   */
  static checkReactPortals() {
    console.log('Checking for portal-related issues...');
    
    // Look for common portal containers
    const portalContainers = [
      document.getElementById('portal-root'),
      document.getElementById('modal-root'),
      document.querySelector('[data-react-portal]')
    ].filter(Boolean);
    
    if (portalContainers.length > 0) {
      console.log('Found potential React portal containers:', portalContainers.length);
      
      // Check if any portals might be stealing our elements
      portalContainers.forEach((container, index) => {
        const chatBubbles = container.querySelectorAll('.chat-bubble');
        if (chatBubbles.length > 0) {
          console.warn(`Found ${chatBubbles.length} chat bubbles in portal container ${index}!`);
        }
      });
    } else {
      console.log('No portal containers found.');
    }
  }
  
  /**
   * Add a visible chat bubble to test rendering
   */
  static injectTestBubble() {
    console.log('Injecting test chat bubble...');
    
    // Create test bubble
    const testBubble = document.createElement('div');
    testBubble.className = 'chat-bubble test-bubble';
    testBubble.innerHTML = `
      <div class="chat-text">Test Chat Bubble</div>
      <div class="chat-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    // Style it to be very visible
    Object.assign(testBubble.style, {
      backgroundColor: '#ff5722',
      color: 'white',
      padding: '15px',
      borderRadius: '10px',
      margin: '10px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      position: 'fixed',
      bottom: '70px',
      right: '10px',
      zIndex: '9999',
      opacity: '1',
      visibility: 'visible',
      display: 'block'
    });
    
    // Add to document
    document.body.appendChild(testBubble);
    
    // Remove after a while
    setTimeout(() => {
      if (document.body.contains(testBubble)) {
        document.body.removeChild(testBubble);
      }
    }, 10000);
    
    return testBubble;
  }
}

// Add to window for console access
if (typeof window !== 'undefined') {
  window.RootDiagnostics = RootDiagnostics;
}
