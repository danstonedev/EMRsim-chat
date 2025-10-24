/**
 * This utility bypasses the transcript filtering system to ensure messages are displayed
 */

// Store original methods that might be filtering transcripts
let originalMethods = {
  handleTranscriptUpdate: null,
  updateVoiceMessage: null
};

// Intercept transcript processing
export function installTranscriptBypass() {
  console.log('[TranscriptBypass] Installing bypass hooks...');
  
  // Create a MutationObserver to watch for any elements that might be transcript containers
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Check if any voice transcript system is loaded
        if (window.voiceTranscriptSystem || 
            window.globalVoiceSystem || 
            window.__VOICE_TRANSCRIPT_MODULE__) {
          
          // If found, patch its methods
          const system = window.voiceTranscriptSystem || 
                         window.globalVoiceSystem || 
                         window.__VOICE_TRANSCRIPT_MODULE__;
          
          patchVoiceSystem(system);
        }
      }
    }
  });
  
  // Start observing the document
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Try to find and patch the module directly
  setTimeout(() => {
    // Check for any objects with the filtering method
    const candidateObjects = findObjectsWithMethod(window, 'updateVoiceMessage');
    for (const obj of candidateObjects) {
      patchVoiceSystem(obj);
    }
    
    // Also try to monkey-patch the console to catch transcript skips
    monkeyPatchConsoleForTranscripts();
  }, 1000);
  
  return () => {
    observer.disconnect();
  };
}

// Find objects with a specific method
function findObjectsWithMethod(root, methodName, depth = 3, path = 'window') {
  if (depth <= 0) return [];
  if (!root || typeof root !== 'object') return [];
  
  const results = [];
  
  try {
    const props = Object.getOwnPropertyNames(root);
    
    for (const prop of props) {
      try {
        if (prop === methodName && typeof root[prop] === 'function') {
          console.log(`[TranscriptBypass] Found ${methodName} at ${path}`);
          results.push(root);
        } else if (typeof root[prop] === 'object' && root[prop] !== null) {
          const nestedResults = findObjectsWithMethod(root[prop], methodName, depth - 1, `${path}.${prop}`);
          results.push(...nestedResults);
        }
      } catch (e) {
        // Ignore errors accessing properties
      }
    }
  } catch (e) {
    // Ignore errors enumerating properties
  }
  
  return results;
}

// Patch the voice system's filtering methods
function patchVoiceSystem(system) {
  if (!system) return;
  
  // Try to patch skip detection method
  if (system.updateVoiceMessage && !originalMethods.updateVoiceMessage) {
    originalMethods.updateVoiceMessage = system.updateVoiceMessage;
    
    system.updateVoiceMessage = function(...args) {
      const result = originalMethods.updateVoiceMessage.apply(this, args);
      
      // Force processing of final messages
      const transcript = args[0];
      if (transcript && transcript.isFinal) {
        // Override any skipping logic by dispatching a custom event
        console.log('[TranscriptBypass] Forcing display of final transcript:', transcript.text);
        
        // Try to add to DOM directly if all else fails
        setTimeout(() => {
          ensureTranscriptVisible(transcript);
        }, 200);
      }
      
      return result;
    };
    
    console.log('[TranscriptBypass] Patched updateVoiceMessage method');
  }
}

// Ensure transcript is visible by checking the DOM
function ensureTranscriptVisible(transcript) {
  // Check if transcript is visible in any container
  const container = document.querySelector('.transcript-container') || 
                    document.querySelector('.chat-container');
  
  if (!container) return;
  
  // Look for text content
  const hasMatchingBubble = Array.from(container.querySelectorAll('.chat-bubble')).some(
    bubble => bubble.textContent.includes(transcript.text)
  );
  
  // If not found, create an emergency bubble
  if (!hasMatchingBubble) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bypass-bubble';
    
    // Style to match other bubbles
    Object.assign(bubble.style, {
      backgroundColor: transcript.role === 'user' ? '#e9ecef' : '#d1ecf1',
      color: transcript.role === 'user' ? '#495057' : '#0c5460',
      borderRadius: '1rem',
      padding: '0.75rem 1rem',
      margin: '0.5rem 0',
      maxWidth: '80%',
      marginLeft: transcript.role === 'user' ? '0' : 'auto',
      boxShadow: '0 0 0 1px rgba(0, 123, 255, 0.5)'
    });
    
    bubble.innerHTML = `
      <div class="chat-text">${transcript.text}</div>
      <div class="chat-timestamp">${new Date(transcript.timestamp).toLocaleTimeString()}</div>
    `;
    
    container.appendChild(bubble);
    console.log('[TranscriptBypass] Created emergency bubble for:', transcript.text);
  }
}

// Monkey-patch console to detect and fix skipped transcripts
function monkeyPatchConsoleForTranscripts() {
  const originalLog = console.log;
  
  console.log = function(...args) {
    originalLog.apply(this, args);
    
    try {
      if (args[0] && typeof args[0] === 'string') {
        const message = args[0];
        
        // Look for skipped transcript messages
        if (message.includes('[useVoiceTranscripts] skipped final voice bubble') && args[1]) {
          const skipData = args[1];
          
          console.log('[TranscriptBypass] Detected skipped transcript:', skipData);
          
          // Try to recover from stored transcripts
          if (window.globalVoiceTranscripts || window.transcriptBackup) {
            const transcripts = window.globalVoiceTranscripts || window.transcriptBackup || [];
            const matchingTranscript = transcripts.find(t => 
              t.role === skipData.role && 
              t.timestamp === skipData.safeTimestamp
            );
            
            if (matchingTranscript) {
              ensureTranscriptVisible(matchingTranscript);
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors in our console interceptor
    }
  };
}
