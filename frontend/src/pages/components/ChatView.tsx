import type { MutableRefObject, ReactElement } from 'react'
import type { Message, PersonaLite, ScenarioLite } from '../chatShared'
import type { VoiceSessionHandle } from '../../shared/useVoiceSession'
import { ConnectionOverlay, type ConnectionProgressState } from './chat/ConnectionOverlay'
import { MessagesList } from './chat/MessagesList'
import { VoiceStatusPanel } from './chat/VoiceStatusPanel'
import { CaseSetupBar } from './chat/CaseSetupBar'

export interface ChatViewProps {
  isComposing: boolean
  isVoiceConnecting: boolean
  connectionProgress: ConnectionProgressState | null
  messagesContainerRef: MutableRefObject<HTMLDivElement | null>
  messagesEndRef: MutableRefObject<HTMLDivElement | null>
  isLoadingInitialData: boolean
  sortedMessages: Message[]
  voiceSession: VoiceSessionHandle
  pendingElapsed: Record<string, number>
  voiceErrorMessage: string | null
  runtimeFeatures: {
    voiceEnabled: boolean
    spsEnabled: boolean
    voiceDebug: boolean
  }
  renderMicControl: () => ReactElement
  personas: PersonaLite[]
  personaId: string | null
  selectedPersona: PersonaLite | null
  setPersonaId: (id: string | null) => void
  scenarios: ScenarioLite[]
  scenarioId: string
  selectedScenario: ScenarioLite | null
  setScenarioId: (id: string) => void
  setSettingsOpen: (open: boolean) => void
  printDropdownOpen: boolean
  setPrintDropdownOpen: (open: boolean) => void
  onPrintScenario: () => boolean
  onPrintTranscript: () => boolean
  postStopOpen: boolean
  setPostStopOpen: (open: boolean) => void
  sessionId: string | null
  spsError: string | null
  backendOk: boolean | null
  caseSetupIds: { section: string; title: string }
  onMediaClick?: (media: import('../chatShared').MediaReference) => void
}

export function ChatView({
  isComposing,
  isVoiceConnecting,
  connectionProgress,
  messagesContainerRef,
  messagesEndRef,
  isLoadingInitialData,
  sortedMessages,
  voiceSession,
  pendingElapsed,
  voiceErrorMessage,
  runtimeFeatures,
  renderMicControl,
  personas,
  personaId,
  selectedPersona,
  setPersonaId,
  scenarios,
  scenarioId,
  selectedScenario,
  setScenarioId,
  setSettingsOpen,
  printDropdownOpen,
  setPrintDropdownOpen,
  onPrintScenario,
  onPrintTranscript,
  postStopOpen,
  setPostStopOpen,
  sessionId,
  spsError,
  backendOk,
  caseSetupIds,
  onMediaClick,
}: ChatViewProps) {
  const showVoiceDisabledBanner = !runtimeFeatures.voiceEnabled || !runtimeFeatures.spsEnabled

  return (
    <>
      <div className="chat-panel">
        <div className="chat-panel__body">
          <ConnectionOverlay
            isComposing={isComposing}
            isVoiceConnecting={isVoiceConnecting}
            progress={connectionProgress}
          />

          <MessagesList
            messages={sortedMessages}
            isLoadingInitialData={isLoadingInitialData}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            pendingElapsed={pendingElapsed}
            voiceSession={voiceSession}
            onMediaClick={onMediaClick}
          />

          <VoiceStatusPanel voiceSession={voiceSession} renderMicControl={renderMicControl} />

          {voiceErrorMessage && (
            <div className="voice-error-banner" role="alert">
              {voiceErrorMessage}
            </div>
          )}
          <audio ref={voiceSession.remoteAudioRef as any} autoPlay playsInline hidden />
        </div>
        {showVoiceDisabledBanner && (
          <div className="voice-disabled-banner" role="status">
            {!runtimeFeatures.voiceEnabled ? (
              <>
                Voice mode is disabled. Update <code>VITE_VOICE_ENABLED</code> (frontend) or <code>VOICE_ENABLED</code> (backend) and restart to
                enable it.
              </>
            ) : (
              <>Voice transport is temporarily disabled for SPS encounters by the backend health check.</>
            )}
          </div>
        )}
      </div>

      <CaseSetupBar
        personas={personas}
        personaId={personaId}
        selectedPersona={selectedPersona}
        setPersonaId={setPersonaId}
        scenarios={scenarios}
        scenarioId={scenarioId}
        selectedScenario={selectedScenario}
        setScenarioId={setScenarioId}
        renderMicControl={renderMicControl}
        isComposing={isComposing}
        isVoiceConnecting={isVoiceConnecting}
        connectionProgress={connectionProgress}
        voiceSession={voiceSession}
        setSettingsOpen={setSettingsOpen}
        printDropdownOpen={printDropdownOpen}
        setPrintDropdownOpen={setPrintDropdownOpen}
        onPrintScenario={onPrintScenario}
        onPrintTranscript={onPrintTranscript}
        postStopOpen={postStopOpen}
        setPostStopOpen={setPostStopOpen}
        sessionId={sessionId}
        spsError={spsError}
        backendOk={backendOk}
        caseSetupIds={caseSetupIds}
      />
    </>
  )
}
