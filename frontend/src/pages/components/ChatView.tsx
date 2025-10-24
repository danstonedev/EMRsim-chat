import type { MutableRefObject, ReactElement } from 'react'
import type { Message, PersonaLite, ScenarioLite } from '../chatShared'
import type { VoiceSessionHandle } from '../../shared/useVoiceSession'
import RenderProfiler from '../../shared/utils/renderProfiler'
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
  sortedMessages: Message[]
  voiceSession: VoiceSessionHandle
  voiceErrorMessage: string | null
  runtimeFeatures: {
    voiceEnabled: boolean
    spsEnabled: boolean
    voiceDebug: boolean
  }
  renderMicControl: () => ReactElement
  renderPlayPause: () => ReactElement
  renderTransportRight: () => ReactElement
  personas: PersonaLite[]
  personaId: string | null
  selectedPersona: PersonaLite | null
  setPersonaId: (id: string | null) => void
  scenarios: ScenarioLite[]
  scenarioId: string
  selectedScenario: ScenarioLite | null
  setScenarioId: (id: string) => void
  audience: 'student' | 'faculty'
  onAudienceChange: (audience: 'student' | 'faculty') => void
  onPrintTranscript: () => boolean
  onPrintTranscriptAsync?: () => Promise<boolean>
  onOpenFacultyKey?: () => boolean
  // Restart same scenario immediately and auto-start voice
  onResetAndStart?: () => void | Promise<void>
  // Return to setup without auto-restart
  onReturnToSetup?: () => void | Promise<void>
  postStopOpen: boolean
  setPostStopOpen: (open: boolean) => void
  sessionId: string | null
  spsError: string | null
  backendOk: boolean | null
  caseSetupIds: { section: string; title: string }
  onMediaClick?: (media: import('../chatShared').MediaReference) => void
  selectedMedia?: import('../chatShared').MediaReference | null
  onReset?: () => Promise<void>
}

export function ChatView({
  isComposing,
  isVoiceConnecting,
  connectionProgress,
  onReset,
  messagesContainerRef,
  messagesEndRef,
  sortedMessages,
  voiceSession,
  voiceErrorMessage,
  runtimeFeatures,
  renderMicControl,
  renderPlayPause,
  renderTransportRight,
  personas,
  personaId,
  selectedPersona,
  setPersonaId,
  scenarios,
  scenarioId,
  selectedScenario,
  setScenarioId,
  audience,
  onAudienceChange,
  onPrintTranscript,
  onPrintTranscriptAsync,
  onOpenFacultyKey,
  onResetAndStart,
  onReturnToSetup,
  postStopOpen,
  setPostStopOpen,
  sessionId,
  spsError,
  backendOk,
  caseSetupIds,
  onMediaClick,
  selectedMedia,
}: ChatViewProps) {
  const showVoiceDisabledBanner = !runtimeFeatures.voiceEnabled || !runtimeFeatures.spsEnabled
  const isActivelyListening = voiceSession.status === 'connected' && !voiceSession.micPaused
  const showEndMarker = !isComposing && !isVoiceConnecting && voiceSession.status !== 'connected' && sortedMessages.length > 0

  const handleImageLoad = () => {
    // Scroll to bottom when images load (they change container height)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
  }

  return (
    <RenderProfiler id="ChatView">
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
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            onMediaClick={onMediaClick}
            onImageLoad={handleImageLoad}
            selectedMedia={selectedMedia}
            endText={showEndMarker ? 'End of Encounter' : undefined}
          />

          {voiceSession.status === 'connected' && (
            <VoiceStatusPanel
              voiceSession={voiceSession}
              renderMicControl={renderMicControl}
              renderPlayPause={renderPlayPause}
              renderTransportRight={renderTransportRight}
            />
          )}

          {voiceErrorMessage && (
            <div className="voice-error-banner" role="alert">
              {voiceErrorMessage}
            </div>
          )}
          <audio
            ref={voiceSession.remoteAudioRef as any}
            autoPlay
            playsInline
            hidden
            onPlay={() => console.log('[Audio] Started playing')}
            onPause={() => console.log('[Audio] Paused')}
            onError={(e) => console.error('[Audio] Error:', e)}
            onLoadedMetadata={() => console.log('[Audio] Metadata loaded')}
          />
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

      {!isActivelyListening && (
        <CaseSetupBar
          personas={personas}
          personaId={personaId}
          selectedPersona={selectedPersona}
          setPersonaId={setPersonaId}
          scenarios={scenarios}
          scenarioId={scenarioId}
          selectedScenario={selectedScenario}
          setScenarioId={setScenarioId}
          audience={audience}
          onAudienceChange={onAudienceChange}
          isVoiceConnecting={isVoiceConnecting}
          connectionProgress={connectionProgress}
          voiceSession={voiceSession}
          onPrintTranscript={onPrintTranscript}
          onPrintTranscriptAsync={onPrintTranscriptAsync}
          onOpenFacultyKey={onOpenFacultyKey}
          onRestartNow={onResetAndStart ?? onReset}
          onReturnToSetup={onReturnToSetup}
          postStopOpen={postStopOpen}
          setPostStopOpen={setPostStopOpen}
          sessionId={sessionId}
          spsError={spsError}
          backendOk={backendOk}
          caseSetupIds={caseSetupIds}
          hasMessages={sortedMessages.length > 0}
        />
      )}
      </>
    </RenderProfiler>
  )
}
