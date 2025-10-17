/**
 * Voice Session State Reducer
 * 
 * Consolidates 15 separate useState calls into a single atomic state object.
 * This provides:
 * - Atomic updates (no intermediate states)
 * - Predictable state transitions
 * - Easier debugging (single reducer to trace)
 * - Better performance (fewer re-renders)
 * - Testable state logic (pure function)
 * 
 * Part of: REFACTORING_OPPORTUNITIES.md #3 (useVoiceSession Reducer)
 * Date: October 16, 2025
 */

import type { VoiceStatus } from '../types';

/**
 * Complete voice session state
 * Replaces 15 individual useState calls with single atomic state object
 */
export interface VoiceSessionState {
  // Core status
  status: VoiceStatus;
  error: string | null;
  sessionId: string | null;
  
  // Transcript partials
  userPartial: string;
  assistantPartial: string;
  
  // Audio/connection state
  micLevel: number;
  micPaused: boolean;
  micStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  
  // Encounter state
  encounter: {
    phase: string | null;
    gate: Record<string, unknown> | null;
    outstandingGate: string[];
  };
  
  // Adaptive audio
  adaptive: {
    enabled: boolean;
    status: 'quiet' | 'noisy' | 'very-noisy';
    noise: number;
    snr: number;
    threshold: number | null;
    silenceMs: number | null;
  };
  
  // Debug mode
  debugEnabled: boolean;
}

/**
 * All possible state transition actions
 * Each action represents a specific event from the ConversationController
 */
export type VoiceSessionAction =
  // Status changes (from 'status' event)
  | {
      type: 'STATUS_CHANGED';
      status: VoiceStatus;
      error: string | null;
      micStream: MediaStream | null;
      peerConnection: RTCPeerConnection | null;
    }
  // Session creation (from 'session' event)
  | {
      type: 'SESSION_CREATED';
      sessionId: string | null;
      encounter: {
        phase: string | null;
        gate: Record<string, unknown> | null;
        outstandingGate: string[];
      };
    }
  // Partial transcripts (from 'partial' event)
  | {
      type: 'USER_PARTIAL';
      text: string;
    }
  | {
      type: 'ASSISTANT_PARTIAL';
      text: string;
    }
  // Mic level updates (from 'mic-level' event)
  | {
      type: 'MIC_LEVEL_UPDATED';
      level: number;
      adaptive: VoiceSessionState['adaptive'];
    }
  // Mic pause state (from 'pause' event)
  | {
      type: 'MIC_PAUSED';
      paused: boolean;
    }
  // Final transcripts (from 'transcript' event with isFinal=true)
  | {
      type: 'TRANSCRIPT_FINALIZED';
      role: 'user' | 'assistant';
    }
  // Instructions refresh (from 'instructions' event)
  | {
      type: 'INSTRUCTIONS_UPDATED';
      phase: string | null;
      outstandingGate: string[];
    }
  // Encounter state updates (from updateEncounterState method)
  | {
      type: 'ENCOUNTER_STATE_UPDATED';
      phase?: string | null;
      gate?: Record<string, unknown> | null;
    }
  // Debug mode toggle
  | {
      type: 'DEBUG_TOGGLED';
      enabled: boolean;
    }
  // Configuration updates (from config effect)
  | {
      type: 'SESSION_ID_CONFIGURED';
      sessionId: string | null;
    }
  // Full state reset (for cleanup/unmount)
  | {
      type: 'RESET';
      initialState: VoiceSessionState;
    };

/**
 * Pure reducer function - handles all state transitions
 * 
 * @param state - Current state
 * @param action - Action describing the state change
 * @returns New state (immutable)
 */
export function voiceSessionReducer(
  state: VoiceSessionState,
  action: VoiceSessionAction
): VoiceSessionState {
  switch (action.type) {
    case 'STATUS_CHANGED':
      return {
        ...state,
        status: action.status,
        error: action.error,
        micStream: action.micStream,
        peerConnection: action.peerConnection,
      };

    case 'SESSION_CREATED':
      return {
        ...state,
        sessionId: action.sessionId,
        encounter: action.encounter,
      };

    case 'USER_PARTIAL':
      return {
        ...state,
        userPartial: action.text,
      };

    case 'ASSISTANT_PARTIAL':
      return {
        ...state,
        assistantPartial: action.text,
      };

    case 'MIC_LEVEL_UPDATED':
      return {
        ...state,
        micLevel: action.level,
        adaptive: action.adaptive,
      };

    case 'MIC_PAUSED':
      return {
        ...state,
        micPaused: action.paused,
      };

    case 'TRANSCRIPT_FINALIZED':
      // Clear the appropriate partial when transcript is finalized
      return action.role === 'user'
        ? { ...state, userPartial: '' }
        : { ...state, assistantPartial: '' };

    case 'INSTRUCTIONS_UPDATED':
      return {
        ...state,
        encounter: {
          ...state.encounter,
          phase: action.phase,
          outstandingGate: action.outstandingGate,
        },
      };

    case 'ENCOUNTER_STATE_UPDATED': {
      const updates: Partial<VoiceSessionState['encounter']> = {};
      
      if (Object.prototype.hasOwnProperty.call(action, 'phase')) {
        updates.phase = action.phase ?? null;
      }
      
      if (Object.prototype.hasOwnProperty.call(action, 'gate')) {
        updates.gate = action.gate ? { ...action.gate } : null;
      }
      
      return {
        ...state,
        encounter: {
          ...state.encounter,
          ...updates,
        },
      };
    }

    case 'DEBUG_TOGGLED':
      return {
        ...state,
        debugEnabled: action.enabled,
      };

    case 'SESSION_ID_CONFIGURED':
      return {
        ...state,
        sessionId: action.sessionId,
      };

    case 'RESET':
      return action.initialState;

    default:
      // Exhaustiveness check - TypeScript will error if we missed a case
      return state;
  }
}

/**
 * Create initial state from ConversationController snapshot
 * 
 * @param controller - ConversationController instance
 * @returns Initial state object
 */
export function createInitialState(controller: {
  getSnapshot: () => {
    status: VoiceStatus;
    error: string | null;
    sessionId: string | null;
    userPartial: string;
    assistantPartial: string;
    micLevel: number;
  };
  getEncounterState: () => {
    phase: string | null;
    gate: Record<string, unknown> | null;
    outstandingGate: string[];
  };
  getAdaptiveSnapshot: () => VoiceSessionState['adaptive'];
  isDebugEnabled: () => boolean;
  isMicPaused?: () => boolean;
  getMicStream: () => MediaStream | null;
  getPeerConnection: () => RTCPeerConnection | null;
}): VoiceSessionState {
  const snapshot = controller.getSnapshot();
  const encounter = controller.getEncounterState();
  const adaptive = controller.getAdaptiveSnapshot();

  return {
    status: snapshot.status,
    error: snapshot.error,
    sessionId: snapshot.sessionId,
    userPartial: snapshot.userPartial,
    assistantPartial: snapshot.assistantPartial,
    micLevel: snapshot.micLevel,
    micPaused: controller.isMicPaused?.() ?? false,
    micStream: controller.getMicStream(),
    peerConnection: controller.getPeerConnection(),
    encounter: {
      phase: encounter.phase,
      gate: encounter.gate,
      outstandingGate: encounter.outstandingGate,
    },
    adaptive,
    debugEnabled: controller.isDebugEnabled(),
  };
}
