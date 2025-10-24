import { useEffect, useRef, useState, useMemo } from 'react'
import { PersonaPicker, ScenarioPicker } from '../CaseSelectors'
import type { PersonaLite, ScenarioLite } from '../../chatShared'
import type { VoiceSessionHandle } from '../../../shared/useVoiceSession'
import type { ConnectionProgressState } from './ConnectionOverlay'
// Inline actions (mic/print) are no longer used in setup; connection starts via Start button
import EndSessionActions from './EndSessionActions'
import { CaseSetupStatusBanner } from './CaseSetupStatusBanner'

/**
 * Map difficulty values to display labels
 */
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Intro',
  moderate: 'Moderate',
  advanced: 'Advanced'
}

/**
 * Filter personas based on scenario guardrails (age, sex constraints)
 */
function filterPersonasByGuardrails(personas: PersonaLite[], guardrails?: ScenarioLite['guardrails']): PersonaLite[] {
  if (!guardrails) return personas

  return personas.filter(p => {
    // Age filtering
    if (typeof guardrails.min_age === 'number' && typeof p.age === 'number') {
      if (p.age < guardrails.min_age) return false
    }
    if (typeof guardrails.max_age === 'number' && typeof p.age === 'number') {
      if (p.age > guardrails.max_age) return false
    }

    // Sex filtering (case-insensitive)
    if (typeof guardrails.sex_required === 'string' && typeof p.sex === 'string') {
      const required = guardrails.sex_required.toLowerCase()
      const personaSex = p.sex.toLowerCase()
      if (required !== personaSex) return false
    }

    return true
  })
}

type CaseSetupBarProps = {
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
  isVoiceConnecting: boolean
  connectionProgress: ConnectionProgressState | null
  voiceSession: VoiceSessionHandle
  onPrintTranscript: () => boolean
  onPrintTranscriptAsync?: () => Promise<boolean>
  onOpenFacultyKey?: () => boolean
  // Restart the same scenario immediately
  onRestartNow?: () => void | Promise<void>
  // Reset and return to setup pickers without auto-restarting
  onReturnToSetup?: () => void | Promise<void>
  postStopOpen: boolean
  setPostStopOpen: (open: boolean) => void
  sessionId: string | null
  spsError: string | null
  backendOk: boolean | null
  caseSetupIds: { section: string; title: string }
  hasMessages?: boolean
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
  audience,
  onAudienceChange,
  isVoiceConnecting,
  connectionProgress,
  voiceSession,
  onPrintTranscript,
  onPrintTranscriptAsync,
  onOpenFacultyKey,
  onRestartNow,
  onReturnToSetup,
  postStopOpen,
  setPostStopOpen,
  sessionId,
  spsError,
  backendOk,
  caseSetupIds,
  hasMessages = false,
}: CaseSetupBarProps) {
  // Filter personas based on scenario guardrails
  const filteredPersonas = useMemo(() => {
    // If scenario has guardrails, filter personas
    if (selectedScenario?.guardrails) {
      return filterPersonasByGuardrails(personas, selectedScenario.guardrails)
    }
    return personas
  }, [personas, selectedScenario])

  // Mic and print controls are removed from setup; connection starts via Start button

  // Modal behavior
  // Previous behavior: the modal closed immediately after both persona and scenario were selected,
  // which caused a jarring jump from the centered picker (pic 1) to the inline dock (pic 2).
  // New behavior: keep the modal open after selection until the user begins connecting voice
  // (or otherwise proceeds), so there is no auto-collapse on the second selection.
  const needsSelection = !personaId || !scenarioId
  const [modalOpen, setModalOpen] = useState<boolean>(true)
  const [isClosing, setIsClosing] = useState<boolean>(false)
  const [isEntering, setIsEntering] = useState<boolean>(true)
  // If a selection is missing, force the modal open. Otherwise, leave it as-is until
  // the user proceeds (e.g., presses the mic which starts connecting) or explicitly dismissed in future.
  useEffect(() => {
    if (needsSelection) setModalOpen(true)
  }, [needsSelection])

  // When the modal opens, briefly apply an "enter" class so CSS can animate in
  useEffect(() => {
    if (!modalOpen) return
    setIsEntering(true)
    const id = requestAnimationFrame(() => setIsEntering(false))
    return () => cancelAnimationFrame(id)
  }, [modalOpen])

  const beginCloseModal = () => {
    if (!modalOpen) return
    setIsClosing(true)
    window.setTimeout(() => {
      setModalOpen(false)
      setIsClosing(false)
    }, 180)
  }

  // Close the modal when we begin connecting or are connected
  useEffect(() => {
    if (isVoiceConnecting || connectionProgress || voiceSession.status === 'connected') {
      beginCloseModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceConnecting, connectionProgress, voiceSession.status])

  // Refs for auto-focus/scroll sequencing
  const personaInputRef = useRef<HTMLInputElement | null>(null)
  const scenarioInputRef = useRef<HTMLInputElement | null>(null)

  // Auto-select persona when scenario is chosen
  // For new kits: use the linked persona_id
  // For old scenarios: randomly pick from suggested_personas
  useEffect(() => {
    if (!scenarioId || personaId) return

    // Priority 1: Kit-linked persona (pre-selected for new kits)
    if (selectedScenario?.persona_id) {
      try { setPersonaId(selectedScenario.persona_id) } catch { /* noop */ }
      return
    }

    // Priority 2: Suggested personas (old scenarios with recommendations)
    const suggested = selectedScenario?.suggested_personas
    if (Array.isArray(suggested) && suggested.length > 0) {
      const choice = suggested[Math.floor(Math.random() * suggested.length)]
      if (choice && typeof choice === 'string') {
        try { setPersonaId(choice) } catch { /* noop */ }
      }
    }
  }, [scenarioId, personaId, selectedScenario, setPersonaId])

  // When modal opens, focus the scenario field (first step)
  useEffect(() => {
    if (!modalOpen) return
    const el = scenarioInputRef.current
    if (el) {
      try {
        el.focus({ preventScroll: false } as any)
        // ensure center of viewport
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      } catch { /* noop */ }
    }
  }, [modalOpen])

  // Scenario filters: region and difficulty
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')

  const regionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of scenarios) {
      if (typeof s.region === 'string' && s.region.trim()) set.add(s.region.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [scenarios])

  const difficultyOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of scenarios) {
      if (typeof s.difficulty === 'string' && s.difficulty.trim()) set.add(s.difficulty.trim())
    }
    // Preserve a common ordering if present
    const commonOrder = ['entry', 'novice', 'intermediate', 'advanced']
    const arr = Array.from(set)
    arr.sort((a, b) => {
      const ai = commonOrder.indexOf(a.toLowerCase())
      const bi = commonOrder.indexOf(b.toLowerCase())
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b)
    })
    return arr
  }, [scenarios])

  const filteredScenariosByFilters = useMemo(() => {
    return scenarios.filter(s => {
      const regionOk = regionFilter === 'all' || (typeof s.region === 'string' ? s.region === regionFilter : false)
      const diffOk = difficultyFilter === 'all' || (typeof s.difficulty === 'string' ? s.difficulty === difficultyFilter : false)
      return regionOk && diffOk
    })
  }, [scenarios, regionFilter, difficultyFilter])

  const content = (
    <section
      id={caseSetupIds.section}
      className="case-setup-inline case-setup-inline--single-row"
      role="region"
      aria-label="Case Setup"
    >
      {/* Removed visible/hidden Case Setup title per request; section retains accessible name via aria-label */}

      {/* Audience selector - only visible in modal during setup */}
      <div className="case-setup-inline__audience-row">
        <div className="case-setup-audience">
          <button
            type="button"
            className={`aud-btn${audience === 'student' ? ' aud-btn--active' : ''}`}
            onClick={() => onAudienceChange('student')}
          >
            Student
          </button>
          <button
            type="button"
            className={`aud-btn${audience === 'faculty' ? ' aud-btn--active' : ''}`}
            onClick={() => onAudienceChange('faculty')}
          >
            Faculty
          </button>
        </div>
      </div>

      {/* Step 1: Scenario selection (always visible) */}
      <div className="case-setup-inline__scenario-section">
        {/* Scenario filters: region and difficulty (dropdowns) */}
        <div className="scenario-filters" role="group" aria-label="Scenario filters">
          <label className="scenario-filter__label">
            <span>Region</span>
            <select
              className="scenario-filter__select"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              aria-label="Filter scenarios by region"
            >
              <option value="all">All</option>
              {regionOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="scenario-filter__label">
            <span>Difficulty</span>
            <select
              className="scenario-filter__select"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              aria-label="Filter scenarios by difficulty"
            >
              <option value="all">All</option>
              {difficultyOptions.map(d => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d] || d}</option>
              ))}
            </select>
          </label>
        </div>
        <ScenarioPicker
          scenarios={filteredScenariosByFilters}
          selectedId={scenarioId}
          selectedScenario={selectedScenario ?? null}
          onSelect={setScenarioId}
          inputRef={scenarioInputRef}
          audience={audience}
        />
      </div>

      {/* Step 2: Persona selection (only visible after scenario selected) */}
      {scenarioId && (
        <div className="case-setup-inline__persona-section">
          <PersonaPicker
            personas={filteredPersonas}
            selectedId={personaId}
            selectedPersona={selectedPersona ?? null}
            onSelect={setPersonaId}
            onPicked={() => {
              // Focus logic if needed
            }}
            inputRef={personaInputRef}
          />
        </div>
      )}

      {/* Audience selection moved outside modal; see audience bar below */}

      {!modalOpen && personaId && scenarioId && (
        <div className="case-setup-inline__footer">
          <button
            type="button"
            className="link-btn"
            onClick={async () => {
              if (hasMessages) {
                const ok = window.confirm('Changing persona or scenario will reset the current conversation. Continue?')
                if (!ok) return
                if (onReturnToSetup) await onReturnToSetup()
              }
              setModalOpen(true)
            }}
          >
            Change
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="case-setup-inline__footer">
          <button
            type="button"
            className="encounter-end-modal__button encounter-end-modal__button--primary"
            disabled={!personaId || !scenarioId}
            onClick={async () => {
              try {
                await voiceSession.start()
              } catch {
                // fall back to just closing if start throws; overlay will show errors
              }
              beginCloseModal()
            }}
          >
            Start
          </button>
        </div>
      )}

      {spsError && (
        <div className="banner banner--error" role="alert">
          {spsError}
        </div>
      )}

      <EndSessionActions
        open={postStopOpen}
        onClose={() => setPostStopOpen(false)}
        onPrintTranscript={onPrintTranscript}
        onPrintTranscriptAsync={onPrintTranscriptAsync}
        onOpenFacultyKey={onOpenFacultyKey}
        onRestartNow={onRestartNow}
        onNewScenario={async () => {
          // Confirm if there is existing content, then reset upstream state and reopen pickers
          if (hasMessages) {
            const ok = window.confirm('Start a new scenario? This resets the current conversation.')
            if (!ok) return
          }
          if (onReturnToSetup) await onReturnToSetup()
          setModalOpen(true)
        }}
        sessionId={sessionId}
      />

      <CaseSetupStatusBanner backendOk={backendOk} personasCount={personas.length} />
    </section>
  )

  if (!modalOpen) {
    // No inline selectors or actions; only provide post-stop menu and status banner when idle
    return (
      <>
        <EndSessionActions
          open={postStopOpen}
          onClose={() => setPostStopOpen(false)}
          onPrintTranscript={onPrintTranscript}
          onPrintTranscriptAsync={onPrintTranscriptAsync}
          onOpenFacultyKey={onOpenFacultyKey}
          onRestartNow={onRestartNow}
          onNewScenario={async () => {
            if (hasMessages) {
              const ok = window.confirm('Start a new scenario? This resets the current conversation.')
              if (!ok) return
            }
            if (onReturnToSetup) await onReturnToSetup()
            setModalOpen(true)
          }}
          sessionId={sessionId}
        />
        <CaseSetupStatusBanner backendOk={backendOk} personasCount={personas.length} />
      </>
    )
  }

  // Modal open: show modal with audience selector integrated into the content
  return (
    <div className={`case-setup-modal${isClosing ? ' case-setup-modal--closing' : ''}${isEntering ? ' case-setup-modal--enter' : ''}`} role="dialog" aria-modal="true" aria-label="Select persona and scenario">
      <div className="case-setup-modal__backdrop" />
      <div className="case-setup-modal__dialog" role="document">
        {content}
      </div>
    </div>
  )
}
