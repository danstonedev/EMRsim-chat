/**
 * Utility to inspect DOM elements and diagnose rendering issues
 */
export class DOMInspector {
  /**
   * Check if an element is properly rendered
   * @param {string} selector - CSS selector for elements to check
   * @returns {Object} Inspection results
   */
  static inspectElements(selector) {
    const elements = document.querySelectorAll(selector);
    const results = {
      found: elements.length,
      visible: 0,
      invisible: 0,
      zeroSize: 0,
      offscreen: 0,
      details: []
    };
    
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      
      const isVisible = styles.display !== 'none' && 
                      styles.visibility !== 'hidden' && 
                      parseFloat(styles.opacity) > 0;
                      
      const hasSize = rect.width > 0 && rect.height > 0;
      
      const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
      
      const elementDetail = {
        index,
        isVisible,
        hasSize,
        isInViewport,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        styles: {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          zIndex: styles.zIndex,
          position: styles.position,
          overflow: styles.overflow
        }
      };
      
      results.details.push(elementDetail);
      
      if (!isVisible) results.invisible++;
      else results.visible++;
      
      if (!hasSize) results.zeroSize++;
      if (!isInViewport) results.offscreen++;
    });
    
    return results;
  }
  
  /**
   * Check parent hierarchy for rendering issues
   * @param {string} selector - CSS selector to start from
   * @param {number} depth - How many parent levels to check
   * @returns {Array} Array of parent elements with visibility info
   */
  static inspectParentChain(selector, depth = 5) {
    const element = document.querySelector(selector);
    if (!element) return [{ error: 'Element not found' }];
    
    const chain = [];
    let current = element;
    let level = 0;
    
    while (current && level < depth) {
      const styles = window.getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      
      chain.push({
        element: current.tagName + (current.className ? '.' + current.className.replace(/\s+/g, '.') : ''),
        visible: styles.display !== 'none' && styles.visibility !== 'hidden' && parseFloat(styles.opacity) > 0,
        dimensions: { width: rect.width, height: rect.height },
        overflow: styles.overflow,
        position: styles.position,
        zIndex: styles.zIndex
      });
      
      current = current.parentElement;
      level++;
    }
    
    return chain;
  }
  
  /**
   * Add a debug overlay to highlight an element's boundaries
   * @param {string} selector - CSS selector for elements to highlight
   * @param {string} color - Highlight color
   */
  static highlightElement(selector, color = 'red') {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const highlight = document.createElement('div');
      
      Object.assign(highlight.style, {
        position: 'absolute',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        border: `2px solid ${color}`,
        backgroundColor: `${color}22`,
        zIndex: 10000,
        pointerEvents: 'none'
      });
      
      highlight.className = 'dom-inspector-highlight';
      document.body.appendChild(highlight);
      
      setTimeout(() => {
        if (document.body.contains(highlight)) {
          document.body.removeChild(highlight);
        }
      }, 5000);
    });
    
    return elements.length;
  }
}

// Add to window for console debugging
if (typeof window !== 'undefined') {
  window.DOMInspector = DOMInspector;
  
  // Auto-run initial check when script loads
  setTimeout(() => {
    const results = DOMInspector.inspectElements('.chat-bubble');
    console.log('Chat Bubble DOM Inspection:', results);
    
    if (results.found === 0) {
      console.warn('No chat bubbles found in DOM! Checking transcript container...');
      const containerResults = DOMInspector.inspectElements('.transcript-container');
      console.log('Transcript Container Inspection:', containerResults);
    }
  }, 3000);
}
