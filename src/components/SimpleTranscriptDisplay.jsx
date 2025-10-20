import React, { useRef, useEffect } from 'react';
import { useTranscripts } from '../state/TranscriptManager';

const SimpleTranscriptDisplay = ({ height = 400 }) => {
  const { state } = useTranscripts();
  const { transcripts } = state;
  const containerRef = useRef(null);
  
  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts.length, state.lastUpdated]);
  
  return (
    <div 
      ref={containerRef}
      className="transcript-container"
      style={{ 
        height, 
        overflowY: 'auto',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        padding: '1rem',
        backgroundColor: '#fff'
      }}
    >
      {transcripts.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', color: '#6c757d', padding: '2rem' }}>
          No transcripts yet. Start speaking to see your words appear here.
        </div>
      ) : (
        transcripts.map((transcript) => (
          <div
            key={transcript.id}
            className={`chat-bubble ${transcript.isFinal ? 'final' : 'interim'}`}
            style={{
              backgroundColor: transcript.role === 'assistant' ? '#d1ecf1' : '#e9ecef',
              color: transcript.role === 'assistant' ? '#0c5460' : '#495057',
              padding: '0.75rem 1rem',
              margin: '0.5rem 0',
              borderRadius: '1rem',
              maxWidth: '80%',
              marginLeft: transcript.role === 'assistant' ? 'auto' : '0',
              opacity: transcript.isFinal ? 1 : 0.7
            }}
          >
            <div className="chat-text">{transcript.text}</div>
            <div 
              className="chat-timestamp" 
              style={{ fontSize: '0.75rem', opacity: 0.7, textAlign: 'right', marginTop: '0.25rem' }}
            >
              {new Date(transcript.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SimpleTranscriptDisplay;
