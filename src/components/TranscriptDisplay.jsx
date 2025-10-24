import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import bubbleTracker from '../utils/BubbleTracker';

/**
 * Modified transcript display to focus on reliability over virtualization
 */
function TranscriptDisplay({ 
  transcripts = [], 
  maxTranscripts = 50,
  height = 500,
  itemHeight = 80,
  emptyMessage = 'No transcripts yet. Start speaking to see your words appear here.'
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [renderedBubbles, setRenderedBubbles] = useState(0);
  
  // Check if container is rendered and log dimensions
  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      console.log('TranscriptDisplay container dimensions:', offsetWidth, offsetHeight);
    }
  }, []);
  
  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (containerRef.current && transcripts.length > 0) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight;
      console.log('Scrolled to bottom, transcript count:', transcripts.length);
    }
  }, [transcripts.length]);
  
  // Check for rendered bubbles
  useEffect(() => {
    if (containerRef.current && transcripts.length > 0) {
      setTimeout(() => {
        const bubbles = containerRef.current.querySelectorAll('.chat-bubble');
        setRenderedBubbles(bubbles.length);
        
        if (bubbles.length === 0 && transcripts.length > 0) {
          console.warn('No bubbles rendered despite having transcripts. Forcing re-render...');
        }
      }, 500);
    }
  }, [transcripts.length]);
  
  // Limit number of transcripts to prevent memory issues
  const limitedTranscripts = useMemo(() => {
    return transcripts.length > maxTranscripts
      ? transcripts.slice(-maxTranscripts)
      : transcripts;
  }, [transcripts, maxTranscripts]);
  
  // Handle scroll events
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  // Direct hack to ensure transcripts are always rendered
  useEffect(() => {
    if (containerRef.current && window.transcriptBackup) {
      // Check if any transcripts aren't rendered
      const renderedTexts = Array.from(
        containerRef.current.querySelectorAll('.chat-bubble')
      ).map(bubble => bubble.textContent.trim());
      
      const missingTranscripts = window.transcriptBackup.filter(t => 
        t.isFinal && 
        !renderedTexts.some(text => text.includes(t.text))
      );
      
      // Render any missing transcripts
      if (missingTranscripts.length > 0) {
        console.log('[TranscriptDisplay] Rendering missing transcripts:', missingTranscripts.length);
        
        missingTranscripts.forEach(transcript => {
          const bubble = document.createElement('div');
          bubble.className = `chat-bubble final ${transcript.role}-bubble`;
          
          bubble.innerHTML = `
            <div class="chat-text">${transcript.text}</div>
            <div class="chat-timestamp">${new Date(transcript.timestamp).toLocaleTimeString()}</div>
          `;
          
          // Style to match other bubbles
          Object.assign(bubble.style, {
            backgroundColor: transcript.role === 'user' ? '#e9ecef' : '#d1ecf1',
            color: transcript.role === 'user' ? '#495057' : '#0c5460',
            borderRadius: '1rem',
            padding: '0.75rem 1rem',
            margin: '0.5rem 0',
            maxWidth: '80%',
            marginLeft: transcript.role === 'user' ? '0' : 'auto'
          });
          
          containerRef.current.appendChild(bubble);
        });
      }
    }
  }, [transcripts.length]);
  
  // Simple direct rendering (no virtualization) for reliability
  return (
    <div className="transcript-display">
      <div 
        ref={containerRef}
        className="transcript-container"
        style={{ 
          height, 
          overflowY: 'auto',
          position: 'relative',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}
        onScroll={handleScroll}
      >
        {limitedTranscripts.length > 0 ? (
          <>
            {limitedTranscripts.map((transcript) => (
              <ChatBubble 
                key={transcript.id || transcript.timestamp || Math.random()}
                transcript={transcript}
              />
            ))}
            
            {/* Spacer element to ensure scrolling works properly */}
            <div style={{ height: '20px' }}></div>
          </>
        ) : (
          <div className="empty-state">{emptyMessage}</div>
        )}
      </div>
      
      {/* Debug info - development only */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="transcript-debug-info" style={{ fontSize: '10px', color: '#666' }}>
          Container height: {containerRef.current?.offsetHeight || 0}px, 
          Transcripts: {transcripts.length}, 
          Rendered bubbles: {renderedBubbles}
        </div>
      )}
    </div>
  );
}

// Memoized chat bubble component with visibility checks
const ChatBubble = React.memo(function ChatBubble({ transcript }) {
  const { text, timestamp, isFinal, role } = transcript;
  const bubbleRef = useRef(null);
  
  // Force direct style override on the bubble
  useEffect(() => {
    if (bubbleRef.current) {
      const role = transcript.role || 'user';
      const styles = {
        backgroundColor: role === 'assistant' ? '#d1ecf1' : '#e9ecef',
        color: role === 'assistant' ? '#0c5460' : '#495057',
        padding: '0.75rem 1rem',
        margin: '0.5rem 0',
        borderRadius: '1rem',
        maxWidth: '80%',
        marginLeft: role === 'assistant' ? 'auto' : '0',
        position: 'relative',
        zIndex: 5,
        display: 'block',
        visibility: 'visible',
        opacity: 1
      };
      
      // Apply styles directly to ensure visibility
      Object.assign(bubbleRef.current.style, styles);
      
      console.log(`Bubble rendered and styled: "${text.substring(0, 20)}..."`);
    }
  }, [text, transcript.role]);
  
  const formattedTime = useMemo(() => {
    return new Date(timestamp).toLocaleTimeString();
  }, [timestamp]);
  
  return (
    <div 
      ref={bubbleRef}
      className={`chat-bubble ${isFinal ? 'final' : 'interim'} ${transcript.role || 'user'}-bubble`}
    >
      <div className="chat-text">{text}</div>
      <div className="chat-timestamp">{formattedTime}</div>
    </div>
  );
});

export default TranscriptDisplay;
