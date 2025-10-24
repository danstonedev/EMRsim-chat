import React, { useState, useEffect, useRef } from 'react';

/**
 * Component that directly displays messages by monitoring console logs
 * to bypass the voice transcript system's filtering mechanism
 */
const DirectMessageDisplay = () => {
  const [messages, setMessages] = useState([]);
  const consoleOverrideRef = useRef(null);
  const containerRef = useRef(null);
  
  // Override console.log to capture transcript events
  useEffect(() => {
    // Store original console.log
    const originalLog = console.log;
    consoleOverrideRef.current = originalLog;
    
    // Override console.log to capture transcript events
    console.log = function(...args) {
      // Call original first
      originalLog.apply(console, args);
      
      // Check for relevant transcript events
      if (args[0] && typeof args[0] === 'string') {
        // Look for skipped messages
        if (args[0].includes('[Voice] [useVoiceTranscripts] finalized voice message skipped')) {
          if (args[1] && args[1].role) {
            const role = args[1].role;
            
            // Try to find the skipped message text by looking back through console history
            // This is hacky but necessary since we don't have direct access to the message
            setTimeout(() => {
              // Try to find most recent transcript in the DOM
              const transcriptElements = document.querySelectorAll('.useVoiceTranscripts-transcript');
              if (transcriptElements.length > 0) {
                const latestTranscript = transcriptElements[transcriptElements.length - 1];
                const text = latestTranscript.textContent;
                
                addMessage({
                  role,
                  text,
                  timestamp: Date.now()
                });
              } else {
                // Look through previous logs to find transcript text
                const previousLogs = window._consoleHistory || [];
                for (let i = previousLogs.length - 1; i >= 0; i--) {
                  const log = previousLogs[i];
                  if (log && log[0] && log[0].includes('Transcript received:') && log[1] && log[1].role === role) {
                    addMessage({
                      role,
                      text: log[1].text || 'Unknown message',
                      timestamp: Date.now()
                    });
                    break;
                  }
                }
              }
            }, 100);
          }
        }
        
        // Direct transcript capture
        if (args[0].includes('Transcript received:') && args[1]) {
          const transcript = args[1];
          
          // Store this transcript in history for potential later use
          if (!window._consoleHistory) window._consoleHistory = [];
          window._consoleHistory.push([args[0], transcript]);
          
          // Limit history size
          if (window._consoleHistory.length > 100) {
            window._consoleHistory.shift();
          }
          
          // Only add final transcripts
          if (transcript.isFinal) {
            addMessage({
              role: transcript.role || 'unknown',
              text: transcript.text || '',
              timestamp: transcript.timestamp || Date.now(),
              id: transcript.id
            });
          }
        }
        
        // Try to capture from updateVoiceMessage events if they have text
        if (args[0].includes('[useVoiceTranscripts] updateVoiceMessage invoked') && 
            args[1] && args[1].isFinal && args[1].text) {
          addMessage({
            role: args[1].role || 'unknown',
            text: args[1].text,
            timestamp: args[1].timestamp || Date.now(),
            id: args[1].id
          });
        }
      }
    };
    
    // Restore on cleanup
    return () => {
      console.log = consoleOverrideRef.current;
    };
  }, []);
  
  // Add a message, avoiding duplicates
  const addMessage = (message) => {
    if (!message.text) return;
    
    setMessages(prev => {
      // Check for duplicates
      const isDuplicate = prev.some(m => 
        m.text === message.text && 
        m.role === message.role
      );
      
      if (isDuplicate) return prev;
      
      return [...prev, {
        ...message,
        id: message.id || Date.now()
      }];
    });
  };
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);
  
  // Render messages
  return (
    <div className="direct-message-display">
      <div className="direct-message-header">
        <h3>Direct Messages ({messages.length})</h3>
        <small>Bypassing filtering system</small>
      </div>
      
      <div 
        ref={containerRef}
        className="direct-message-container"
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '10px',
          backgroundColor: '#fff'
        }}
      >
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
            Start speaking to see messages here
          </div>
        ) : (
          messages.map(message => (
            <div 
              key={message.id}
              className={`direct-bubble ${message.role}-bubble`}
              style={{
                backgroundColor: message.role === 'assistant' ? '#d1ecf1' : '#e9ecef',
                color: message.role === 'assistant' ? '#0c5460' : '#495057',
                padding: '0.75rem 1rem',
                margin: '0.5rem 0',
                borderRadius: '1rem',
                maxWidth: '80%',
                marginLeft: message.role === 'user' ? '0' : 'auto'
              }}
            >
              <div className="direct-text">{message.text}</div>
              <div 
                className="direct-timestamp"
                style={{ fontSize: '0.75rem', opacity: 0.7, textAlign: 'right' }}
              >
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DirectMessageDisplay;
