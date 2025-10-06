import type { ReactElement } from 'react'
import { PersonaPicker, ScenarioPicker } from '../CaseSelectors'
import type { PersonaLite, ScenarioLite } from '../../chatShared'
import type { VoiceSessionHandle } from '../../../shared/useVoiceSession'
import type { ConnectionProgressState } from './ConnectionOverlay'
import { CaseSetupActions } from './CaseSetupActions'
import { CaseSetupPostStopMenu } from './CaseSetupPostStopMenu'
import { CaseSetupStatusBanner } from './CaseSetupStatusBanner'

type CaseSetupBarProps = {
  personas: PersonaLite[]
  personaId: string | null
  selectedPersona: PersonaLite | null
  setPersonaId: (id: string | null) => void
  scenarios: ScenarioLite[]
  scenarioId: string
  selectedScenario: ScenarioLite | null
  setScenarioId: (id: string) => void
  renderMicControl: () => ReactElement
  isComposing: boolean
  isVoiceConnecting: boolean
  connectionProgress: ConnectionProgressState | null
  voiceSession: VoiceSessionHandle
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
}

export function CaseSetupBar({
  personas,
  personaId,
  selectedPersona,
  setPersonaId,
  scenarios,
  scenarioId,
  selectedScenario,
  setScenarioId,
  renderMicControl,
  isComposing,
  isVoiceConnecting,
  connectionProgress,
  voiceSession,
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
}: CaseSetupBarProps) {
  const shouldShowMicControl =
    !isComposing && !isVoiceConnecting && !connectionProgress && voiceSession.status !== 'connected'

  return (
    <section
      id={caseSetupIds.section}
      className="case-setup-inline case-setup-inline--single-row"
      role="region"
      aria-labelledby={caseSetupIds.title}
    >
      <h2 id={caseSetupIds.title} className="sr-only">
        Case Setup
      </h2>

      <div className="case-setup-inline__single-row">
        <div className="case-setup-inline__persona">
          <PersonaPicker
            personas={personas}
            selectedId={personaId}
            selectedPersona={selectedPersona ?? null}
            onSelect={setPersonaId}
          />
        </div>
        <div className="case-setup-inline__scenario">
          <ScenarioPicker
            scenarios={scenarios}
            selectedId={scenarioId}
            selectedScenario={selectedScenario ?? null}
            onSelect={setScenarioId}
          />
        </div>
        <CaseSetupActions
          shouldShowMicControl={shouldShowMicControl}
          renderMicControl={renderMicControl}
          onOpenSettings={() => setSettingsOpen(true)}
          personaId={personaId}
          scenarioId={scenarioId}
          printDropdownOpen={printDropdownOpen}
          setPrintDropdownOpen={setPrintDropdownOpen}
          onPrintScenario={onPrintScenario}
          onPrintTranscript={onPrintTranscript}
          sessionId={sessionId}
        />
      </div>

      {spsError && (
        <div className="banner banner--error" role="alert">
          {spsError}
        </div>
      )}

      <CaseSetupPostStopMenu
        open={postStopOpen}
        onClose={() => setPostStopOpen(false)}
        onPrintTranscript={onPrintTranscript}
        sessionId={sessionId}
      />

      <CaseSetupStatusBanner backendOk={backendOk} personasCount={personas.length} />
    </section>
  )
}
