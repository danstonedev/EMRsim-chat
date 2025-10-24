import { useReducer, useCallback } from 'react';

// Initial state for the voice chat
const initialChatState = {
  audio: {
    isCapturing: false,
    deviceId: null,
    volume: 0,
    error: null
  },
  connection: {
    isConnected: false,
    status: 'disconnected',
    reconnectAttempts: 0
  },
  transcripts: [],
  lastTranscriptTime: null,
  error: null,
  lastErrorTime: null
};

// Action types as constants to avoid typos
export const ACTIONS = {
  SET_AUDIO_STATUS: 'SET_AUDIO_STATUS',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  ADD_TRANSCRIPT: 'ADD_TRANSCRIPT',
  UPDATE_TRANSCRIPT: 'UPDATE_TRANSCRIPT',
  MARK_PROCESSED: 'MARK_PROCESSED',
  CLEAR_TRANSCRIPTS: 'CLEAR_TRANSCRIPTS',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer function for state management
function chatReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_AUDIO_STATUS:
      return {
        ...state,
        audio: {
          ...state.audio,
          ...action.payload
        }
      };
      
    case ACTIONS.SET_CONNECTION_STATUS:
      return {
        ...state,
        connection: {
          ...state.connection,
          ...action.payload
        }
      };
      
    case ACTIONS.ADD_TRANSCRIPT:
      return {
        ...state,
        transcripts: [...state.transcripts, {
          id: action.payload.id || Date.now().toString(),
          text: action.payload.text,
          timestamp: action.payload.timestamp || Date.now(),
          isFinal: action.payload.isFinal || false
        }],
        lastTranscriptTime: Date.now()
      };
      
    case ACTIONS.UPDATE_TRANSCRIPT:
      return {
        ...state,
        transcripts: state.transcripts.map(t => 
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
        lastTranscriptTime: Date.now()
      };
      
    case ACTIONS.MARK_PROCESSED:
      return {
        ...state,
        transcripts: state.transcripts.map(t => 
          t.id === action.payload ? { ...t, processed: true } : t
        )
      };
      
    case ACTIONS.CLEAR_TRANSCRIPTS:
      return {
        ...state,
        transcripts: [],
        lastTranscriptTime: Date.now()
      };
      
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        lastErrorTime: Date.now()
      };
      
    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
      
    default:
      return state;
  }
}

/**
 * Hook for centralized chat state management using reducer
 * Prevents race conditions and ensures consistent state transitions
 */
export function useChatState(customInitialState = {}) {
  const [state, dispatch] = useReducer(
    chatReducer, 
    { ...initialChatState, ...customInitialState }
  );
  
  // Wrapper functions for common actions
  const actions = {
    setAudioStatus: useCallback((status) => {
      dispatch({ type: ACTIONS.SET_AUDIO_STATUS, payload: status });
    }, []),
    
    setConnectionStatus: useCallback((status) => {
      dispatch({ type: ACTIONS.SET_CONNECTION_STATUS, payload: status });
    }, []),
    
    addTranscript: useCallback((transcript) => {
      dispatch({ type: ACTIONS.ADD_TRANSCRIPT, payload: transcript });
    }, []),
    
    updateTranscript: useCallback((transcript) => {
      dispatch({ type: ACTIONS.UPDATE_TRANSCRIPT, payload: transcript });
    }, []),
    
    markProcessed: useCallback((transcriptId) => {
      dispatch({ type: ACTIONS.MARK_PROCESSED, payload: transcriptId });
    }, []),
    
    clearTranscripts: useCallback(() => {
      dispatch({ type: ACTIONS.CLEAR_TRANSCRIPTS });
    }, []),
    
    setError: useCallback((error) => {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error });
    }, []),
    
    clearError: useCallback(() => {
      dispatch({ type: ACTIONS.CLEAR_ERROR });
    }, []),
    
    // Handle transcript update from socket
    handleTranscriptUpdate: useCallback((transcript) => {
      // Add bypass for final transcripts to ensure they're displayed
      if (transcript.isFinal) {
        // Log that we're forcing this transcript through
        console.log('[FIXED] Forcing transcript display:', transcript.text);
        
        // Add the transcript to the state without filtering
        setTranscripts(prevTranscripts => {
          // Only check for exact duplicates (same ID)
          const isDuplicate = prevTranscripts.some(t => t.id === transcript.id);
          
          if (isDuplicate) {
            return prevTranscripts;
          }
          
          return [...prevTranscripts, {
            id: transcript.id || Date.now(),
            text: transcript.text,
            timestamp: transcript.timestamp || Date.now(),
            role: transcript.role || 'user',
            isFinal: transcript.isFinal
          }];
        });
      } else {
        // Original handling for non-final transcripts
        dispatch({ type: ACTIONS.ADD_TRANSCRIPT, payload: transcript });
      }
    }, [state.transcripts])
  };
  
  return { state, dispatch, actions };
}
