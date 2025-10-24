import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBackendSocket } from '../hooks/useBackendSocket';
import { useChatState } from '../hooks/useChatState';
import TranscriptDisplay from './TranscriptDisplay';
import ChatErrorBoundary from './ChatErrorBoundary';
import TranscriptDebugger from './TranscriptDebugger';
import DirectMessageDisplay from './DirectMessageDisplay';
import { DOMInspector } from '../utils/DOMInspector';
import { RootDiagnostics } from '../utils/RootDiagnostics';
import bubbleTracker from '../utils/BubbleTracker';

/**
 * Helper function to debounce frequent updates
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Integrated voice chat component with debugging for transcript rendering issues
 */
function VoiceChat({ 
  sessionId, 
  apiUrl = 'http://localhost:3002',
  onActivityChange = null,
  debugMode = false
}) {
  const { state, actions } = useChatState();
  const { audio, connection, transcripts, error } = state;
  
  // Debug state
  const [showDebugger, setShowDebugger] = useState(debugMode);
  const [forceRerenderKey, setForceRerenderKey] = useState(0);
  const receivedTranscriptsRef = useRef([]);
  const [showDirectDisplay, setShowDirectDisplay] = useState(true);
  
  // Register force render with BubbleTracker
  useEffect(() => {
    const forceRender = () => setForceRerenderKey(prev => prev + 1);
    bubbleTracker.registerForceRender(forceRender);
    
    return () => {
      bubbleTracker.registerForceRender(null);
    };
  }, []);
  
  // Update showDebugger when debugMode prop changes
  useEffect(() => {
    setShowDebugger(debugMode);
  }, [debugMode]);
  
  // Track if audio is active (speaking)
  const [isAudioActive, setIsAudioActive] = useState(false);
  const lastVolumeRef = useRef(0);
  const silenceTimeoutRef = useRef(null);
  
  // Debounce volume updates to reduce state changes
  const debouncedVolume = useDebounce(audio.volume, 50);
  
  // Create tracer for debugging
  const tracerRef = useRef(null);
  if (!tracerRef.current) {
    tracerRef.current = { trace: (step, details) => console.log(`[Trace:${sessionId}] ${step}`, details) };
  }
  
  // Create robust socket connection
  const { 
    socket, 
    connectionState,
    useEvent,
    emit,
    status
  } = useBackendSocket(`${apiUrl}`, {
    query: { sessionId },
    
    // Connection lifecycle callbacks
    onConnect: () => {
      tracerRef.current.trace('socket-connected');
      
      // Join session room after connection
      emit('join', { sessionId });
      
      // Update connection state
      actions.setConnectionStatus({
        isConnected: true,
        status: 'connected'
      });
    },
    
    onDisconnect: (reason) => {
      tracerRef.current.trace('socket-disconnected', { reason });
      
      // Update connection state
      actions.setConnectionStatus({
        isConnected: false,
        status: 'disconnected',
        disconnectReason: reason
      });
    },
    
    onReconnect: (attemptNumber) => {
      tracerRef.current.trace('socket-reconnected', { attemptNumber });
      
      // Re-join session after reconnection
      emit('join', { sessionId });
      
      // Update connection state
      actions.setConnectionStatus({
        isConnected: true,
        status: 'connected',
        reconnectAttempts: attemptNumber
      });
    },
    
    // Add error handler for better diagnostics
    onError: (error) => {
      tracerRef.current.trace('socket-error', { error: error.message });
      actions.setError(`Connection error: ${error.message}`);
    }
  });
  
  // Manual reconnection function
  const handleManualReconnect = useCallback(() => {
    tracerRef.current.trace('manual-reconnect-attempt');
    
    // Reset connection status
    actions.setConnectionStatus({
      status: 'connecting',
      isConnected: false,
      reconnectAttempts: 0
    });
    
    // If socket exists, reconnect
    if (socket) {
      socket.connect();
    }
  }, [socket, actions]);
  
  // Handle transcript updates with enhanced debugging
  useEvent('transcript:update', (data) => {
    tracerRef.current.trace('transcript-received', { 
      id: data.id, 
      textLength: data?.text?.length || 0 
    });
    
    // Keep a reference copy for debugging
    receivedTranscriptsRef.current.push({
      ...data,
      receivedAt: new Date().toISOString()
    });
    
    console.log('Transcript received:', data);
    
    // Use action handler to properly update state
    actions.handleTranscriptUpdate(data);
    
    // Mark when rendering
    tracerRef.current.trace('transcript-rendered', { id: data.id });
    
    // Additional debugging: force re-render occasionally
    if (receivedTranscriptsRef.current.length % 5 === 0) {
      setTimeout(() => setForceRerenderKey(prev => prev + 1), 500);
    }
    
    // Force a re-render if this is a final transcript
    if (data.isFinal) {
      setTimeout(() => setForceRerenderKey(prev => prev + 1), 100);
    }
    
    // Consider this an active moment even if no voice is detected
    if (onActivityChange && typeof onActivityChange === 'function') {
      onActivityChange(true);
      
      // Auto-reset activity after transcript completes if no voice detected
      if (!isAudioActive) {
        const resetTimeout = setTimeout(() => {
          onActivityChange(false);
        }, 5000);
        
        return () => clearTimeout(resetTimeout);
      }
    }
  }, [actions.handleTranscriptUpdate, isAudioActive, onActivityChange]);
  
  // Handle errors
  useEvent('transcript:error', (errorData) => {
    tracerRef.current.trace('transcript-error', { error: errorData });
    actions.setError(`Transcript error: ${errorData.message || 'Unknown error'}`);
  }, [actions.setError]);
  
  // Force rerender if no bubbles appear after receiving transcripts
  useEffect(() => {
    if (transcripts.length > 0 && document.querySelectorAll('.chat-bubble').length === 0) {
      console.log('Detected transcript data but no visible chat bubbles. Forcing re-render...');
      const timer = setTimeout(() => {
        setForceRerenderKey(prev => prev + 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [transcripts.length]);
  
  // Handle debounced volume updates
  useEffect(() => {
    if (debouncedVolume > 0.1) {
      // Audio activity detected
      if (!isAudioActive) {
        setIsAudioActive(true);
        tracerRef.current.trace('audio-activity-started', { volume: debouncedVolume });
        
        // Notify parent about activity
        if (onActivityChange) {
          onActivityChange(true);
        }
      }
      
      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Set a new silence detection timeout
      silenceTimeoutRef.current = setTimeout(() => {
        setIsAudioActive(false);
        tracerRef.current.trace('audio-activity-stopped', { lastVolume: lastVolumeRef.current });
        
        // Notify parent about inactivity after a short delay
        if (onActivityChange) {
          setTimeout(() => onActivityChange(false), 2000);
        }
      }, 1000); // Wait 1 second of silence before considering audio inactive
    }
    
    // Save the last volume for reference
    lastVolumeRef.current = debouncedVolume;
  }, [debouncedVolume, isAudioActive, onActivityChange]);
  
  // Connection status messages with helpful instructions
  const getConnectionMessage = () => {
    if (connection.status === 'connected') {
      return 'Connected';
    } else if (connection.status === 'connecting') {
      return `Reconnecting... (Attempt ${connection.reconnectAttempts})`;
    } else if (connection.disconnectReason === 'io server disconnect') {
      return 'Disconnected by server. Please try reconnecting.';
    } else if (connection.disconnectReason === 'ping timeout') {
      return 'Connection timed out. Check your internet connection.';
    } else {
      return 'Disconnected';
    }
  };
  
  // Highlight chat bubbles and transcript container for debugging
  const runVisualDebugging = () => {
    DOMInspector.highlightElement('.chat-bubble', 'green');
    DOMInspector.highlightElement('.transcript-container', 'blue');
    
    // Check for bubbles and log results
    const bubbleResults = DOMInspector.inspectElements('.chat-bubble');
    console.log('Chat Bubble Inspection:', bubbleResults);
    
    // Check container
    const containerResults = DOMInspector.inspectElements('.transcript-container');
    console.log('Transcript Container Inspection:', containerResults);
    
    // Check parent chain
    const parentChain = DOMInspector.inspectParentChain('.transcript-container');
    console.log('Parent Chain Inspection:', parentChain);
  };
  
  // Add port check for API URL
  useEffect(() => {
    if (!apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1')) {
      console.log('Using remote API URL:', apiUrl);
    } else {
      console.log('Using local API URL:', apiUrl);
      
      // Verify backend port is correct
      if (!apiUrl.includes(':3002')) {
        console.warn('Backend API URL may be incorrect. Expected port 3002.');
      }
    }
  }, [apiUrl]);
  
  // Add a direct rendering test for chat bubbles
  const testDirectRenderRef = useRef(null);
  
  // Test direct DOM rendering
  useEffect(() => {
    if (debugMode && transcripts.length > 0 && document.querySelectorAll('.chat-bubble').length === 0) {
      console.log('Testing direct DOM rendering of chat bubbles...');
      
      // Clear previous test element
      if (testDirectRenderRef.current && testDirectRenderRef.current.parentNode) {
        testDirectRenderRef.current.parentNode.removeChild(testDirectRenderRef.current);
      }
      
      // Create a test element
      const testEl = document.createElement('div');
      testEl.className = 'chat-bubble-test';
      testEl.innerHTML = `
        <p>Test Chat Bubble (Direct DOM)</p>
        <p>If you see this but not regular chat bubbles, there's a React rendering issue</p>
      `;
      
      // Style for visibility
      Object.assign(testEl.style, {
        background: 'purple',
        color: 'white',
        padding: '10px',
        margin: '10px 0',
        borderRadius: '8px'
      });
      
      // Find transcript container
      const container = document.querySelector('.transcript-container');
      if (container) {
        container.appendChild(testEl);
        testDirectRenderRef.current = testEl;
      } else {
        // If no container found, add to body
        document.body.appendChild(testEl);
        testDirectRenderRef.current = testEl;
        console.warn('No transcript container found, added test bubble to body');
      }
    }
    
    return () => {
      if (testDirectRenderRef.current && testDirectRenderRef.current.parentNode) {
        testDirectRenderRef.current.parentNode.removeChild(testDirectRenderRef.current);
      }
    };
  }, [debugMode, transcripts.length]);
  
  // Emergency manual render of chat bubbles
  const renderEmergencyBubbles = useCallback(() => {
    // Clear any test elements
    if (testDirectRenderRef.current && testDirectRenderRef.current.parentNode) {
      testDirectRenderRef.current.parentNode.removeChild(testDirectRenderRef.current);
    }
    
    // Find container
    const container = document.querySelector('.transcript-container');
    if (!container) {
      console.error('No transcript container found for emergency bubbles');
      return;
    }
    
    // Clear container
    const existingBubbles = container.querySelectorAll('.emergency-bubble');
    existingBubbles.forEach(bubble => bubble.parentNode.removeChild(bubble));
    
    // Render each transcript as a bubble
    transcripts.forEach(transcript => {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble emergency-bubble';
      bubble.innerHTML = `
        <div class="chat-text">${transcript.text}</div>
        <div class="chat-timestamp">${new Date(transcript.timestamp).toLocaleTimeString()}</div>
      `;
      
      // Style the bubble
      Object.assign(bubble.style, {
        backgroundColor: '#d1ecf1',
        border: '1px solid #bee5eb',
        color: '#0c5460',
        padding: '0.75rem 1rem',
        margin: '0.5rem 0',
        borderRadius: '1rem',
        maxWidth: '80%',
        marginLeft: 'auto',
        position: 'relative',
        zIndex: '9999',
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      });
      
      container.appendChild(bubble);
    });
    
    console.log(`Rendered ${transcripts.length} emergency bubbles`);
  }, [transcripts]);
  
  // Get bubble tracker report
  const getBubbleReport = useCallback(() => {
    const report = bubbleTracker.getReport();
    console.log('Bubble Tracker Report:', report);
    alert(`Transcript count: ${report.transcriptsReceived}\nBubbles rendered: ${report.bubblesRendered}\nSkip events: ${report.skipEvents}`);
  }, []);
  
  // Toggle direct display mode
  const toggleDirectDisplay = useCallback(() => {
    setShowDirectDisplay(prev => !prev);
  }, []);
  
  // Comprehensive diagnosis of rendering issues
  const diagnoseChatIssues = useCallback(() => {
    console.log('Running comprehensive chat rendering diagnosis...');
    
    // Check React rendering
    console.log('Transcript state:', transcripts);
    
    // Check DOM
    const bubbles = document.querySelectorAll('.chat-bubble');
    console.log(`Found ${bubbles.length} chat bubbles in DOM`);
    
    // Check container
    const container = document.querySelector('.transcript-container');
    if (container) {
      console.log('Transcript container found:', {
        width: container.offsetWidth,
        height: container.offsetHeight,
        children: container.children.length,
        visible: container.offsetWidth > 0 && container.offsetHeight > 0,
        styles: window.getComputedStyle(container)
      });
    } else {
      console.error('No transcript container found in DOM!');
    }
    
    // Run root diagnostics
    if (RootDiagnostics && RootDiagnostics.runFullCheck) {
      RootDiagnostics.runFullCheck();
    }
    
    // Create test bubble
    if (RootDiagnostics && RootDiagnostics.injectTestBubble) {
      RootDiagnostics.injectTestBubble();
    }
  }, [transcripts]);

  return (
    <div className="voice-chat-container" key={`voice-chat-${forceRerenderKey}`}>
      {/* Connection status indicator with improved accessibility and visual feedback */}
      <div 
        className={`connection-status ${connection.status}`}
        role="status"
        aria-live="polite"
      >
        <span>{getConnectionMessage()}</span>
        
        {/* Show manual reconnect button if disconnected */}
        {connection.status === 'disconnected' && (
          <button 
            onClick={handleManualReconnect}
            className="reconnect-button"
            aria-label="Attempt to reconnect"
          >
            Reconnect
          </button>
        )}
      </div>
      
      {/* Audio status indicator with improved feedback */}
      <div 
        className="audio-status"
        role="status"
        aria-live="polite"
      >
        <div 
          className={`volume-indicator ${isAudioActive ? 'active' : 'inactive'}`}
          style={{ transform: `scaleY(${audio.volume || 0})` }}
          aria-hidden="true"
        />
        
        <div className="audio-status-text">
          <span>{audio.isCapturing ? 'Microphone active' : 'Microphone inactive'}</span>
          {audio.isCapturing && (
            <span className={`speech-indicator ${isAudioActive ? 'speaking' : 'silent'}`}>
              {isAudioActive ? 'Speech detected' : 'No speech detected'}
            </span>
          )}
        </div>
      </div>
      
      {/* Error display with dismissal and improved accessibility */}
      {error && (
        <div 
          className="error-message" 
          role="alert"
          aria-live="assertive"
        >
          <p>{error}</p>
          <button 
            onClick={actions.clearError}
            className="dismiss-button"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Direct message display to bypass filtering */}
      {showDirectDisplay && (
        <DirectMessageDisplay />
      )}
      
      {/* Toggle button for direct display */}
      <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
        <button 
          onClick={toggleDirectDisplay}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: showDirectDisplay ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          {showDirectDisplay ? 'Hide Direct Display' : 'Show Direct Display'}
        </button>
      </div>
      
      {/* Original transcript display with error boundary */}
      <div className="transcript-wrapper" style={{ position: 'relative' }}>
        <ChatErrorBoundary
          fallback={({ error, reset }) => (
            <div className="chat-error">
              <p>Chat display encountered an error</p>
              <p className="error-details">{error?.message}</p>
              <button onClick={reset}>Reset</button>
            </div>
          )}
        >
          <TranscriptDisplay 
            transcripts={transcripts}
            maxTranscripts={100}
            height={400}
          />
        </ChatErrorBoundary>
        
        {/* Debugging overlay */}
        {debugMode && (
          <div className="debug-toggle" style={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px',
            zIndex: 1000
          }}>
            <button onClick={() => setShowDebugger(prev => !prev)}>
              {showDebugger ? 'Hide' : 'Show'} Debugger
            </button>
          </div>
        )}
      </div>
      
      {/* Show transcript data for debugging */}
      {showDebugger && (
        <div className="debug-section">
          <TranscriptDebugger transcripts={transcripts} />
          <div className="visibility-check">
            <p>Transcript count: {transcripts.length}</p>
            <p>Visible bubbles: {document.querySelectorAll('.chat-bubble').length}</p>
            <p>Last update: {new Date().toLocaleTimeString()}</p>
          </div>
          <div className="debug-buttons">
            <button onClick={() => setForceRerenderKey(prev => prev + 1)} style={{ marginRight: '8px' }}>
              Force Rerender
            </button>
            <button onClick={runVisualDebugging} style={{ marginRight: '8px' }}>
              Highlight Elements
            </button>
            <button onClick={diagnoseChatIssues} style={{ marginRight: '8px' }}>
              Diagnose Issues
            </button>
            <button onClick={renderEmergencyBubbles} style={{ marginRight: '8px' }}>
              Emergency Render
            </button>
            <button onClick={getBubbleReport}>
              Bubble Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceChat;
