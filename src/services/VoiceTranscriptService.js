import { useEffect, useCallback } from 'react';
import { useSocketService } from './SocketService';
import { useTranscripts } from '../state/TranscriptManager';

export function useVoiceTranscriptService(apiUrl, sessionId) {
  // Get transcript state manager
  const { addTranscript, updateTranscript, setError } = useTranscripts();
  
  // Initialize socket connection
  const socket = useSocketService(apiUrl, {
    query: { sessionId },
    onConnect: () => {
      // Join session room after connection
      socket.emit('join', { sessionId });
    },
    onError: (error) => {
      setError(`Connection error: ${error.message || 'Unknown error'}`);
    }
  });
  
  // Listen for transcript updates
  useEffect(() => {
    if (!socket) return;
    
    // Handler for transcript updates
    const handleTranscriptUpdate = (data) => {
      console.log('Transcript received:', data);
      
      if (!data || !data.text) return;
      
      if (data.isFinal) {
        // Add or update final transcript
        addTranscript({
          id: data.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          text: data.text,
          role: data.role || 'user',
          timestamp: data.timestamp || Date.now(),
          isFinal: true
        });
      } else {
        // Handle interim transcript
        // For simplicity in this design, we'll still add interim transcripts
        // but mark them as not final
        addTranscript({
          id: data.id || `interim-${Date.now()}`,
          text: data.text,
          role: data.role || 'user',
          timestamp: data.timestamp || Date.now(),
          isFinal: false
        });
      }
    };
    
    // Handle errors
    const handleTranscriptError = (errorData) => {
      console.error('Transcript error:', errorData);
      setError(errorData.message || 'Unknown transcript error');
    };
    
    // Set up listeners
    const cleanupUpdate = socket.on('transcript:update', handleTranscriptUpdate);
    const cleanupError = socket.on('transcript:error', handleTranscriptError);
    
    // Cleanup
    return () => {
      cleanupUpdate();
      cleanupError();
    };
  }, [socket, addTranscript, updateTranscript, setError]);
  
  // Send transcript to the backend
  const sendTranscript = useCallback((transcript) => {
    if (!socket) return;
    
    socket.emit('transcript:send', {
      ...transcript,
      sessionId
    });
  }, [socket, sessionId]);
  
  return {
    sendTranscript,
    isConnected: socket.isConnected,
    reconnect: socket.reconnect
  };
}
