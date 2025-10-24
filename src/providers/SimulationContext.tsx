import React, { createContext, useContext, useReducer, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { useErrorLog } from './ErrorLogContext';

// Types
interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  medicalHistory: string[];
  vitalSigns: Record<string, any>;
  avatar?: string;
}

interface Simulation {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeLimit?: number;
  patient: Patient;
  scenario: string;
  status: 'notStarted' | 'inProgress' | 'completed' | 'reviewed';
  startTime?: string;
  endTime?: string;
  score?: number;
  feedback?: string[];
}

interface SimulationState {
  currentSimulation: Simulation | null;
  availableSimulations: Simulation[];
  pastSimulations: Simulation[];
  isLoading: boolean;
  error: Error | null;
}

// Action types
type SimulationAction =
  | { type: 'LOAD_SIMULATIONS_REQUEST' }
  | { type: 'LOAD_SIMULATIONS_SUCCESS'; payload: Simulation[] }
  | { type: 'LOAD_SIMULATIONS_FAILURE'; error: Error }
  | { type: 'LOAD_SIMULATION_REQUEST' }
  | { type: 'LOAD_SIMULATION_SUCCESS'; payload: Simulation }
  | { type: 'LOAD_SIMULATION_FAILURE'; error: Error }
  | { type: 'START_SIMULATION'; payload: string }
  | { type: 'COMPLETE_SIMULATION'; payload: { id: string; score: number } }
  | { type: 'ADD_FEEDBACK'; payload: { id: string; feedback: string } }
  | { type: 'UPDATE_SIMULATION'; payload: Partial<Simulation> }
  | { type: 'CLEAR_CURRENT_SIMULATION' };

// Context type
interface SimulationContextType extends SimulationState {
  loadSimulations: () => Promise<void>;
  loadSimulation: (id: string) => Promise<void>;
  startSimulation: (id: string) => Promise<void>;
  completeSimulation: (id: string, score: number) => Promise<void>;
  addFeedback: (id: string, feedback: string) => void;
  updateSimulation: (updates: Partial<Simulation>) => void;
  clearCurrentSimulation: () => void;
}

// Initial state
const initialState: SimulationState = {
  currentSimulation: null,
  availableSimulations: [],
  pastSimulations: [],
  isLoading: false,
  error: null
};

// Reducer function
const simulationReducer = (state: SimulationState, action: SimulationAction): SimulationState => {
  switch (action.type) {
    case 'LOAD_SIMULATIONS_REQUEST':
      return {
        ...state,
        isLoading: true,
        error: null
      };
      
    case 'LOAD_SIMULATIONS_SUCCESS':
      // Split simulations into available and past based on status
      const available = action.payload.filter(
        sim => sim.status === 'notStarted' || sim.status === 'inProgress'
      );
      const past = action.payload.filter(
        sim => sim.status === 'completed' || sim.status === 'reviewed'
      );
      
      return {
        ...state,
        availableSimulations: available,
        pastSimulations: past,
        isLoading: false
      };
      
    case 'LOAD_SIMULATIONS_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.error
      };
      
    case 'LOAD_SIMULATION_REQUEST':
      return {
        ...state,
        isLoading: true,
        error: null
      };
      
    case 'LOAD_SIMULATION_SUCCESS':
      return {
        ...state,
        currentSimulation: action.payload,
        isLoading: false
      };
      
    case 'LOAD_SIMULATION_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.error
      };
      
    case 'START_SIMULATION':
      // Update current simulation if it matches the ID
      if (state.currentSimulation && state.currentSimulation.id === action.payload) {
        return {
          ...state,
          currentSimulation: {
            ...state.currentSimulation,
            status: 'inProgress',
            startTime: new Date().toISOString()
          }
        };
      }
      return state;
      
    case 'COMPLETE_SIMULATION':
      // Update current simulation if it matches the ID
      if (state.currentSimulation && state.currentSimulation.id === action.payload.id) {
        const updatedSimulation = {
          ...state.currentSimulation,
          status: 'completed',
          endTime: new Date().toISOString(),
          score: action.payload.score
        };
        
        return {
          ...state,
          currentSimulation: updatedSimulation,
          // Move simulation from available to past
          availableSimulations: state.availableSimulations.filter(
            sim => sim.id !== action.payload.id
          ),
          pastSimulations: [
            updatedSimulation,
            ...state.pastSimulations
          ]
        };
      }
      return state;
      
    case 'ADD_FEEDBACK':
      // Update feedback for the specified simulation
      if (state.currentSimulation && state.currentSimulation.id === action.payload.id) {
        const feedback = state.currentSimulation.feedback || [];
        return {
          ...state,
          currentSimulation: {
            ...state.currentSimulation,
            feedback: [...feedback, action.payload.feedback]
          }
        };
      }
      return state;
      
    case 'UPDATE_SIMULATION':
      // Update current simulation with partial data
      if (state.currentSimulation) {
        return {
          ...state,
          currentSimulation: {
            ...state.currentSimulation,
            ...action.payload
          }
        };
      }
      return state;
      
    case 'CLEAR_CURRENT_SIMULATION':
      return {
        ...state,
        currentSimulation: null
      };
      
    default:
      return state;
  }
};

// Create context
const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

// Provider component
export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(simulationReducer, initialState);
  const { logError } = useErrorLog();
  
  // Load all simulations
  const loadSimulations = useCallback(async () => {
    dispatch({ type: 'LOAD_SIMULATIONS_REQUEST' });
    
    try {
      const response = await apiClient.get('/simulations');
      dispatch({ 
        type: 'LOAD_SIMULATIONS_SUCCESS', 
        payload: response.data 
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load simulations');
      dispatch({ type: 'LOAD_SIMULATIONS_FAILURE', error: err });
      logError(err, { context: 'loadSimulations' });
    }
  }, [logError]);
  
  // Load a specific simulation
  const loadSimulation = useCallback(async (id: string) => {
    dispatch({ type: 'LOAD_SIMULATION_REQUEST' });
    
    try {
      const response = await apiClient.get(`/simulations/${id}`);
      dispatch({ 
        type: 'LOAD_SIMULATION_SUCCESS', 
        payload: response.data 
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(`Failed to load simulation ${id}`);
      dispatch({ type: 'LOAD_SIMULATION_FAILURE', error: err });
      logError(err, { context: 'loadSimulation', simulationId: id });
    }
  }, [logError]);
  
  // Start a simulation
  const startSimulation = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/simulations/${id}/start`);
      dispatch({ type: 'START_SIMULATION', payload: id });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(`Failed to start simulation ${id}`);
      logError(err, { context: 'startSimulation', simulationId: id });
      throw err;
    }
  }, [logError]);
  
  // Complete a simulation
  const completeSimulation = useCallback(async (id: string, score: number) => {
    try {
      await apiClient.post(`/simulations/${id}/complete`, { score });
      dispatch({ type: 'COMPLETE_SIMULATION', payload: { id, score } });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(`Failed to complete simulation ${id}`);
      logError(err, { context: 'completeSimulation', simulationId: id, score });
      throw err;
    }
  }, [logError]);
  
  // Add feedback to a simulation
  const addFeedback = useCallback((id: string, feedback: string) => {
    dispatch({ type: 'ADD_FEEDBACK', payload: { id, feedback } });
  }, []);
  
  // Update current simulation
  const updateSimulation = useCallback((updates: Partial<Simulation>) => {
    dispatch({ type: 'UPDATE_SIMULATION', payload: updates });
  }, []);
  
  // Clear current simulation
  const clearCurrentSimulation = useCallback(() => {
    dispatch({ type: 'CLEAR_CURRENT_SIMULATION' });
  }, []);
  
  // Create context value
  const value = {
    ...state,
    loadSimulations,
    loadSimulation,
    startSimulation,
    completeSimulation,
    addFeedback,
    updateSimulation,
    clearCurrentSimulation
  };
  
  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};

// Custom hook for using simulation context
export const useSimulation = (): SimulationContextType => {
  const context = useContext(SimulationContext);
  
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  
  return context;
};
