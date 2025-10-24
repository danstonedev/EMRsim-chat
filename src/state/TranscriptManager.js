import { createContext, useContext, useReducer, useCallback } from 'react';

// Action types
const ACTIONS = {
  ADD_TRANSCRIPT: 'ADD_TRANSCRIPT',
  UPDATE_TRANSCRIPT: 'UPDATE_TRANSCRIPT',
  CLEAR_TRANSCRIPTS: 'CLEAR_TRANSCRIPTS',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Initial state
const initialState = {
  transcripts: [],
  error: null,
  lastUpdated: null
};

// Reducer function
function transcriptReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_TRANSCRIPT: {
      const { transcript } = action.payload;
      // Check if this is a duplicate by ID
      const existingIndex = state.transcripts.findIndex(t => t.id === transcript.id);
      
      // If it exists and this is an update, replace it
      if (existingIndex >= 0) {
        return {
          ...state,
          transcripts: [
            ...state.transcripts.slice(0, existingIndex),
            transcript,
            ...state.transcripts.slice(existingIndex + 1)
          ],
          lastUpdated: Date.now()
        };
      }
      
      // Otherwise, add as new
      return {
        ...state,
        transcripts: [...state.transcripts, transcript],
        lastUpdated: Date.now()
      };
    }
    
    case ACTIONS.UPDATE_TRANSCRIPT: {
      const { id, updates } = action.payload;
      return {
        ...state,
        transcripts: state.transcripts.map(transcript => 
          transcript.id === id ? { ...transcript, ...updates } : transcript
        ),
        lastUpdated: Date.now()
      };
    }
    
    case ACTIONS.CLEAR_TRANSCRIPTS:
      return {
        ...state,
        transcripts: [],
        lastUpdated: Date.now()
      };
      
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error
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

// Context
const TranscriptContext = createContext(null);

// Provider component
export function TranscriptProvider({ children }) {
  const [state, dispatch] = useReducer(transcriptReducer, initialState);
  
  // Action creators
  const addTranscript = useCallback((transcript) => {
    if (!transcript) return;
    
    // Ensure required fields
    const processedTranscript = {
      id: transcript.id || Date.now().toString(),
      text: transcript.text || '',
      role: transcript.role || 'user',
      timestamp: transcript.timestamp || Date.now(),
      isFinal: !!transcript.isFinal
    };
    
    dispatch({ 
      type: ACTIONS.ADD_TRANSCRIPT, 
      payload: { transcript: processedTranscript } 
    });
    
    return processedTranscript.id;
  }, []);
  
  const updateTranscript = useCallback((id, updates) => {
    dispatch({ 
      type: ACTIONS.UPDATE_TRANSCRIPT, 
      payload: { id, updates } 
    });
  }, []);
  
  const clearTranscripts = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_TRANSCRIPTS });
  }, []);
  
  const setError = useCallback((error) => {
    dispatch({ 
      type: ACTIONS.SET_ERROR, 
      payload: { error } 
    });
  }, []);
  
  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, []);
  
  // The value to be provided
  const contextValue = {
    state,
    addTranscript,
    updateTranscript,
    clearTranscripts,
    setError,
    clearError
  };
  
  return (
    <TranscriptContext.Provider value={contextValue}>
      {children}
    </TranscriptContext.Provider>
  );
}

// Hook to use the transcript state
export function useTranscripts() {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error('useTranscripts must be used within a TranscriptProvider');
  }
  return context;
}
