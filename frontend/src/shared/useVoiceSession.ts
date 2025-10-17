import { MutableRefObject, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ConversationController, InstructionRefreshOptions } from './ConversationController';
import type { ConversationEvent, VoiceDebugEvent, VoiceStatus, MediaReference } from './types';
import type { TranscriptTimings } from './transcript/TranscriptEngine';
import { recordVoiceEvent } from './telemetry';
import { voiceSessionReducer, createInitialState } from './useVoiceSession/reducer';
import { useBackendSocket } from './hooks/useBackendSocket';
import type { BackendSocketClient, SocketConfig, SocketEventHandlers } from './services/BackendSocketManager';

export interface VoiceSessionOptions {
  personaId: string | null;
  sessionId?: string | null;
  scenarioId?: string | null;
  scenarioMedia?: MediaReference[];
  onUserTranscript?: (
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    media?: MediaReference
  ) => void;
  onAssistantTranscript?: (
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    media?: MediaReference
  ) => void;
  onEvent?: (payload: unknown) => void;
  debugEnabled?: boolean;
  voice?: string | null;
  inputLanguage?: 'auto' | (string & {});
  replyLanguage?: 'default' | (string & {});
}

export interface VoiceSessionHandle {
  status: VoiceStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  sendText?: (text: string) => Promise<void>;
  refreshInstructions: (reason?: string, options?: InstructionRefreshOptions) => Promise<void>;
  remoteAudioRef: MutableRefObject<HTMLAudioElement | null>;
  sessionId: string | null;
  userPartial: string;
  assistantPartial: string;
  micLevel: number;
  debugEnabled: boolean;
  micPaused: boolean;
  micStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  encounterPhase: string | null;
  encounterGate: Record<string, unknown> | null;
  outstandingGate: string[];
  adaptive: {
    enabled: boolean;
    status: 'quiet' | 'noisy' | 'very-noisy';
    noise: number;
    snr: number;
    threshold: number | null;
    silenceMs: number | null;
  };
  updateEncounterState: (
    state: { phase?: string | null; gate?: Record<string, unknown> | null },
    reason?: string
  ) => void;
  addEventListener: (listener: (e: VoiceDebugEvent) => void) => () => void;
  addConversationListener: (listener: (e: ConversationEvent) => void) => () => void;
}

export function useVoiceSession(options: VoiceSessionOptions): VoiceSessionHandle {
  const [socketConfig, setSocketConfig] = useState<SocketConfig>(() => ({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
    enabled: true,
    maxFailures: 3,
  }));
  const [socketHandlers, setSocketHandlers] = useState<SocketEventHandlers>({});
  const backendSocket = useBackendSocket({ sessionId: null, config: socketConfig, handlers: socketHandlers });
  const backendSocketRef = useRef(backendSocket);
  backendSocketRef.current = backendSocket;
  const backendSocketClient = useMemo<BackendSocketClient>(() => ({
    connect(sessionId: string) {
      backendSocketRef.current.connect(sessionId);
    },
    disconnect() {
      backendSocketRef.current.disconnect();
    },
    isEnabled() {
      return backendSocketRef.current.getSnapshot().isEnabled;
    },
    setEnabled(enabled: boolean) {
      backendSocketRef.current.setEnabled?.(enabled);
    },
    joinSession(sessionId: string) {
      backendSocketRef.current.joinSession?.(sessionId);
    },
    requestCatchup(sessionId: string, since?: number) {
      backendSocketRef.current.requestCatchup?.(sessionId, since);
    },
    resetFailureCount() {
      backendSocketRef.current.resetFailureCount?.();
    },
    updateLastReceivedTimestamp(timestamp: number) {
      backendSocketRef.current.updateLastReceivedTimestamp?.(timestamp);
    },
    getSnapshot() {
      return backendSocketRef.current.getSnapshot?.() ?? backendSocketRef.current.getSnapshot();
    },
  }), []);
  const pendingSocketSetupRef = useRef<{ config: SocketConfig; handlers: SocketEventHandlers } | null>(null);
  const applyPendingSocketSetup = useCallback(() => {
    const next = pendingSocketSetupRef.current;
    if (!next) return;
    pendingSocketSetupRef.current = null;
    setSocketConfig(next.config);
    setSocketHandlers(next.handlers);
  }, [setSocketConfig, setSocketHandlers]);

  const controllerRef = useRef<ConversationController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new ConversationController({
      personaId: options.personaId ?? null,
      scenarioId: options.scenarioId ?? null,
      sessionId: options.sessionId ?? null,
      scenarioMedia: options.scenarioMedia ?? [],
      debugEnabled: options.debugEnabled,
      backendTranscriptMode: true,
      socketFactory: ({ config, handlers }) => {
        pendingSocketSetupRef.current = { config, handlers };
        return backendSocketClient;
      },
    });
  }
  const controller = controllerRef.current!;

  useEffect(() => {
    applyPendingSocketSetup();
  }, [applyPendingSocketSetup]);

  // Phase 3+: Consolidated state management with useReducer
  // Replaces 15 separate useState calls with single atomic state object
  // Benefits: atomic updates, predictable transitions, easier debugging, fewer re-renders
  // See: REFACTORING_OPPORTUNITIES.md #3
  const [state, dispatch] = useReducer(
    voiceSessionReducer,
    controller,
    createInitialState
  );

  const onUserTranscriptRef = useRef<VoiceSessionOptions['onUserTranscript']>(options.onUserTranscript);
  const onAssistantTranscriptRef = useRef<VoiceSessionOptions['onAssistantTranscript']>(options.onAssistantTranscript);

  useEffect(() => {
    onUserTranscriptRef.current = options.onUserTranscript;
  }, [options.onUserTranscript]);

  useEffect(() => {
    onAssistantTranscriptRef.current = options.onAssistantTranscript;
  }, [options.onAssistantTranscript]);

  // Phase 3: Consolidated configuration effect
  // Batches all related controller updates into a single effect to reduce overhead
  // and provide centralized logging for voice session configuration changes
  useEffect(() => {
    const config = {
      personaId: options.personaId ?? null,
      scenarioId: options.scenarioId ?? null,
      scenarioMedia: options.scenarioMedia ?? [],
      sessionId: options.sessionId ?? null,
      voice: options.voice ?? null,
      inputLanguage: options.inputLanguage ?? 'en-US',
      replyLanguage: options.replyLanguage ?? 'en-US',
    };

    // Batch all controller configuration updates
    controller.setPersonaId(config.personaId);
    controller.setScenarioId(config.scenarioId);
    controller.setScenarioMedia?.(config.scenarioMedia);
    controller.setExternalSessionId(config.sessionId);
    dispatch({ type: 'SESSION_ID_CONFIGURED', sessionId: config.sessionId });
    
    // Advanced overrides
    controller.setVoiceOverride(config.voice);
    controller.setInputLanguage(config.inputLanguage);
    controller.setReplyLanguage(config.replyLanguage);

    // Consolidated debug logging
    if (import.meta.env.DEV) {
      console.debug('[useVoiceSession] Configuration updated:', {
        personaId: config.personaId,
        scenarioId: config.scenarioId,
        mediaCount: config.scenarioMedia.length,
        sessionId: config.sessionId,
        voice: config.voice,
        inputLanguage: config.inputLanguage,
        replyLanguage: config.replyLanguage,
      });
    }
  }, [
    controller,
    options.personaId,
    options.scenarioId,
    options.scenarioMedia,
    options.sessionId,
    options.voice,
    options.inputLanguage,
    options.replyLanguage,
  ]);

  useEffect(() => {
    controller.setRealtimeEventListener();
    return () => {
      controller.setRealtimeEventListener();
    };
  }, [controller, options.onEvent]);

  useEffect(() => {
    if (options.debugEnabled === undefined) return;
    controller.setDebugEnabled(Boolean(options.debugEnabled));
    dispatch({ type: 'DEBUG_TOGGLED', enabled: controller.isDebugEnabled() });
  }, [controller, options.debugEnabled]);

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    const listener = (event: ConversationEvent) => {
      switch (event.type) {
        case 'status':
          dispatch({
            type: 'STATUS_CHANGED',
            status: event.status,
            error: event.error,
            micStream: controller.getMicStream(),
            peerConnection: controller.getPeerConnection(),
          });
          recordVoiceEvent({
            type: 'status',
            status: event.status,
            error: event.error,
            sessionId: controller.getSessionId(),
          });
          break;
        case 'session':
          dispatch({
            type: 'SESSION_CREATED',
            sessionId: event.sessionId,
            encounter: controller.getEncounterState(),
          });
          break;
        case 'partial':
          dispatch({
            type: event.role === 'user' ? 'USER_PARTIAL' : 'ASSISTANT_PARTIAL',
            text: event.text,
          });
          break;
        case 'mic-level':
          dispatch({
            type: 'MIC_LEVEL_UPDATED',
            level: event.level,
            adaptive: controller.getAdaptiveSnapshot(),
          });
          break;
        case 'pause':
          dispatch({
            type: 'MIC_PAUSED',
            paused: event.paused,
          });
          break;
        case 'transcript': {
          if (event.isFinal) {
            dispatch({
              type: 'TRANSCRIPT_FINALIZED',
              role: event.role,
            });
          }
          const callback = event.role === 'user' ? onUserTranscriptRef.current : onAssistantTranscriptRef.current;
          callback?.(event.text, event.isFinal, event.timestamp, event.timings, event.media);
          if (event.isFinal) {
            recordVoiceEvent({
              type: 'transcript',
              role: event.role,
              text: event.text,
              isFinal: true,
              timestamp: event.timestamp,
              timings: event.timings,
              sessionId: controller.getSessionId(),
            });
          }
          break;
        }
        case 'instructions':
          dispatch({
            type: 'INSTRUCTIONS_UPDATED',
            phase: event.phase ?? null,
            outstandingGate: event.outstandingGate ?? [],
          });
          break;
      }
    };
    return controller.addListener(listener);
  }, [controller]);

  const remoteAudioRef = useMemo<MutableRefObject<HTMLAudioElement | null>>(() => {
    const holder: { current: HTMLAudioElement | null } = { current: null };
    Object.defineProperty(holder, 'current', {
      get: () => controller.getRemoteAudioElement(),
      set: (value: HTMLAudioElement | null) => {
        controller.attachRemoteAudioElement(value);
      },
      configurable: true,
      enumerable: true,
    });
    return holder as MutableRefObject<HTMLAudioElement | null>;
  }, [controller]);

  const start = useCallback(async () => {
    recordVoiceEvent({ type: 'start-request', personaId: options.personaId, scenarioId: options.scenarioId });
    try {
      await controller.startVoice();
      recordVoiceEvent({ type: 'start-success', sessionId: controller.getSessionId() });
    } catch (err) {
      recordVoiceEvent({
        type: 'start-error',
        error: err instanceof Error ? err.message : String(err),
        sessionId: controller.getSessionId(),
      });
      throw err;
    }
  }, [controller, options.personaId, options.scenarioId]);

  const stop = useCallback(() => {
    recordVoiceEvent({ type: 'stop', sessionId: controller.getSessionId() });
    controller.stopVoice();
  }, [controller]);

  const pause = useCallback(() => {
    controller.setMicPaused?.(true);
  }, [controller]);
  const resume = useCallback(() => {
    controller.setMicPaused?.(false);
  }, [controller]);

  const sendText = useCallback(
    (text: string) => {
      recordVoiceEvent({ type: 'send-text', length: text.length, sessionId: controller.getSessionId() });
      return controller.sendText(text);
    },
    [controller]
  );

  const refreshInstructions = useCallback(
    (reason?: string, options?: InstructionRefreshOptions) => {
      return controller.refreshInstructions(reason, options);
    },
    [controller]
  );

  const updateEncounterState = useCallback(
    (encounterUpdate: { phase?: string | null; gate?: Record<string, unknown> | null }, reason?: string) => {
      dispatch({
        type: 'ENCOUNTER_STATE_UPDATED',
        phase: encounterUpdate.phase,
        gate: encounterUpdate.gate,
      });
      controller.updateEncounterState(encounterUpdate, reason);
    },
    [controller]
  );

  const addEventListener = useCallback(
    (listener: (e: VoiceDebugEvent) => void) => {
      return controller.addDebugListener(listener);
    },
    [controller]
  );

  const addConversationListener = useCallback(
    (listener: (e: ConversationEvent) => void) => {
      return controller.addListener(listener);
    },
    [controller]
  );

  return {
    status: state.status,
    error: state.error,
    start,
    stop,
    pause,
    resume,
    sendText,
    refreshInstructions,
    remoteAudioRef,
    sessionId: state.sessionId,
    userPartial: state.userPartial,
    assistantPartial: state.assistantPartial,
    micLevel: state.micLevel,
    debugEnabled: state.debugEnabled,
    micPaused: state.micPaused,
    micStream: state.micStream,
    peerConnection: state.peerConnection,
    encounterPhase: state.encounter.phase,
    encounterGate: state.encounter.gate,
    outstandingGate: state.encounter.outstandingGate,
    adaptive: state.adaptive,
    updateEncounterState,
    addEventListener,
    addConversationListener,
  };
}
