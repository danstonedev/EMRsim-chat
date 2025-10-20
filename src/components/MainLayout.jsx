import React, { useState, useCallback, useRef, useEffect } from 'react';
import ThreeDViewerContainer from './ThreeDViewerContainer';
import VoiceChat from './VoiceChat';
import ChatErrorBoundary from './ChatErrorBoundary';

/**
 * MainLayout component that segregates 3D viewer and chat
 * to prevent performance interference
 */
function MainLayout({ debugMode = false }) {
  const [sessionId, setSessionId] = useState(() => {
    // Generate a unique session ID or retrieve from storage
    return localStorage.getItem('sessionId') || `session-${Date.now()}`;
  });
  
  const [isChatActive, setIsChatActive] = useState(false);
  // Updated API URL to use the correct port
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
  
  // Track if we're in a chat session to optimize 3D rendering
  const [activeChatCount, setActiveChatCount] = useState(0);
  const activeChatTimeoutRef = useRef(null);
  
  // Create new session handler
  const createNewSession = useCallback(() => {
    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
  }, []);
  
  // Chat activity status handler
  const handleChatActivity = useCallback((isActive) => {
    setIsChatActive(isActive);
    
    // Clear any existing timeout
    if (activeChatTimeoutRef.current) {
      clearTimeout(activeChatTimeoutRef.current);
    }
    
    // If chat became active, increment counter immediately
    if (isActive) {
      setActiveChatCount(prev => prev + 1);
    } else {
      // If chat became inactive, wait a bit before updating
      // to prevent flicker during brief pauses
      activeChatTimeoutRef.current = setTimeout(() => {
        setActiveChatCount(prev => Math.max(0, prev - 1));
      }, 3000);
    }
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeChatTimeoutRef.current) {
        clearTimeout(activeChatTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className={`main-layout ${debugMode ? 'debug-mode' : ''}`}>
      <header className="app-header">
        <h1>EMRsim Chat</h1>
        <div className="session-controls">
          <span>Session: {sessionId}</span>
          <button onClick={createNewSession}>New Session</button>
          {debugMode && <span className="debug-indicator">DEBUG MODE</span>}
        </div>
      </header>
      
      <div className="content-container">
        {/* 3D Viewer pane - segregated from chat components */}
        <section 
          className={`viewer-pane ${activeChatCount > 0 ? 'reduced-priority' : 'high-priority'}`}
        >
          <React.Suspense fallback={<div>Loading 3D viewer...</div>}>
            <ErrorBoundary fallbackUI={<div>3D viewer failed to load</div>}>
              <ThreeDViewerContainer 
                chatActive={activeChatCount > 0}
                modelPath="/models/character.glb"
              />
            </ErrorBoundary>
          </React.Suspense>
        </section>
        
        {/* Chat pane - isolated from 3D viewer */}
        <section className="chat-pane">
          <ChatErrorBoundary>
            <VoiceChat 
              sessionId={sessionId}
              apiUrl={apiUrl}
              onActivityChange={handleChatActivity}
              debugMode={debugMode}
            />
          </ChatErrorBoundary>
        </section>
      </div>
    </div>
  );
}

// Simple error boundary for the 3D viewer
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('3D Viewer error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallbackUI || <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}

export default MainLayout;
