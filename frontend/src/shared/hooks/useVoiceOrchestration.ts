import { useCallback, useEffect, useRef } from 'react';
import type { VoiceSessionHandle } from '../useVoiceSession';
import type { MediaReference } from '../../shared/types';
import type { ConnectionProgress } from './useConnectionProgress';

const connectionProgressSteps = [
  'mic',
  'session',
  'token',
  'webrtc',
  'complete',
] as const satisfies ConnectionProgress['step'][];

function isConnectionProgressStep(step: unknown): step is ConnectionProgress['step'] {
  return typeof step === 'string' && connectionProgressSteps.includes(step as ConnectionProgress['step']);
}

interface UseVoiceOrchestrationOptions {
  voiceSession: VoiceSessionHandle;
  resetAllTrackingState: (options?: { clearQueue?: boolean; resetFirstDelta?: boolean }) => void;
  setTtftMs: (value: number | null) => void;
  setLatestInstructions: (instructions: string) => void;
  setConnectionProgress: (progress: ConnectionProgress | null) => void;
  clearConnectionProgress: () => void;
  showVoiceReady: () => void;
}

interface UseVoiceOrchestrationHandlersOptions {
  updateVoiceMessage: (role: 'user' | 'assistant', text: string, isFinal: boolean, timestamp: number, media?: MediaReference, options?: { source?: 'live' | 'catchup' }) => void;
  updateAssistantTextMessage: (text: string, isFinal: boolean, timestamp: number, media?: MediaReference, options?: { source?: 'live' | 'catchup' }) => void;
  showVoiceReadyToast: boolean;
  dismissVoiceReadyToast: () => void;
}

/**
 * Creates transcript handler callbacks for voice session.
 * These handlers update messages and dismiss toasts when transcripts arrive.
 */
export function useVoiceTranscriptHandlers(options: UseVoiceOrchestrationHandlersOptions) {
  const { updateVoiceMessage, updateAssistantTextMessage, showVoiceReadyToast, dismissVoiceReadyToast } = options;

  // Handle user transcript updates from voice session
  const handleUserTranscript = useCallback(
    (text: string, isFinal: boolean, timestamp: number, _timings?: unknown, media?: MediaReference, source?: 'live' | 'catchup') => {
      updateVoiceMessage('user', text, isFinal, timestamp, media, { source });

      // Dismiss voice ready toast when user starts speaking
      if (showVoiceReadyToast) {
        dismissVoiceReadyToast();
      }
    },
    [updateVoiceMessage, showVoiceReadyToast, dismissVoiceReadyToast]
  );

  // Handle assistant transcript updates from voice session
  const handleAssistantTranscript = useCallback(
    (text: string, isFinal: boolean, timestamp: number, _timings?: unknown, media?: MediaReference, source?: 'live' | 'catchup') => {
      updateAssistantTextMessage(text, isFinal, timestamp, media, { source });
    },
    [updateAssistantTextMessage]
  );

  return {
    handleUserTranscript,
    handleAssistantTranscript,
  };
}

/**
 * Custom hook to set up voice session event listeners and effects.
 * Handles status changes, session reuse detection, and connection events.
 *
 * @param options - Configuration object containing voice session and callback functions
 */
export function useVoiceOrchestration(options: UseVoiceOrchestrationOptions) {
  const {
    voiceSession,
    resetAllTrackingState,
    setTtftMs,
    setLatestInstructions,
    setConnectionProgress,
    clearConnectionProgress,
    showVoiceReady,
  } = options;

  const prevVoiceStatusRef = useRef<string>('idle');

  // Reset tracking state when voice session status changes
  useEffect(() => {
    const prevStatus = prevVoiceStatusRef.current;
    const currentStatus = voiceSession.status;
    prevVoiceStatusRef.current = currentStatus;

    const prevWasActive = prevStatus === 'connecting' || prevStatus === 'connected';
    const startingFresh = currentStatus === 'connecting' && !prevWasActive;
    const endingSession = (currentStatus === 'idle' || currentStatus === 'error') && prevWasActive;

    if (startingFresh) {
      resetAllTrackingState({ resetFirstDelta: true });
      setTtftMs(null);
    } else if (endingSession) {
      resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
    }
  }, [voiceSession.status, resetAllTrackingState, setTtftMs]);

  // Handle session reuse detection
  useEffect(() => {
    const off = voiceSession.addEventListener((e: any) => {
      if (e.msg === 'session.reuse.detected') {
        resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
        setTtftMs(null);
      }
    });
    return off;
    // Intentionally subscribe once; addEventListener is stable and controller persists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for conversation events (progress, stream ready, instructions, etc.)
  useEffect(() => {
    const off = voiceSession.addConversationListener((e: any) => {
      if (e.type === 'instructions') {
        setLatestInstructions(e.instructions ?? '');
        return;
      }
      if (e.type === 'connection-progress' && isConnectionProgressStep(e.step)) {
        setConnectionProgress({
          step: e.step,
          progress: e.progress,
          estimatedMs: e.estimatedMs,
        });
      }

      // Clear progress only when controller reports step=complete
      if (e.type === 'connection-progress' && e.step === 'complete') {
        // small delay for nicer UX
        setTimeout(() => clearConnectionProgress(), 500);
      }

      // Show voice ready toast when connection is established
      if (e.type === 'voice-ready') {
        showVoiceReady();
      }

      // Reset progress on error
      if (e.type === 'status' && e.status === 'error') {
        clearConnectionProgress();
      }
    });
    return off;
  }, [voiceSession, setLatestInstructions, setConnectionProgress, clearConnectionProgress, showVoiceReady]);
}
