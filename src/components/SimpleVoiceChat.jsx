import React, { useState, useEffect } from 'react';
import { useVoiceTranscriptService } from '../services/VoiceTranscriptService';
import { useTranscripts } from '../state/TranscriptManager';
import SimpleTranscriptDisplay from './SimpleTranscriptDisplay';

const SimpleVoiceChat = ({ 
  sessionId, 
  apiUrl = 'http://localhost:3002'
}) => {
  // Get transcript service
  const { isConnected, reconnect } = useVoiceTranscriptService(apiUrl, sessionId);
  
  // Get transcript state
  const { state, clearError } = useTranscripts();
  const { error } = state;
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Update connection status
  useEffect(() => {
    setConnectionStatus(isConnected() ? 'connected' : 'disconnected');
  }, [isConnected]);
  
  // Handle manual reconnect
  const handleReconnect = () => {
    setConnectionStatus('connecting');
    reconnect();
  };
  
  return (
    <div className="simple-voice-chat">
      {/* Connection status */}
      <div 
        className={`connection-status ${connectionStatus}`}
        style={{
          padding: '0.5rem 1rem',
          marginBottom: '1rem',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: connectionStatus === 'connected' ? '#d4edda' : 
                          connectionStatus === 'connecting' ? '#fff3cd' : '#f8d7da',
          color: connectionStatus === 'connected' ? '#155724' : 
                connectionStatus === 'connecting' ? '#856404' : '#721c24'
        }}
      >
        <span>
          {connectionStatus === 'connected' ? 'Connected' :
           connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </span>
        
        {connectionStatus === 'disconnected' && (
          <button 
            onClick={handleReconnect}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            Reconnect
          </button>
        )}
      </div>
      
      {/* Error display */}
      {error && (
        <div 
          className="error-message"
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{error}</span>
          <button 
            onClick={clearError}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#721c24',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              fontWeight: 'bold'
            }}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}
      
      {/* Transcript display */}
      <SimpleTranscriptDisplay height={400} />
    </div>
  );
};

export default SimpleVoiceChat;
