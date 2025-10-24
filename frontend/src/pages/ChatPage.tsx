import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import VoiceControls from './components/VoiceControls';
import CaseSetupHeader from './components/CaseSetupHeader';
import { api } from '../shared/api.ts';
import { featureFlags, FLAGS } from '../shared/flags.ts';

import { useVoiceSession } from '../shared/useVoiceSession';
import { Message, newId } from './chatShared';
import type { MediaReference } from '../shared/types';
import { useAdvancedSettings } from '../shared/settingsContext';
import AdvancedSettingsDrawer from './components/AdvancedSettingsDrawer';
import { ChatView } from './components/ChatView';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import SessionEvaluationModal from './components/chat/SessionEvaluationModal';
import { VoiceReadyToast } from './components/VoiceReadyToast';
import { MediaModal } from './components/chat/MediaModal';
import Viewer3D from './Viewer3D';
import { useAnimationAutoTrigger } from '../shared/hooks/useAnimationAutoTrigger';
import {
  useBackendData,
  useUIState,
  useConnectionProgress,
  useMessageQueue,
  useVoiceTranscripts,
  useMessageManager,
  useScenarioMedia,
  useDiagnostics,
  useVoiceOrchestration,
  useVoiceTranscriptHandlers,
  usePrintActions,
  useVoiceAutostart,
  usePartialClearing,
  useUIEffects,
} from '../shared/hooks';

export default function ChatPage() {

  // Backend data (personas, scenarios, health) managed by custom hook
  const { personas, scenarios, backendOk, health, runtimeFeatures } = useBackendData();

  const [personaId, setPersonaId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string>('');
  const [spsError, setSpsError] = useState<string | null>(null);
  const [latestInstructions, setLatestInstructions] = useState('');
  const [audience, setAudience] = useState<'student' | 'faculty'>('student');

  // UI state (drawers, dropdowns, modals) managed by custom hook
  const uiState = useUIState();

  // Connection progress and voice ready toast managed by custom hook
  const {
    connectionProgress,
    setConnectionProgress,
    clearConnectionProgress,
    showVoiceReadyToast,
    dismissVoiceReadyToast,
    showVoiceReady,
  } = useConnectionProgress();

  // Message queue for batched updates
  const { queueMessageUpdate, clearQueue } = useMessageQueue();

  // Voice transcript management with deduplication
  const handlePersistenceError = useCallback<Dispatch<SetStateAction<{ message: string; timestamp: number } | null>>>(
    next => {
      const resolved = typeof next === 'function' ? next(uiState.persistenceError) : next;

      if (resolved) {
        uiState.showPersistenceError(resolved.message);
      } else {
        uiState.clearPersistenceError();
      }
    },
    [uiState]
  );

  // Session state (TODO: will be managed by useSessionLifecycle)
  // IMPORTANT: activeSessionId tracks the currently running session (cleared on stop)
  // exportSessionId is preserved for transcript export after session ends
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [exportSessionId, setExportSessionId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const compositionScheduledRef = useRef(false);

  // Sync effect: Always preserve active session ID for export
  // This ensures exportSessionId is available even after activeSessionId is cleared on stop
  useEffect(() => {
    if (activeSessionId) {
      setExportSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  // Initialize message state first (needed by both hooks)
  const [messages, setMessages] = useState<Message[]>([]);
  const { updateVoiceMessage, resetVoiceTrackingState, voiceUserStartTimeRef } = useVoiceTranscripts({
    sessionId: activeSessionId,
    queueMessageUpdate,
    setMessages,
    setPersistenceError: handlePersistenceError,
  });

  // Message management (refs and operations) - extracted to custom hook
  const {
    sortedMessages,
    ttftMs,
    setTtftMs,
    messagesEndRef,
    messagesContainerRef,
    firstDeltaRef,
    textAssistantIdRef,
    textUserStartTimeRef,
    updateAssistantTextMessage,
    finalizePendingMessages,
  } = useMessageManager({
    messages,
    setMessages,
    sessionId: activeSessionId,
    queueMessageUpdate,
    updateVoiceMessage,
    voiceUserStartTimeRef,
    onPersistenceError: (message: string) => uiState.showPersistenceError(message),
  });

  const caseSetupIds = useMemo(
    () => ({
      section: `case-setup-${newId()}`,
      title: `case-setup-title-${newId()}`,
    }),
    []
  );

  // Wrapper for resetVoiceTrackingState that also handles text state and options
  const resetAllTrackingState = useCallback(
    (options?: { clearQueue?: boolean; resetFirstDelta?: boolean }) => {
      resetVoiceTrackingState();
      // Reset tracking refs (cast to mutable to satisfy TS readonly RefObject typing)
      try { (textAssistantIdRef as unknown as { current: string | null }).current = null } catch { /* ignore */ }
      try { (textUserStartTimeRef as unknown as { current: number | null }).current = null } catch { /* ignore */ }
      if (options?.resetFirstDelta) {
        try { (firstDeltaRef as unknown as { current: number | null }).current = null } catch { /* ignore */ }
      }
      if (options?.clearQueue) {
        clearQueue();
      }
    },
    [resetVoiceTrackingState, clearQueue, textAssistantIdRef, textUserStartTimeRef, firstDeltaRef]
  );

  // Scenario media loading (extracted to custom hook)
  // Defer loading until session is created to avoid premature media display
  // isLoading is available but not currently used in UI
  const { scenarioMedia } = useScenarioMedia({
    scenarioId: activeSessionId ? scenarioId : null, // Only load media after session created
    closeMedia: uiState.closeMedia,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
  }, [sortedMessages, messagesEndRef]);

  // Create transcript handlers for voice session
  const { handleUserTranscript, handleAssistantTranscript } = useVoiceTranscriptHandlers({
    updateVoiceMessage,
    updateAssistantTextMessage,
    showVoiceReadyToast,
    dismissVoiceReadyToast,
  });

  // Settings integration
  const { settings } = useAdvancedSettings();

  const voiceSession = useVoiceSession({
    personaId,
    scenarioId: scenarioId || null,
    sessionId: activeSessionId,
    scenarioMedia,
    onUserTranscript: handleUserTranscript,
    onAssistantTranscript: handleAssistantTranscript,
    // Enable debug either via flags or while the Diagnostics drawer is open; otherwise allow controller defaults
    debugEnabled: runtimeFeatures.voiceDebug || featureFlags.voiceDebug || uiState.logOpen ? true : undefined,
    voice: settings.voice,
    inputLanguage: settings.inputLanguage,
    replyLanguage: settings.replyLanguage,
  });

  // Diagnostics logging managed by custom hook
  const { logItems, handleCopyLogs } = useDiagnostics({
    voiceSession,
    runtimeFeatures,
    voiceDebugFlag: featureFlags.voiceDebug,
    logOpen: uiState.logOpen,
  });

  // Voice session orchestration (status effects and connection events)
  useVoiceOrchestration({
    voiceSession,
    resetAllTrackingState,
    setTtftMs,
    setLatestInstructions,
    setConnectionProgress,
    clearConnectionProgress,
    showVoiceReady,
  });

  // Sync voice session ID to exportSessionId for transcript access after session ends
  useEffect(() => {
    if (voiceSession.sessionId) {
      setExportSessionId(voiceSession.sessionId);
    }
  }, [voiceSession.sessionId]);

  // When audience changes, refresh instructions with the selected audience.
  useEffect(() => {
    // Fire-and-forget; the instruction sync manager will defer until session is ready.
    void voiceSession.refreshInstructions('audience.changed', { audience });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshInstructions is stable (useCallback with controller ref)
  }, [audience, voiceSession.refreshInstructions]);

  // Print/export actions managed by custom hook
  const { handleViewTranscriptPage, handlePrintTranscriptAsync, handleOpenFacultyKey } = usePrintActions({
    personaId,
    scenarioId,
    sessionId: exportSessionId ?? activeSessionId,
    printDropdownOpen: uiState.printDropdownOpen,
    closePrintDropdown: uiState.closePrintDropdown,
  });

  // Auto-start voice session after encounter creation (extracted to custom hook)
  useVoiceAutostart({
    voiceEnabled: runtimeFeatures.voiceEnabled,
    spsEnabled: runtimeFeatures.spsEnabled,
    autostartSetting: settings.autostart,
    sessionId: activeSessionId,
    isComposing,
    voiceStatus: voiceSession.status,
    startVoiceSession: voiceSession.start,
  });

  // Partial clearing effects (extracted to custom hook)
  usePartialClearing({
    userPartial: voiceSession.userPartial,
    assistantPartial: voiceSession.assistantPartial,
    queueMessageUpdate,
    setMessages,
    finalizePendingMessages,
    micPaused: voiceSession.micPaused,
    voiceStatus: voiceSession.status,
  });

  // UI effects (auto-dismiss errors, outside-click detection)
  useUIEffects({
    micActionsOpen: uiState.micActionsOpen,
    postStopOpen: uiState.postStopOpen,
    closeMicActions: uiState.closeMicActions,
    closePostStop: uiState.closePostStop,
    persistenceError: uiState.persistenceError,
    clearPersistenceError: uiState.clearPersistenceError,
  });

  const {
    updateEncounterState: updateEncounterStateRef,
    encounterPhase: sessionPhase,
    outstandingGate: sessionOutstandingGate,
  } = voiceSession;

  const instructionsPreview = useMemo(() => {
    const text = latestInstructions.trim();
    if (!text) return '';
    return text.length > 480 ? `${text.slice(0, 480)}…` : text;
  }, [latestInstructions]);

  const composeEncounter = useCallback(async () => {
    if (!personaId || !scenarioId) {
      setSpsError('Select both a persona and a scenario before starting an encounter.');
      return;
    }
    if (!runtimeFeatures.spsEnabled) {
      setSpsError('SPS encounters are currently disabled by the backend. Please retry later.');
      return;
    }
    // Prevent concurrent session creation (race condition protection)
    if (isComposing) {
      console.warn('[composeEncounter] Already composing, skipping duplicate call');
      return;
    }
    setIsComposing(true);
    setSpsError(null);
    setMessages([]);
    setTtftMs(null);
    setLatestInstructions('');
    // New encounter: clear previous export session id
    setExportSessionId(null);
  try { (firstDeltaRef as unknown as { current: number | null }).current = null } catch { /* ignore */ }
    try {
      const result = await api.createSession(personaId, scenarioId);
      setActiveSessionId(result.session_id);
      const nextPhase = typeof result.phase === 'string' ? result.phase : null;
      const nextGate =
        result && typeof result.gate === 'object' && result.gate !== null
          ? (result.gate as Record<string, unknown>)
          : null;
      updateEncounterStateRef({ phase: nextPhase, gate: nextGate }, 'encounter.composed');
    } catch (err) {
      setActiveSessionId(null);
      setSpsError(err instanceof Error ? err.message : String(err));
      updateEncounterStateRef({ phase: null, gate: null }, 'encounter.composed.error');
    } finally {
      setIsComposing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setTtftMs is a stable state setter
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, updateEncounterStateRef, firstDeltaRef, isComposing]);

  // Unified selection lifecycle effect - consolidates persona/scenario/session state management
  // Replaces 4 separate effects: personaId reset, sessionId reset, encounter reset, auto-compose
  useEffect(() => {
    // Reset all state when persona or scenario changes
    setActiveSessionId(null);
    setExportSessionId(null);
    setMessages([]);
    setSpsError(null);
    setTtftMs(null);
    setLatestInstructions('');
    resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
    updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection');
    compositionScheduledRef.current = false;

    // Session creation is now deferred until voice session starts
    // This prevents creating sessions before the user activates the mic

    // Note: Auto-compose removed - session will be created when user starts voice session

    // eslint-disable-next-line react-hooks/exhaustive-deps -- State setters and callbacks are stable
  }, [
    personaId,
    scenarioId,
    runtimeFeatures.spsEnabled,
  ]);

  const resetEncounter = useCallback(async () => {
    // Reset all state
    setActiveSessionId(null);
    setExportSessionId(null);
    setMessages([]);
    setSpsError(null);
    setTtftMs(null);
  setLatestInstructions('');
  try { (firstDeltaRef as unknown as { current: number | null }).current = null } catch { /* ignore */ }
    resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });

    // Create a new session with the same persona and scenario
    if (personaId && scenarioId && runtimeFeatures.spsEnabled) {
      await composeEncounter();
    } else {
      updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset');
    }
  }, [
    personaId,
    scenarioId,
    runtimeFeatures.spsEnabled,
    resetAllTrackingState,
    composeEncounter,
    updateEncounterStateRef,
    firstDeltaRef,
    setTtftMs,
  ]);

  // Restart same scenario and auto-start voice so the user gets the voice-ready toast and mic pill
  const restartNowWithAutoVoice = useCallback(async () => {
    await resetEncounter();
    try {
      await voiceSession.start();
    } catch {
      // Let overlay/error banners handle failures
    }
  }, [resetEncounter, voiceSession]);

  // Reset to setup pickers without auto-restarting a new session
  const resetToSetup = useCallback(() => {
    setActiveSessionId(null);
    setExportSessionId(null);
    setMessages([]);
    setSpsError(null);
    setTtftMs(null);
    setLatestInstructions('');
    try { (firstDeltaRef as unknown as { current: number | null }).current = null } catch { /* ignore */ }
    resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
    updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.to_setup');
    // Do not compose here; user will choose a scenario and press Start
  }, [resetAllTrackingState, updateEncounterStateRef, firstDeltaRef, setTtftMs, setLatestInstructions]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[voice] feature flag VOICE_ENABLED =', runtimeFeatures.voiceEnabled);
      console.debug('[voice] feature flag SPS_ENABLED =', runtimeFeatures.spsEnabled);
      console.debug('[voice] raw VITE_VOICE_ENABLED =', import.meta.env.VITE_VOICE_ENABLED);
      console.debug('[voice] FLAGS.VOICE_ENABLED =', FLAGS.VOICE_ENABLED);
    }
  }, [runtimeFeatures.voiceEnabled, runtimeFeatures.spsEnabled]);

  const isVoiceConnecting = voiceSession.status === 'connecting';

  let voiceDisabledReason: string | null = null;
  if (!runtimeFeatures.voiceEnabled) {
    voiceDisabledReason =
      'Voice mode is disabled by configuration. Update VITE_VOICE_ENABLED or backend VOICE_ENABLED to re-enable.';
  } else if (!runtimeFeatures.spsEnabled) {
    voiceDisabledReason = 'Voice is currently unavailable for SPS encounters. Check backend health configuration.';
  } else if (isComposing) {
    voiceDisabledReason = "We're composing the SPS encounter. Voice will unlock once the session is ready.";
  }
  // Note: No longer checking !sessionId - session is created when mic is clicked

  const voiceLocked = Boolean(voiceDisabledReason);
  // Allow mic activation if persona+scenario selected (session will be created on click)
  const canStartVoice = Boolean(personaId && scenarioId);
  const voiceButtonDisabled = voiceLocked || !canStartVoice || isComposing || isVoiceConnecting;
  const voiceButtonTooltip = voiceLocked
    ? (voiceDisabledReason ?? undefined)
    : !canStartVoice
      ? 'Select a persona and scenario to start'
      : isVoiceConnecting
        ? 'Voice session is connecting…'
        : undefined;

  let voiceErrorMessage: string | null = null;
  if (!voiceLocked && voiceSession.error) {
    if (voiceSession.error === 'no_microphone_support') {
      voiceErrorMessage = 'Microphone access is unavailable. Try a supported browser or enable microphone permissions.';
    } else if (/token/i.test(voiceSession.error)) {
      voiceErrorMessage = 'Could not fetch a voice token. Check backend logs or retry shortly.';
    } else if (/sdp|handshake/i.test(voiceSession.error)) {
      voiceErrorMessage = 'Voice handshake failed. Please try again.';
    } else {
      voiceErrorMessage = `Voice session error: ${voiceSession.error}`;
    }
  }

  const statusClass =
    voiceSession.status === 'connected'
      ? 'status-chip status-chip--speaking'
      : isVoiceConnecting
        ? 'status-chip status-chip--listening'
        : 'status-chip status-chip--idle';
  const selectedPersona = useMemo(() => personas.find(p => p.id === personaId) ?? null, [personas, personaId]);
  const selectedScenario = useMemo(
    () => scenarios.find(s => s.scenario_id === scenarioId) ?? null,
    [scenarios, scenarioId]
  );

  const handleMediaClick = useCallback(
    (media: MediaReference) => {
      if (media.type === 'animation') {
        // Open full-screen 3D overlay instead of modal
        uiState.openViewerOverlay(media.animationId)
        return
      }
      uiState.handleMediaClick(media);
    },
    [uiState]
  );

  // Insert assistant media message helper
  const insertAssistantMedia = useCallback((media: MediaReference) => {
    setMessages(prev => [
      ...prev,
      {
        id: newId(),
        role: 'assistant',
        text: '',
        channel: 'text',
        timestamp: Date.now(),
        media,
      },
    ])
  }, [setMessages])

  // Auto-trigger 3D animation modal from user requests (feature-flagged)
  useAnimationAutoTrigger({
    sortedMessages,
    onInsertAssistantMedia: insertAssistantMedia,
  })

  const requestReconnect = useCallback(() => {
    if (voiceSession.status === 'connected') {
      try {
        voiceSession.stop();
      } catch {
        // no-op
      }
      voiceSession.start().catch(() => {});
    }
  }, [voiceSession]);

  // Wrapper to create session before starting voice (deferred session creation)
  const handleStartVoice = useCallback(async () => {
    // Only create session if we don't have one yet
    if (!activeSessionId && personaId && scenarioId) {
      await composeEncounter();
    }
    // Start voice session (will use the newly created activeSessionId)
    return voiceSession.start();
  }, [activeSessionId, personaId, scenarioId, composeEncounter, voiceSession]);

  const renderMicControl = () => (
    <VoiceControls
      mode="mic-only"
      status={voiceSession.status}
      micPaused={voiceSession.micPaused}
      start={handleStartVoice}
      pause={() => voiceSession.pause()}
      resume={() => voiceSession.resume()}
      stop={async () => {
        // CRITICAL FIX: Capture session ID BEFORE stop() clears it
        // This prevents race condition where exportSessionId becomes null
        const sessionToFinalize = activeSessionId;

        try {
          // Stop voice session (will clear internal session state)
          voiceSession.stop();

          // PHASE 1.3: Graceful shutdown with drain period
          // Wait 2 seconds for pending transcript operations to complete
          // This prevents message loss from in-flight transcript relays
          console.log('[ChatPage] Starting 2-second drain period for pending operations...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[ChatPage] Drain period complete');
        } finally {
          // Finalize backend session if we had one
          if (sessionToFinalize) {
            try {
              console.log('[ChatPage] Finalizing session:', sessionToFinalize);
              await api.endSession(sessionToFinalize);
            } catch (error) {
              console.error('[ChatPage] Session finalization failed:', error);
              // Non-fatal; export may still work, and UI should remain responsive
            }
          }
          // Clear active session (exportSessionId already preserved by useEffect)
          setActiveSessionId(null);
        }
      }}
      voiceLocked={!!voiceLocked}
      voiceButtonDisabled={voiceButtonDisabled}
      voiceButtonTooltip={voiceButtonTooltip}
      micActionsOpen={uiState.micActionsOpen}
      openMicActions={uiState.openMicActions}
      closeMicActions={uiState.closeMicActions}
      openPostStop={uiState.openPostStop}
    />
  );

  const renderPlayPause = () => (
    <VoiceControls
      mode="playpause-only"
      status={voiceSession.status}
      micPaused={voiceSession.micPaused}
      start={handleStartVoice}
      pause={() => voiceSession.pause()}
      resume={() => voiceSession.resume()}
      stop={async () => {
        const sessionToFinalize = activeSessionId;
        try {
          voiceSession.stop();
          console.log('[ChatPage] Starting 2-second drain period for pending operations...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[ChatPage] Drain period complete');
        } finally {
          if (sessionToFinalize) {
            try {
              console.log('[ChatPage] Finalizing session:', sessionToFinalize);
              await api.endSession(sessionToFinalize);
            } catch (error) {
              console.error('[ChatPage] Session finalization failed:', error);
            }
          }
          setActiveSessionId(null);
        }
      }}
      voiceLocked={!!voiceLocked}
      voiceButtonDisabled={voiceButtonDisabled}
      voiceButtonTooltip={voiceButtonTooltip}
      micActionsOpen={uiState.micActionsOpen}
      openMicActions={uiState.openMicActions}
      closeMicActions={uiState.closeMicActions}
      openPostStop={uiState.openPostStop}
    />
  );

  const renderTransportRight = () => (
    <VoiceControls
      mode="restart-stop-only"
      status={voiceSession.status}
      micPaused={voiceSession.micPaused}
      start={handleStartVoice}
      pause={() => voiceSession.pause()}
      resume={() => voiceSession.resume()}
      stop={async () => {
        const sessionToFinalize = activeSessionId;
        try {
          voiceSession.stop();
          console.log('[ChatPage] Starting 2-second drain period for pending operations...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[ChatPage] Drain period complete');
        } finally {
          if (sessionToFinalize) {
            try {
              console.log('[ChatPage] Finalizing session:', sessionToFinalize);
              await api.endSession(sessionToFinalize);
            } catch (error) {
              console.error('[ChatPage] Session finalization failed:', error);
            }
          }
          setActiveSessionId(null);
        }
      }}
      voiceLocked={!!voiceLocked}
      voiceButtonDisabled={voiceButtonDisabled}
      voiceButtonTooltip={voiceButtonTooltip}
      micActionsOpen={uiState.micActionsOpen}
      openMicActions={uiState.openMicActions}
      closeMicActions={uiState.closeMicActions}
      openPostStop={uiState.openPostStop}
    />
  );

  return (
    <div className="app-root app-shell" data-scenario-media-count={scenarioMedia.length}>
      <CaseSetupHeader
        logOpen={uiState.logOpen}
        openLog={uiState.openLog}
        sessionId={voiceSession.sessionId ?? exportSessionId}
      />
      <div className="app-body-row">
        <main className={`main main--chat`}>
            <>
              <ChatView
                isComposing={isComposing}
                isVoiceConnecting={isVoiceConnecting}
                connectionProgress={connectionProgress}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
                sortedMessages={sortedMessages}
                voiceSession={voiceSession}
                voiceErrorMessage={voiceErrorMessage}
                runtimeFeatures={runtimeFeatures}
                renderMicControl={renderMicControl}
                renderPlayPause={renderPlayPause}
                renderTransportRight={renderTransportRight}
                personas={personas}
                personaId={personaId}
                selectedPersona={selectedPersona}
                setPersonaId={setPersonaId}
                scenarios={scenarios}
                scenarioId={scenarioId}
                selectedScenario={selectedScenario}
                setScenarioId={setScenarioId}
                  audience={audience}
                  onAudienceChange={setAudience}
                onPrintTranscript={handleViewTranscriptPage}
                onPrintTranscriptAsync={handlePrintTranscriptAsync}
                onOpenFacultyKey={handleOpenFacultyKey}
                postStopOpen={uiState.postStopOpen}
                setPostStopOpen={uiState.setPostStopOpen}
                onReset={resetEncounter}
                onResetAndStart={restartNowWithAutoVoice}
                onReturnToSetup={resetToSetup}
                sessionId={exportSessionId ?? activeSessionId}
                spsError={spsError}
                backendOk={backendOk}
                caseSetupIds={caseSetupIds}
                onMediaClick={handleMediaClick}
                selectedMedia={uiState.selectedMedia}
              />
              <AdvancedSettingsDrawer
                open={uiState.settingsOpen}
                onClose={() => uiState.closeSettings()}
                onReconnectRequest={requestReconnect}
              />
            </>
        </main>
      </div>

      <DiagnosticsDrawer
        open={uiState.logOpen}
        onClose={() => uiState.closeLog()}
        onCopyLogs={handleCopyLogs}
        logItems={logItems}
        runtimeFeatures={runtimeFeatures}
        voiceSession={voiceSession}
        ttftMs={ttftMs}
        health={health}
        statusClass={statusClass}
        sessionPhase={sessionPhase}
        sessionOutstandingGate={sessionOutstandingGate}
        instructionsPreview={instructionsPreview}
      />

      {/* Persistence error toast */}
      {uiState.persistenceError && (
        <div className="toast toast--error toast--fixed">
          <span>⚠️ {uiState.persistenceError.message}</span>
          <button onClick={() => uiState.clearPersistenceError()} className="toast__dismiss" aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {/* Voice ready notification */}
      <VoiceReadyToast show={showVoiceReadyToast} onDismiss={dismissVoiceReadyToast} />

      {/* Media modal */}
      <MediaModal media={uiState.selectedMedia} isOpen={!!uiState.selectedMedia} onClose={() => uiState.closeMedia()} />

      {/* Session Evaluation modal */}
      <SessionEvaluationModal
        open={uiState.evaluationOpen}
        onClose={uiState.closeEvaluation}
        sessionId={activeSessionId}
        onRestart={resetEncounter}
      />

      {/* Full-screen 3D overlay */}
      {uiState.viewerOverlay.open && (
        <div
          className="viewer-overlay"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => { if (e.key === 'Escape') uiState.closeViewerOverlay() }}
          tabIndex={-1}
        >
          <Viewer3D
            initialAnimationId={uiState.viewerOverlay.animationId}
            onClose={() => uiState.closeViewerOverlay()}
          />
        </div>
      )}

      {/* Remote audio element for voice responses */}
      <audio ref={voiceSession.remoteAudioRef} autoPlay className="remote-audio" aria-label="Voice response audio" />
    </div>
  );
}
