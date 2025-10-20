/**
 * Global utility to track and debug bubble rendering issues
 */
class BubbleTracker {
  constructor() {
    this.transcripts = [];
    this.renderedBubbles = new Map();
    this.skipEvents = [];
    this.initialized = false;
    
    // This will hold global references to the components' state updaters
    this.stateUpdaters = {
      forceRender: null
    };
  }

  /**
   * Initialize the tracker
   */
  init() {
    if (this.initialized) return;
    
    console.log('🔍 BubbleTracker initialized');
    this.initialized = true;
    
    // Start monitoring for voice transcript events
    this.monitorVoiceTranscripts();
    
    // Inject global CSS overrides
    this.injectCssOverrides();
    
    // Monitor DOM mutations to detect new bubbles
    this.startDomObserver();
  }

  /**
   * Monitor voice transcript events
   */
  monitorVoiceTranscripts() {
    // Create a proxy for console.log to intercept voice transcript logs
    const originalLog = console.log;
    console.log = (...args) => {
      // Call original console.log
      originalLog.apply(console, args);
      
      // Check for voice transcript logs
      if (args[0] && typeof args[0] === 'string') {
        const logMsg = args[0];
        
        // Listen for skipped bubbles
        if (logMsg.includes('[useVoiceTranscripts] skipped final voice bubble')) {
          this.skipEvents.push({
            time: Date.now(),
            reason: args[1]?.reason || 'unknown',
            data: args[1] || {}
          });
          
          // Force render after skips
          setTimeout(() => this.forceBubbleRender(), 500);
        }
        
        // Listen for transcript updates
        if (logMsg.includes('[useVoiceTranscripts] updateVoiceMessage invoked')) {
          const transcriptData = args[1];
          if (transcriptData) {
            this.transcripts.push({
              ...transcriptData,
              time: Date.now()
            });
            
            // If it's final, check for bubble rendering
            if (transcriptData.isFinal) {
              setTimeout(() => this.checkBubbleRendered(transcriptData), 300);
            }
          }
        }
      }
    };
  }

  /**
   * Check if a bubble was rendered for a transcript
   */
  checkBubbleRendered(transcript) {
    const bubbles = document.querySelectorAll('.chat-bubble');
    
    // Count new bubbles
    const newCount = bubbles.length;
    const oldCount = this.renderedBubbles.size;
    
    if (newCount <= oldCount && transcript.isFinal) {
      console.warn('🛑 Final transcript not rendered as bubble:', transcript);
      
      // Emergency render
      this.emergencyRenderBubble(transcript);
      
      // Try to force a re-render
      this.forceBubbleRender();
    } else if (newCount > oldCount) {
      console.log('✅ New bubble detected for transcript');
      
      // Track new bubbles
      bubbles.forEach(bubble => {
        if (!this.renderedBubbles.has(bubble)) {
          this.renderedBubbles.set(bubble, {
            time: Date.now(),
            text: bubble.textContent
          });
        }
      });
    }
  }

  /**
   * Force bubble rendering
   */
  forceBubbleRender() {
    // If we have a force render function, call it
    if (this.stateUpdaters.forceRender) {
      this.stateUpdaters.forceRender();
      console.log('🔄 Forced component re-render');
      return;
    }
    
    // Otherwise, try to find and call forceRerenderKey updater
    const forceRenderButtons = document.querySelectorAll('button');
    let found = false;
    
    forceRenderButtons.forEach(button => {
      if (button.textContent.includes('Force Rerender')) {
        button.click();
        found = true;
        console.log('🔄 Clicked force rerender button');
      }
    });
    
    if (!found) {
      console.warn('⚠️ No force render method available');
    }
  }

  /**
   * Emergency render of a bubble
   */
  emergencyRenderBubble(transcript) {
    if (!transcript || !transcript.text) return;
    
    console.log('🚨 Emergency bubble render for:', transcript.text);
    
    const container = document.querySelector('.transcript-container');
    if (!container) {
      console.error('❌ No transcript container found for emergency bubble');
      return;
    }
    
    // Create a bubble element
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble emergency-bubble';
    bubble.innerHTML = `
      <div class="chat-text">${transcript.text}</div>
      <div class="chat-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    // Style for visibility
    Object.assign(bubble.style, {
      backgroundColor: transcript.role === 'user' ? '#e9ecef' : '#d1ecf1',
      color: transcript.role === 'user' ? '#495057' : '#0c5460',
      padding: '0.75rem 1rem',
      margin: '0.5rem 0',
      borderRadius: '1rem',
      maxWidth: '80%',
      marginLeft: transcript.role === 'user' ? '0' : 'auto',
      position: 'relative',
      zIndex: 9999,
      display: 'block',
      visibility: 'visible',
      opacity: 1
    });
    
    // Add to the container
    container.appendChild(bubble);
    
    // Track this bubble
    this.renderedBubbles.set(bubble, {
      time: Date.now(),
      text: transcript.text,
      emergency: true
    });
    
    // Scroll to the bottom
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Inject CSS overrides to force visibility
   */
  injectCssOverrides() {
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
      /* Force visibility of chat bubbles */
      .chat-bubble {
        visibility: visible !important;
        opacity: 1 !important;
        display: block !important;
        z-index: 9999 !important;
        pointer-events: auto !important;
      }
      
      /* Force visibility of transcript container */
      .transcript-container {
        min-height: 100px !important;
        display: block !important;
        visibility: visible !important;
        overflow: auto !important;
      }
      
      /* Emergency bubble highlight */
      .emergency-bubble {
        box-shadow: 0 0 5px red !important;
      }
    `;
    
    // Add to document head
    document.head.appendChild(style);
  }

  /**
   * Start observing DOM changes to detect bubbles
   */
  startDomObserver() {
    // Create mutation observer
    const observer = new MutationObserver(mutations => {
      let foundBubbles = false;
      
      mutations.forEach(mutation => {
        // Check for added nodes
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            // Check if this is a chat bubble or contains chat bubbles
            const bubbles = node.querySelectorAll ? node.querySelectorAll('.chat-bubble') : [];
            
            if (node.classList && node.classList.contains('chat-bubble') || bubbles.length > 0) {
              foundBubbles = true;
              console.log('🔍 DOM Observer: New chat bubble detected');
              
              // Track bubbles
              if (node.classList && node.classList.contains('chat-bubble')) {
                this.renderedBubbles.set(node, {
                  time: Date.now(),
                  text: node.textContent,
                  fromObserver: true
                });
              }
              
              bubbles.forEach(bubble => {
                this.renderedBubbles.set(bubble, {
                  time: Date.now(),
                  text: bubble.textContent,
                  fromObserver: true
                });
              });
            }
          });
        }
      });
      
      if (foundBubbles) {
        console.log(`🔍 Current bubble count: ${this.renderedBubbles.size}`);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Register state updaters
   */
  registerForceRender(forceRenderFn) {
    this.stateUpdaters.forceRender = forceRenderFn;
    console.log('🔄 Registered force render function');
  }

  /**
   * Get diagnostic report
   */
  getReport() {
    return {
      transcriptsReceived: this.transcripts.length,
      bubblesRendered: this.renderedBubbles.size,
      skipEvents: this.skipEvents.length,
      recentTranscripts: this.transcripts.slice(-5),
      recentSkips: this.skipEvents.slice(-5)
    };
  }
}

// Create global instance
const bubbleTracker = new BubbleTracker();

// Add to window for console access
if (typeof window !== 'undefined') {
  window.BubbleTracker = bubbleTracker;
  
  // Auto-initialize after page load
  if (document.readyState === 'complete') {
    bubbleTracker.init();
  } else {
    window.addEventListener('load', () => {
      bubbleTracker.init();
    });
  }
}

export default bubbleTracker;
