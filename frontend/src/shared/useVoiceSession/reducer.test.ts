/**
 * Voice Session Reducer Tests
 * 
 * Tests the pure reducer function in isolation to ensure all state transitions
 * are correct and predictable. This is critical for the migration from 15 useState
 * calls to a single useReducer.
 * 
 * Part of: REFACTORING_OPPORTUNITIES.md #3 (useVoiceSession Reducer)
 * Date: October 16, 2025
 */

import { describe, it, expect } from 'vitest';
import { voiceSessionReducer, createInitialState, type VoiceSessionState } from './reducer';

// Helper to create a minimal initial state for testing
const createTestState = (overrides?: Partial<VoiceSessionState>): VoiceSessionState => ({
  status: 'idle',
  error: null,
  sessionId: null,
  userPartial: '',
  assistantPartial: '',
  micLevel: 0,
  micPaused: false,
  micStream: null,
  peerConnection: null,
  encounter: {
    phase: null,
    gate: null,
    outstandingGate: [],
  },
  adaptive: {
    enabled: false,
    status: 'quiet',
    noise: 0,
    snr: 100,
    threshold: null,
    silenceMs: null,
  },
  debugEnabled: false,
  ...overrides,
});

describe('voiceSessionReducer', () => {
  describe('STATUS_CHANGED', () => {
    it('updates status, error, micStream, and peerConnection atomically', () => {
      const initialState = createTestState();
      const mockStream = {} as MediaStream;
      const mockConnection = {} as RTCPeerConnection;

      const newState = voiceSessionReducer(initialState, {
        type: 'STATUS_CHANGED',
        status: 'connected',
        error: null,
        micStream: mockStream,
        peerConnection: mockConnection,
      });

      expect(newState.status).toBe('connected');
      expect(newState.error).toBe(null);
      expect(newState.micStream).toBe(mockStream);
      expect(newState.peerConnection).toBe(mockConnection);
      // Other state should be unchanged
      expect(newState.userPartial).toBe('');
      expect(newState.debugEnabled).toBe(false);
    });

    it('handles error state', () => {
      const initialState = createTestState({ status: 'connecting' });

      const newState = voiceSessionReducer(initialState, {
        type: 'STATUS_CHANGED',
        status: 'error',
        error: 'Connection failed',
        micStream: null,
        peerConnection: null,
      });

      expect(newState.status).toBe('error');
      expect(newState.error).toBe('Connection failed');
    });
  });

  describe('SESSION_CREATED', () => {
    it('updates sessionId and entire encounter state atomically', () => {
      const initialState = createTestState();
      const encounterData = {
        phase: 'greeting',
        gate: { step: 1 },
        outstandingGate: ['verify-identity'],
      };

      const newState = voiceSessionReducer(initialState, {
        type: 'SESSION_CREATED',
        sessionId: 'test-session-123',
        encounter: encounterData,
      });

      expect(newState.sessionId).toBe('test-session-123');
      expect(newState.encounter).toEqual(encounterData);
    });
  });

  describe('Partial transcripts', () => {
    it('USER_PARTIAL updates user partial only', () => {
      const initialState = createTestState({
        assistantPartial: 'Hello',
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'USER_PARTIAL',
        text: 'Hi there',
      });

      expect(newState.userPartial).toBe('Hi there');
      expect(newState.assistantPartial).toBe('Hello'); // Unchanged
    });

    it('ASSISTANT_PARTIAL updates assistant partial only', () => {
      const initialState = createTestState({
        userPartial: 'Hi there',
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'ASSISTANT_PARTIAL',
        text: 'Hello, how can I help',
      });

      expect(newState.assistantPartial).toBe('Hello, how can I help');
      expect(newState.userPartial).toBe('Hi there'); // Unchanged
    });
  });

  describe('MIC_LEVEL_UPDATED', () => {
    it('updates mic level and adaptive state atomically', () => {
      const initialState = createTestState();
      const adaptiveData = {
        enabled: true,
        status: 'noisy' as const,
        noise: 50,
        snr: 15,
        threshold: 0.5,
        silenceMs: 300,
      };

      const newState = voiceSessionReducer(initialState, {
        type: 'MIC_LEVEL_UPDATED',
        level: 0.75,
        adaptive: adaptiveData,
      });

      expect(newState.micLevel).toBe(0.75);
      expect(newState.adaptive).toEqual(adaptiveData);
    });
  });

  describe('MIC_PAUSED', () => {
    it('updates mic paused state', () => {
      const initialState = createTestState({ micPaused: false });

      const newState = voiceSessionReducer(initialState, {
        type: 'MIC_PAUSED',
        paused: true,
      });

      expect(newState.micPaused).toBe(true);
    });
  });

  describe('TRANSCRIPT_FINALIZED', () => {
    it('clears user partial when user transcript finalized', () => {
      const initialState = createTestState({
        userPartial: 'Some partial text',
        assistantPartial: 'Some other text',
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'TRANSCRIPT_FINALIZED',
        role: 'user',
      });

      expect(newState.userPartial).toBe('');
      expect(newState.assistantPartial).toBe('Some other text'); // Unchanged
    });

    it('clears assistant partial when assistant transcript finalized', () => {
      const initialState = createTestState({
        userPartial: 'Some partial text',
        assistantPartial: 'Some other text',
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'TRANSCRIPT_FINALIZED',
        role: 'assistant',
      });

      expect(newState.assistantPartial).toBe('');
      expect(newState.userPartial).toBe('Some partial text'); // Unchanged
    });
  });

  describe('INSTRUCTIONS_UPDATED', () => {
    it('updates phase and outstanding gate', () => {
      const initialState = createTestState({
        encounter: {
          phase: 'greeting',
          gate: { step: 1 },
          outstandingGate: [],
        },
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'INSTRUCTIONS_UPDATED',
        phase: 'assessment',
        outstandingGate: ['check-vitals', 'review-history'],
      });

      expect(newState.encounter.phase).toBe('assessment');
      expect(newState.encounter.outstandingGate).toEqual(['check-vitals', 'review-history']);
      expect(newState.encounter.gate).toEqual({ step: 1 }); // Unchanged
    });
  });

  describe('ENCOUNTER_STATE_UPDATED', () => {
    it('updates only phase when phase provided', () => {
      const initialState = createTestState({
        encounter: {
          phase: 'greeting',
          gate: { step: 1 },
          outstandingGate: ['task-1'],
        },
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'ENCOUNTER_STATE_UPDATED',
        phase: 'assessment',
      });

      expect(newState.encounter.phase).toBe('assessment');
      expect(newState.encounter.gate).toEqual({ step: 1 }); // Unchanged
      expect(newState.encounter.outstandingGate).toEqual(['task-1']); // Unchanged
    });

    it('updates only gate when gate provided', () => {
      const initialState = createTestState({
        encounter: {
          phase: 'greeting',
          gate: { step: 1 },
          outstandingGate: ['task-1'],
        },
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'ENCOUNTER_STATE_UPDATED',
        gate: { step: 2, substep: 'a' },
      });

      expect(newState.encounter.phase).toBe('greeting'); // Unchanged
      expect(newState.encounter.gate).toEqual({ step: 2, substep: 'a' });
      expect(newState.encounter.outstandingGate).toEqual(['task-1']); // Unchanged
    });

    it('updates both phase and gate when both provided', () => {
      const initialState = createTestState({
        encounter: {
          phase: 'greeting',
          gate: { step: 1 },
          outstandingGate: ['task-1'],
        },
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'ENCOUNTER_STATE_UPDATED',
        phase: 'assessment',
        gate: { step: 2 },
      });

      expect(newState.encounter.phase).toBe('assessment');
      expect(newState.encounter.gate).toEqual({ step: 2 });
    });

    it('handles null gate correctly', () => {
      const initialState = createTestState({
        encounter: {
          phase: 'greeting',
          gate: { step: 1 },
          outstandingGate: [],
        },
      });

      const newState = voiceSessionReducer(initialState, {
        type: 'ENCOUNTER_STATE_UPDATED',
        gate: null,
      });

      expect(newState.encounter.gate).toBe(null);
    });
  });

  describe('DEBUG_TOGGLED', () => {
    it('toggles debug enabled state', () => {
      const initialState = createTestState({ debugEnabled: false });

      const newState = voiceSessionReducer(initialState, {
        type: 'DEBUG_TOGGLED',
        enabled: true,
      });

      expect(newState.debugEnabled).toBe(true);
    });
  });

  describe('SESSION_ID_CONFIGURED', () => {
    it('updates session ID from configuration', () => {
      const initialState = createTestState({ sessionId: null });

      const newState = voiceSessionReducer(initialState, {
        type: 'SESSION_ID_CONFIGURED',
        sessionId: 'config-session-456',
      });

      expect(newState.sessionId).toBe('config-session-456');
    });
  });

  describe('RESET', () => {
    it('completely replaces state with initial state', () => {
      const dirtyState = createTestState({
        status: 'connected',
        error: 'Some error',
        sessionId: 'old-session',
        userPartial: 'partial text',
        micLevel: 0.8,
        debugEnabled: true,
      });

      const freshState = createTestState();

      const newState = voiceSessionReducer(dirtyState, {
        type: 'RESET',
        initialState: freshState,
      });

      expect(newState).toEqual(freshState);
    });
  });

  describe('Immutability', () => {
    it('does not mutate original state', () => {
      const initialState = createTestState({
        userPartial: 'original',
        encounter: {
          phase: 'original-phase',
          gate: { key: 'value' },
          outstandingGate: ['task-1'],
        },
      });

      const stateCopy = JSON.parse(JSON.stringify(initialState));

      voiceSessionReducer(initialState, {
        type: 'USER_PARTIAL',
        text: 'modified',
      });

      expect(initialState).toEqual(stateCopy);
    });

    it('creates new encounter object on update', () => {
      const initialState = createTestState();
      const originalEncounter = initialState.encounter;

      const newState = voiceSessionReducer(initialState, {
        type: 'ENCOUNTER_STATE_UPDATED',
        phase: 'new-phase',
      });

      expect(newState.encounter).not.toBe(originalEncounter);
    });
  });
});

describe('createInitialState', () => {
  it('creates state from controller snapshot', () => {
    const mockController = {
      getSnapshot: () => ({
        status: 'connected' as const,
        error: null,
        sessionId: 'test-123',
        userPartial: 'hello',
        assistantPartial: 'hi there',
        micLevel: 0.5,
      }),
      getEncounterState: () => ({
        phase: 'greeting',
        gate: { step: 1 },
        outstandingGate: ['verify'],
      }),
      getAdaptiveSnapshot: () => ({
        enabled: true,
        status: 'quiet' as const,
        noise: 10,
        snr: 80,
        threshold: 0.3,
        silenceMs: 200,
      }),
      isDebugEnabled: () => true,
      isMicPaused: () => false,
      getMicStream: () => null,
      getPeerConnection: () => null,
    };

    const state = createInitialState(mockController);

    expect(state).toEqual({
      status: 'connected',
      error: null,
      sessionId: 'test-123',
      userPartial: 'hello',
      assistantPartial: 'hi there',
      micLevel: 0.5,
      micPaused: false,
      micStream: null,
      peerConnection: null,
      encounter: {
        phase: 'greeting',
        gate: { step: 1 },
        outstandingGate: ['verify'],
      },
      adaptive: {
        enabled: true,
        status: 'quiet',
        noise: 10,
        snr: 80,
        threshold: 0.3,
        silenceMs: 200,
      },
      debugEnabled: true,
    });
  });

  it('handles missing isMicPaused method', () => {
    const mockController = {
      getSnapshot: () => ({
        status: 'idle' as const,
        error: null,
        sessionId: null,
        userPartial: '',
        assistantPartial: '',
        micLevel: 0,
      }),
      getEncounterState: () => ({
        phase: null,
        gate: null,
        outstandingGate: [],
      }),
      getAdaptiveSnapshot: () => ({
        enabled: false,
        status: 'quiet' as const,
        noise: 0,
        snr: 100,
        threshold: null,
        silenceMs: null,
      }),
      isDebugEnabled: () => false,
      getMicStream: () => null,
      getPeerConnection: () => null,
      // isMicPaused is optional
    };

    const state = createInitialState(mockController);

    expect(state.micPaused).toBe(false); // Defaults to false
  });
});
