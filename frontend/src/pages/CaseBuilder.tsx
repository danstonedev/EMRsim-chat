import { useEffect, useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import { Document, Packer } from 'docx'
import { api, API_BASE_URL } from '../shared/api'
import type { ClinicalScenarioV3, ScenarioRegion, ScenarioSourceLite } from '../shared/types/scenario'
import {
  ScenarioLite,
  PersonaLite,
  ScenarioPreview,
  PersonaPreview,
  PreviewMode,
  REGION_OPTIONS,
  isScenarioData,
  isPersonaData,
} from './caseBuilder/types'
import {
  generateDocxParagraphs,
  getScenarioDisplayName,
  getPersonaDisplayName,
} from './caseBuilder/utils'
import { CaseBuilderFilters } from './caseBuilder/components/CaseBuilderFilters'
import { ScenarioTable } from './caseBuilder/components/ScenarioTable'
import { PersonaTable } from './caseBuilder/components/PersonaTable'
import { ScenarioPreviewModal } from './caseBuilder/components/ScenarioPreviewModal'
import { PersonaPreviewModal } from './caseBuilder/components/PersonaPreviewModal'
import { GenerateScenarioModal } from './caseBuilder/components/GenerateScenarioModal'

const DEFAULT_PROMPT = `Create a detailed outpatient physical therapy case for a recreational runner with gradual onset hip pain.
Include full SOAP documentation, patient persona details, learning objectives, evidence citations, and an intervention plan.`

function formatApiError(error: unknown): string {
  const raw = typeof error === 'string'
    ? error
    : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
      ? String((error as { message?: unknown }).message)
      : ''

  if (!raw) return 'Request failed'

  if (raw.includes('timeout')) {
    return 'The request timed out. Try again or refine your prompt.'
  }

  const jsonStart = raw.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart))
      if (parsed?.error === 'validation_error' && Array.isArray(parsed.issues)) {
        const details = parsed.issues
          .map((issue: unknown) => {
            const obj = issue as Record<string, unknown>
            const msg = typeof obj?.message === 'string' ? obj.message : ''
            const path = Array.isArray(obj?.path)
              ? obj.path.join('.')
              : typeof obj?.path === 'string'
                ? obj.path
                : ''
            const code = typeof obj?.code === 'string' ? obj.code : ''
            return msg || path || code
          })
          .filter(Boolean)
          .slice(0, 5)
        if (details.length) {
          return `Schema validation failed:\n${details.join('\n')}`
        }
        return 'Scenario failed schema validation on the server.'
      }
      if (typeof parsed?.error === 'string') {
        return String(parsed.error).replace(/_/g, ' ')
      }
    } catch {
      // Ignore JSON parse errors and fall back to the raw message
    }
  }

  return String(raw)
}

export default function CaseBuilder() {
  const [scenarios, setScenarios] = useState<ScenarioLite[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'scenarios' | 'personas'>('scenarios')
  const [storageMode, setStorageMode] = useState<'sqlite' | 'memory' | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [debugCounts, setDebugCounts] = useState<{ storage?: string; merged?: number; registry?: number; db?: number } | null>(null)

  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterSetting, setFilterSetting] = useState('')

  const [previewScenario, setPreviewScenario] = useState<ScenarioPreview>(null)
  const [previewPersona, setPreviewPersona] = useState<PersonaPreview>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('formatted')

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genPrompt, setGenPrompt] = useState(DEFAULT_PROMPT)
  const [genRegion, setGenRegion] = useState<ScenarioRegion>('hip')
  const [genResearch, setGenResearch] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [generatedScenario, setGeneratedScenario] = useState<ClinicalScenarioV3 | null>(null)
  const [sources, setSources] = useState<ScenarioSourceLite[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [scenariosData, personasData, health, debug] = await Promise.all([
          api.listSpsScenarios(),
          api.getSpsPersonas(),
          api.getHealth().catch(() => null),
          fetch(`${API_BASE_URL}/api/sps/debug`).then(r => r.json()).catch(() => null),
        ])

    setScenarios(scenariosData)
    setPersonas(personasData)
    setStorageMode(health?.storage ?? null)
        setWarnings(Array.isArray(health?.warnings) ? health.warnings : [])

        if (debug && debug.ok) {
          setDebugCounts({
            storage: debug.storage,
            merged: debug.counts?.merged?.scenarios,
            registry: debug.counts?.registry?.scenarios,
            db: debug.counts?.db?.scenarios,
          })
        }
      } catch {
        // Silent error handling - library load failures are non-critical
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const filteredScenarios = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizeSetting = (value: string | null | undefined) => (value || '').toLowerCase().replace(/_pt$/, '')

    return scenarios.filter(scenario => {
      if (filterRegion && String(scenario.region) !== filterRegion) return false
      if (filterDifficulty && (scenario.difficulty ?? '') !== filterDifficulty) return false
      if (filterSetting && normalizeSetting(scenario.setting) !== normalizeSetting(filterSetting)) return false
      if (!query) return true

      const haystack = [
        scenario.title,
        scenario.region,
        scenario.difficulty ?? '',
        scenario.setting ?? '',
        (scenario.tags ?? []).join(' '),
        scenario.persona_name ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [scenarios, search, filterRegion, filterDifficulty, filterSetting])

  const hasActiveFilters = Boolean(search || filterRegion || filterDifficulty || filterSetting)

  const resetFilters = () => {
    setSearch('')
    setFilterRegion('')
    setFilterDifficulty('')
    setFilterSetting('')
  }

  async function loadScenarioPreview(scenarioId: string) {
    setPreviewScenario({ loading: true })
    setPreviewMode('formatted')
    setLoadingPreview(true)
    try {
      const scenario = await api.getSpsScenarioById(scenarioId)
      if (scenario) {
        setPreviewScenario(scenario)
      } else {
        setPreviewScenario({ error: 'Scenario not found.' })
      }
    } catch (e) {
      setPreviewScenario({ error: `Failed to load scenario: ${String(e)}` })
    } finally {
      setLoadingPreview(false)
    }
  }

  async function loadPersonaPreview(personaId: string) {
    setPreviewPersona({ loading: true })
    setPreviewMode('formatted')
    setLoadingPreview(true)
    try {
      const persona = await api.getSpsPersonaById(personaId)
      if (persona) {
        setPreviewPersona(persona)
      } else {
        setPreviewPersona({ error: 'Persona not found.' })
      }
    } catch (e) {
      setPreviewPersona({ error: `Failed to load persona: ${String(e)}` })
    } finally {
      setLoadingPreview(false)
    }
  }

  async function generateWithAI() {
    if (!genPrompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setGenerating(true)
    setError('')
    setStatus('')

    try {
      const result = await api.generateSpsScenario(genPrompt.trim(), {
        region: genRegion,
        research: genResearch,
      })

      setGeneratedScenario(result.scenario)
      setSources(result.sources || [])
      setStatus('Scenario generated successfully.')
      setError('')
    } catch (e: unknown) {
      setError(formatApiError(e))
      setStatus('')
    } finally {
      setGenerating(false)
    }
  }

  async function exportToWord() {
    if (isScenarioData(previewScenario)) {
      await exportData(previewScenario, getScenarioDisplayName(previewScenario))
      return
    }

    if (isPersonaData(previewPersona)) {
      await exportData(previewPersona, getPersonaDisplayName(previewPersona))
    }
  }

  async function exportData(data: unknown, heading: string) {
    if (!data) return

    const safeHeading = heading?.trim() ? heading.trim() : 'document'
    const paragraphs = generateDocxParagraphs(data, safeHeading)

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${safeHeading}.docx`)
  }

  async function saveScenario(): Promise<boolean> {
    if (!generatedScenario) return false

    try {
      setSaving(true)
      const scenarioToSave: ClinicalScenarioV3 = {
        ...generatedScenario,
        schema_version: generatedScenario.schema_version || '3.0.0',
      }
      await api.saveSpsScenario(scenarioToSave)
      setStatus('Scenario saved successfully!')
      setError('')
      return true
    } catch (e: unknown) {
      const message = formatApiError(e) || 'Unknown error'
      setError(`Failed to save: ${message}`)
      setStatus('')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveScenario() {
    const success = await saveScenario()
    if (!success) return

    const scenariosData = await api.listSpsScenarios()
    setScenarios(scenariosData)
    setShowGenerateModal(false)
  }

  const handleResetPrompt = () => {
    setGenPrompt(DEFAULT_PROMPT)
    setGenRegion('hip')
    setGenResearch(false)
    setError('')
    setStatus('')
  }

  return (
    <div className="casebuilder-shell">
      <header className="casebuilder-hero">
        <div className="casebuilder-hero-inner">
          <h1 className="casebuilder-hero-title">Case Builder</h1>
        </div>
      </header>

      <main className="casebuilder-layout">
        {debugCounts && (
          <div className="cb-card">
            <div className="cb-card-body">
              <p className="cb-muted">
                Runtime: storage=<code>{debugCounts.storage || storageMode || 'unknown'}</code>
                {' '} scenarios: merged={debugCounts.merged ?? '?'} (registry={debugCounts.registry ?? '?'} + db={debugCounts.db ?? '?'})
              </p>
            </div>
          </div>
        )}
        <section className="casebuilder-main">
          <div className="cb-toolbar">
            <div className="cb-tabs">
              <button className={`cb-tab ${view === 'scenarios' ? 'cb-tab-active' : ''}`} onClick={() => setView('scenarios')}>
                Scenarios ({scenarios.length})
              </button>
              <button className={`cb-tab ${view === 'personas' ? 'cb-tab-active' : ''}`} onClick={() => setView('personas')}>
                Personas ({personas.length})
              </button>
            </div>
            <button className="cb-btn cb-btn-primary" onClick={() => setShowGenerateModal(true)}>
              Generate New Scenario
            </button>
          </div>

          {loading ? (
            <div className="cb-card">
              <div className="cb-card-body">
                <p>Loading library...</p>
              </div>
            </div>
          ) : (
            <>
              {(storageMode === 'memory' || (warnings && warnings.includes('using_in_memory_storage'))) && (
                <div className="cb-card" role="status" aria-live="polite">
                  <div className="cb-card-body">
                    <p className="cb-text-warning">
                      Warning: Backend is using in-memory storage. Scenarios you create may not persist after restart. Configure SQLite to enable persistence.
                    </p>
                  </div>
                </div>
              )}

              {view === 'scenarios' && (
                <div className="cb-table-container">
                  <CaseBuilderFilters
                    search={search}
                    onSearchChange={setSearch}
                    region={filterRegion}
                    onRegionChange={setFilterRegion}
                    difficulty={filterDifficulty}
                    onDifficultyChange={setFilterDifficulty}
                    setting={filterSetting}
                    onSettingChange={setFilterSetting}
                    onClearFilters={resetFilters}
                    filteredCount={filteredScenarios.length}
                    totalCount={scenarios.length}
                    hasActiveFilters={hasActiveFilters}
                    regionOptions={REGION_OPTIONS}
                  />

                  <ScenarioTable
                    scenarios={scenarios}
                    filteredScenarios={filteredScenarios}
                    onPreview={scenarioId => {
                      void loadScenarioPreview(scenarioId)
                    }}
                    onClearFilters={resetFilters}
                  />
                </div>
              )}

              {view === 'personas' && (
                <div className="cb-table-container">
                  <PersonaTable
                    personas={personas}
                    onPreview={personaId => {
                      void loadPersonaPreview(personaId)
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {previewScenario && (
        <ScenarioPreviewModal
          preview={previewScenario}
          loading={loadingPreview}
          previewMode={previewMode}
          onModeChange={setPreviewMode}
          onClose={() => setPreviewScenario(null)}
          onExportWord={() => {
            void exportToWord()
          }}
        />
      )}

      {previewPersona && (
        <PersonaPreviewModal
          preview={previewPersona}
          loading={loadingPreview}
          previewMode={previewMode}
          onModeChange={setPreviewMode}
          onClose={() => setPreviewPersona(null)}
          onExportWord={() => {
            void exportToWord()
          }}
        />
      )}

      {showGenerateModal && (
        <GenerateScenarioModal
          prompt={genPrompt}
          region={genRegion}
          includeResearch={genResearch}
          error={error}
          status={status}
          generating={generating}
          saving={saving}
          generatedScenario={generatedScenario}
          sources={sources}
          regionOptions={REGION_OPTIONS}
          onClose={() => setShowGenerateModal(false)}
          onPromptChange={setGenPrompt}
          onRegionChange={setGenRegion}
          onIncludeResearchChange={setGenResearch}
          onGenerate={() => {
            void generateWithAI()
          }}
          onReset={handleResetPrompt}
          onSave={() => {
            void handleSaveScenario()
          }}
        />
      )}
    </div>
  )
}
