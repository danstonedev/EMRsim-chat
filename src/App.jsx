import React, { useEffect, useState } from 'react';
import { TranscriptProvider } from './state/TranscriptManager';
import MainLayout from './components/MainLayout';
import SimpleVoiceChat from './components/SimpleVoiceChat';
import bubbleTracker from './utils/BubbleTracker';
import { installTranscriptBypass } from './utils/TranscriptBypass';
import './styles/layout.css';
import './styles/voiceChat.css';

function App() {
  const [debugMode, setDebugMode] = useState(false);
  
  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
    
    // Initialize bubble tracker
    if (!debugMode) {
      bubbleTracker.init();
      
      // Log useful information
      console.log('Debug mode enabled');
      console.log('Current bubbles:', document.querySelectorAll('.chat-bubble').length);
      console.log('Transcript container:', document.querySelector('.transcript-container'));
    }
  };
  
  // Force emergency bubble render for all voice transcript messages
  const forceAllBubbles = () => {
    const container = document.querySelector('.transcript-container');
    
    if (!container) {
      alert('No transcript container found!');
      return;
    }
    
    // Clear any existing emergency bubbles
    const existingBubbles = container.querySelectorAll('.emergency-bubble');
    existingBubbles.forEach(b => b.remove());
    
    // Search logs for transcript messages
    const logs = bubbleTracker.transcripts;
    
    if (logs.length === 0) {
      alert('No transcript logs found!');
      return;
    }
    
    // Render each as an emergency bubble
    logs.forEach(transcript => {
      if (!transcript.text) return;
      
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble emergency-bubble';
      bubble.innerHTML = `
        <div class="chat-text">${transcript.text}</div>
        <div class="chat-timestamp">${new Date(transcript.timestamp).toLocaleTimeString()}</div>
      `;
      
      // Style for visibility
      Object.assign(bubble.style, {
        backgroundColor: transcript.role === 'assistant' ? '#d1ecf1' : '#e9ecef',
        color: transcript.role === 'assistant' ? '#0c5460' : '#495057',
        padding: '0.75rem 1rem',
        margin: '0.5rem 0',
        borderRadius: '1rem',
        maxWidth: '80%',
        marginLeft: transcript.role === 'assistant' ? 'auto' : '0',
        position: 'relative',
        zIndex: 9999,
        display: 'block',
        visibility: 'visible',
        opacity: 1
      });
      
      container.appendChild(bubble);
    });
    
    alert(`Rendered ${logs.length} emergency bubbles`);
  };
  
  // Install the transcript bypass when the app loads
  useEffect(() => {
    // Save transcripts in a global variable to help with recovery
    window.transcriptBackup = [];
    
    // Install the bypass
    const cleanup = installTranscriptBypass();
    
    // Listen for transcript events to back them up
    const captureTranscripts = (e) => {
      if (e.detail && e.detail.transcript) {
        window.transcriptBackup.push(e.detail.transcript);
      }
    };
    
    document.addEventListener('transcript:update', captureTranscripts);
    
    return () => {
      cleanup();
      document.removeEventListener('transcript:update', captureTranscripts);
    };
  }, []);
  
  // Generate a session ID if one doesn't exist
  const sessionId = localStorage.getItem('sessionId') || `session-${Date.now()}`;
  
  // Save session ID to localStorage
  if (!localStorage.getItem('sessionId')) {
    localStorage.setItem('sessionId', sessionId);
  }
  
  return (
    <div className={debugMode ? 'debug-mode' : ''}>
      <MainLayout debugMode={debugMode} />
      
      <main className="app-content">
        <TranscriptProvider>
          <SimpleVoiceChat 
            sessionId={sessionId}
            apiUrl="http://localhost:3002"
          />
        </TranscriptProvider>
      </main>
      
      {/* Debug Mode Toggle Button */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button 
          onClick={toggleDebugMode}
          style={{
            padding: '8px 12px',
            background: debugMode ? '#dc3545' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          {debugMode ? 'Disable Debug' : 'Enable Debug'}
        </button>
        
        <button 
          onClick={forceAllBubbles}
          style={{
            padding: '8px 12px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Force Show All Bubbles
        </button>
      </div>
    </div>
  );
}

export default App;
