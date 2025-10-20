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
  isLoadingPreview,
  isErrorPreview,
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
    : (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string')
      ? (error as any).message
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
            const path = Array.isArray(obj?.path) ? obj.path.join('.') : typeof obj?.path === 'string' ? obj.path : ''
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

/**
 * Case Builder - Scenario & Persona Library with AI Generation
 * Shows all existing scenarios and personas with ability to generate new ones
 */
export default function CaseBuilder() {
  // Library data
  const [scenarios, setScenarios] = useState<ScenarioLite[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'scenarios' | 'personas'>('scenarios')
  const [storageMode, setStorageMode] = useState<'sqlite' | 'memory' | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [debugCounts, setDebugCounts] = useState<{ storage?: string; merged?: number; registry?: number; db?: number } | null>(null)
  // Library filters (client-side)
  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState<string>('')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('')
  const [filterSetting, setFilterSetting] = useState<string>('')
  
  // Preview modal (for both scenarios and personas)
  const [previewScenario, setPreviewScenario] = useState<ScenarioPreview>(null)
  const [previewPersona, setPreviewPersona] = useState<PersonaPreview>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<'formatted' | 'json'>('formatted')
  
  // AI Generation modal
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

  // Load library data
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
        if (health) {
          setStorageMode((health.storage as any) || null)
          setWarnings(Array.isArray(health.warnings) ? health.warnings : [])
        }
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

  // Derived filtered scenarios
  const filteredScenarios = (() => {
    const q = search.trim().toLowerCase()
    return scenarios.filter(s => {
      if (filterRegion && String(s.region) !== filterRegion) return false
      if (filterDifficulty && (s.difficulty ?? '') !== filterDifficulty) return false
      // Normalize setting values to tolerate variations like 'outpatient_pt' vs 'outpatient'
      const normalizeSetting = (v: string | null | undefined) => (v || '').toLowerCase().replace(/_pt$/, '')
      if (filterSetting && normalizeSetting(s.setting) !== normalizeSetting(filterSetting)) return false
      if (!q) return true
      const hay = [
        s.title,
        s.region,
        s.difficulty ?? '',
        s.setting ?? '',
        (s.tags ?? []).join(' '),
        s.persona_name ?? ''
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  })()

  // Check if value is simple (can be shown inline)
  function isSimpleValue(val: any): boolean {
    return val === null || val === undefined || 
           typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
  }

  // Check if object contains only simple values
  function isSimpleObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
    return Object.values(obj).every(isSimpleValue)
  }

  // Render any value as document-style text
  function renderValue(value: any, depth = 0): any {
    // Skip null/undefined
    if (value === null || value === undefined) {
      return null
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="cb-doc-value">{String(value)}</span>
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return null
      
      // Single item - show inline
      if (value.length === 1 && isSimpleValue(value[0])) {
        return <span className="cb-doc-value">{String(value[0])}</span>
      }
      
      // All simple values - show as comma-separated
      if (value.every(isSimpleValue)) {
        return <span className="cb-doc-value">{value.join(', ')}</span>
      }
      
      // Complex array - show as list
      return (
        <div className="cb-doc-list">
          {value.map((item, idx) => (
            <div key={idx} className="cb-doc-list-item">
              <span className="cb-doc-bullet">•</span>
              <div className="cb-doc-content">
                {renderValue(item, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value).filter(k => value[k] !== null && value[k] !== undefined)
      if (keys.length === 0) return null
      
      // Simple object - show as comma-separated
      if (isSimpleObject(value)) {
        const parts = keys.map(k => `${k.replace(/_/g, ' ')}: ${String(value[k])}`)
        return <span className="cb-doc-value">{parts.join(', ')}</span>
      }
      
      // Complex object - show as nested structure
      const sectionClass = depth > 0 ? 'cb-doc-section cb-doc-nested' : 'cb-doc-section'
      return (
        <div className={sectionClass}>
          {keys.map(key => {
            const val = value[key]
            const rendered = renderValue(val, depth + 1)
            if (rendered === null) return null
            
            const simple = isSimpleValue(val) || (Array.isArray(val) && val.every(isSimpleValue))
            
            return (
              <div key={key} className={simple ? 'cb-doc-row' : 'cb-doc-field'}>
                <div className="cb-doc-label">{key.replace(/_/g, ' ')}</div>
                {simple ? (
                  <div className="cb-doc-inline-value">{rendered}</div>
                ) : (
                  <div className="cb-doc-value-block">{rendered}</div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    
    return <span className="cb-doc-value">{String(value)}</span>
  }
  
  function renderOutline(data: any): JSX.Element | null {
    const out = renderValue(data, 0)
    return (out as JSX.Element) || null
  }

  // Load full scenario for preview
  async function loadScenarioPreview(scenarioId: string) {
    setPreviewScenario({ loading: true }) // Open modal immediately
    setLoadingPreview(true)
    try {
      const scenario = await api.getSpsScenarioById(scenarioId)
      setPreviewScenario(scenario)
    } catch (e) {
      setPreviewScenario({ error: `Failed to load scenario: ${String(e)}` })
    } finally {
      setLoadingPreview(false)
    }
  }

  async function loadPersonaPreview(personaId: string) {
    setPreviewPersona(null)
    setPreviewMode('formatted')
    setLoadingPreview(true)
    try {
      const persona = await api.getSpsPersonaById(personaId)
      setPreviewPersona(persona)
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
        research: genResearch 
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
  }  async function exportToWord() {
    const data = previewScenario || previewPersona
    if (!data || isLoadingPreview(data) || isErrorPreview(data)) return

    // Generate paragraphs from the data
    const paragraphs = generateDocxParagraphs(data)
    
    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    })
    
    // Generate and download the file
    const blob = await Packer.toBlob(doc)
    const filename = previewScenario && isScenarioData(previewScenario)
      ? `${previewScenario.meta?.title || previewScenario.scenario_id || 'scenario'}.docx`
      : previewPersona && !isErrorPreview(previewPersona)
        ? `${previewPersona.display_name || previewPersona.patient_id || 'persona'}.docx`
        : 'document.docx'
    saveAs(blob, filename)
  }

  function generateDocxParagraphs(data: any): Paragraph[] {
    const paragraphs: Paragraph[] = []

    function addParagraphs(val: any, label: string = '', depth: number = 0) {
      if (val === null || val === undefined) return
      
      // Helper to check if value is simple
      const isSimple = (v: any) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      const isSimpleObject = (obj: any) => {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false
        return Object.values(obj).every(v => v === null || v === undefined || isSimple(v))
      }

      if (Array.isArray(val)) {
        if (val.length === 0) return
        
        // Single-item array - inline
        if (val.length === 1 && isSimple(val[0])) {
          if (label) {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
                new TextRun({ text: String(val[0]) }),
              ],
              spacing: { after: 120 },
              indent: { left: depth * 360 },
            }))
          }
          return
        }
        
        // Simple array - comma-separated inline
        if (val.every(isSimple)) {
          if (label) {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
                new TextRun({ text: val.join(', ') }),
              ],
              spacing: { after: 120 },
              indent: { left: depth * 360 },
            }))
          }
          return
        }
        
        // Complex array - bullet list
        if (label) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: `${label}:`, bold: true, color: '0b5c2d' }),
            ],
            spacing: { after: 80 },
            indent: { left: depth * 360 },
          }))
        }
        
        val.forEach(item => {
          if (isSimple(item)) {
            paragraphs.push(new Paragraph({
              text: `• ${String(item)}`,
              spacing: { after: 80 },
              indent: { left: (depth + 1) * 360 },
            }))
          } else if (typeof item === 'object') {
            Object.entries(item).forEach(([k, v]) => {
              addParagraphs(v, k.replace(/_/g, ' '), depth + 1)
            })
          }
        })
        return
      }
      
      if (typeof val === 'object') {
        // Simple object - inline
        if (isSimpleObject(val)) {
          const parts: string[] = []
          Object.entries(val).forEach(([k, v]) => {
            if (v !== null && v !== undefined) {
              const toText = (val: any): string => {
                if (val === null || val === undefined) return ''
                if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val)
                if (Array.isArray(val)) return val.map(toText).filter(Boolean).join(', ')
                if (typeof val === 'object') {
                  const inner = Object.entries(val as Record<string, unknown>)
                    .map(([kk, vv]) => `${kk.replace(/_/g, ' ')}: ${toText(vv)}`)
                    .filter(Boolean)
                    .join(', ')
                  return inner || '[object]'
                }
                return String(val)
              }
              const textVal = toText(v)
              parts.push(`${k.replace(/_/g, ' ')}: ${textVal}`)
            }
          })
          if (parts.length > 0 && label) {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
                new TextRun({ text: parts.join(', ') }),
              ],
              spacing: { after: 120 },
              indent: { left: depth * 360 },
            }))
          }
          return
        }
        
        // Complex object - nested section
        if (label) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, color: '0b5c2d' }),
            ],
            spacing: { after: 80 },
            indent: { left: depth * 360 },
          }))
        }
        
        Object.entries(val).forEach(([key, value]) => {
          addParagraphs(value, key.replace(/_/g, ' '), depth + 1)
        })
        return
      }
      
      // Simple value
      if (label) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
            new TextRun({ text: String(val) }),
          ],
          spacing: { after: 120 },
          indent: { left: depth * 360 },
        }))
      }
    }

    // Add title
    if (data.title || data.meta?.title) {
      paragraphs.push(new Paragraph({
        text: data.title || data.meta?.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 240 },
      }))
    }

    // Process all fields
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'title') return // Already added as heading
      addParagraphs(value, key.replace(/_/g, ' '), 0)
    })

    return paragraphs
  }

  async function saveScenario() {
    if (!generatedScenario) return
    
    try {
      setSaving(true)
      const scenarioToSave: ClinicalScenarioV3 = {
        ...generatedScenario,
        schema_version: generatedScenario.schema_version || '3.0.0',
      }
      await api.saveSpsScenario(scenarioToSave)
      setStatus('Scenario saved successfully!')
      setError('')
    } catch (e: unknown) {
      const message = formatApiError(e) || 'Unknown error'
      setError(`Failed to save: ${message}`)
      setStatus('')
    }
    finally {
      setSaving(false)
    }
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
                {' '}· scenarios: merged={debugCounts.merged ?? '?'} (registry={debugCounts.registry ?? '?'} + db={debugCounts.db ?? '?'})
              </p>
            </div>
          </div>
        )}
        <section className="casebuilder-main">
          {/* Tab Navigation & Actions */}
          <div className="cb-toolbar">
            <div className="cb-tabs">
              <button 
                className={`cb-tab ${view === 'scenarios' ? 'cb-tab-active' : ''}`}
                onClick={() => setView('scenarios')}
              >
                Scenarios ({scenarios.length})
              </button>
              <button 
                className={`cb-tab ${view === 'personas' ? 'cb-tab-active' : ''}`}
                onClick={() => setView('personas')}
              >
                Personas ({personas.length})
              </button>
            </div>
            <button 
              className="cb-btn cb-btn-primary"
              onClick={() => setShowGenerateModal(true)}
            >
              ✨ Generate New Scenario
            </button>
          </div>

          {/* Library Content */}
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
                  {/* Filters */}
                  <div className="cb-card cb-card--spaced">
                    <div className="cb-card-body cb-card-body--stack">
                      <div className="cb-grid">
                        <label className="cb-field cb-field--full">
                          <span>Search</span>
                          <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search title, tags, persona, region…"
                          />
                        </label>
                        <label className="cb-field">
                          <span>Region</span>
                          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
                            <option value="">All</option>
                            {REGION_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="cb-field">
                          <span>Difficulty</span>
                          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
                            <option value="">All</option>
                            <option value="easy">Easy</option>
                            <option value="moderate">Moderate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </label>
                        <label className="cb-field">
                          <span>Setting</span>
                          <select value={filterSetting} onChange={e => setFilterSetting(e.target.value)}>
                            <option value="">All</option>
                            <option value="outpatient">Outpatient</option>
                            <option value="inpatient">Inpatient</option>
                            <option value="acute_care">Acute Care</option>
                            <option value="home_health">Home Health</option>
                            <option value="sports_medicine">Sports Medicine</option>
                          </select>
                        </label>
                      </div>
                      <div className="cb-btn-group">
                        <span className="cb-muted">Showing {filteredScenarios.length} of {scenarios.length}</span>
                        <button
                          type="button"
                          className="cb-btn cb-btn-ghost"
                          onClick={() => { setSearch(''); setFilterRegion(''); setFilterDifficulty(''); setFilterSetting('') }}
                          disabled={!search && !filterRegion && !filterDifficulty && !filterSetting}
                        >
                          Clear filters
                        </button>
                      </div>
                    </div>
                  </div>
                  {scenarios.length === 0 ? (
                    <div className="cb-card">
                      <div className="cb-card-body">
                        <p>No scenarios found. Generate one to get started!</p>
                      </div>
                    </div>
                  ) : filteredScenarios.length === 0 ? (
                    <div className="cb-card">
                      <div className="cb-card-body">
                        <p>No scenarios match your filters.</p>
                        <div className="cb-btn-group cb-mt-2">
                          <button
                            type="button"
                            className="cb-btn cb-btn-ghost"
                            onClick={() => { setSearch(''); setFilterRegion(''); setFilterDifficulty(''); setFilterSetting('') }}
                          >
                            Clear filters
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <table className="cb-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Difficulty</th>
                          <th>Region</th>
                          <th>Setting</th>
                          <th>Persona</th>
                          <th>Tags</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScenarios.map(scenario => (
                          <tr key={scenario.scenario_id}>
                            <td className="cb-table-title">{scenario.title}</td>
                            <td>
                              {scenario.difficulty && (
                                <span className="cb-badge">{scenario.difficulty}</span>
                              )}
                            </td>
                            <td className="cb-table-region">{scenario.region}</td>
                            <td>{scenario.setting || '—'}</td>
                            <td>{scenario.persona_name || '—'}</td>
                            <td>
                              {scenario.tags && scenario.tags.length > 0 ? (
                                <div className="cb-tags-inline">
                                  {scenario.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="cb-tag-sm">{tag}</span>
                                  ))}
                                  {scenario.tags.length > 3 && (
                                    <span className="cb-tag-sm cb-tag-more">+{scenario.tags.length - 3}</span>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td>
                              <button
                                className="cb-btn cb-btn-sm cb-btn-ghost"
                                onClick={() => { void loadScenarioPreview(scenario.scenario_id) }}
                              >
                                👁 Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {view === 'personas' && (
                <div className="cb-table-container">
                  {personas.length === 0 ? (
                    <div className="cb-card">
                      <div className="cb-card-body">
                        <p>No personas found.</p>
                      </div>
                    </div>
                  ) : (
                    <table className="cb-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Age</th>
                          <th>Sex</th>
                          <th>Voice</th>
                          <th>Headline</th>
                          <th>Tags</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personas.map(persona => (
                          <tr key={persona.id}>
                            <td className="cb-table-title">{persona.display_name || persona.id}</td>
                            <td>{persona.age || '—'}</td>
                            <td>{persona.sex || '—'}</td>
                            <td>{persona.voice || '—'}</td>
                            <td className="cb-table-headline">{persona.headline || '—'}</td>
                            <td>
                              {persona.tags && persona.tags.length > 0 ? (
                                <div className="cb-tags-inline">
                                  {persona.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="cb-tag-sm">{tag}</span>
                                  ))}
                                  {persona.tags.length > 3 && (
                                    <span className="cb-tag-sm cb-tag-more">+{persona.tags.length - 3}</span>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td>
                              <button
                                className="cb-btn cb-btn-sm cb-btn-ghost"
                                onClick={() => { void loadPersonaPreview(persona.id) }}
                              >
                                👁 Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Scenario Preview Modal */}
      {previewScenario && (
        <div className="cb-modal-overlay" onClick={() => setPreviewScenario(null)}>
          <div className="cb-modal cb-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h2>Scenario JSON Schema</h2>
              <button 
                className="cb-modal-close"
                onClick={() => setPreviewScenario(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="cb-modal-body">
              {isLoadingPreview(previewScenario) || loadingPreview ? (
                <div className="cb-loading-state">
                  <p>⏳ Loading scenario data...</p>
                </div>
              ) : isErrorPreview(previewScenario) ? (
                <div className="casebuilder-callout casebuilder-callout--error">
                  <strong>Error:</strong> {previewScenario.error}
                </div>
              ) : isScenarioData(previewScenario) ? (
                <div className="cb-preview-container">
                  <div className="cb-preview-toolbar">
                    <span className="cb-preview-info">
                      {previewScenario.meta?.title || previewScenario.scenario_id || 'Scenario'}
                    </span>
                    <div className="cb-preview-actions">
                      {previewMode === 'formatted' && (
                        <>
                          <button
                            className="cb-print-btn"
                            onClick={() => { void exportToWord() }}
                            title="Download as Word document"
                          >
                            📄 Download Word
                          </button>
                          <button
                            className="cb-print-btn"
                            onClick={() => window.print()}
                            title="Print formatted scenario"
                          >
                            🖨️ Print
                          </button>
                        </>
                      )}
                      <div className="cb-toggle-group">
                        <button 
                          className={`cb-toggle-btn ${previewMode === 'formatted' ? 'cb-toggle-active' : ''}`}
                          onClick={() => setPreviewMode('formatted')}
                        >
                          📄 Formatted
                        </button>
                        <button 
                          className={`cb-toggle-btn ${previewMode === 'json' ? 'cb-toggle-active' : ''}`}
                          onClick={() => setPreviewMode('json')}
                        >
                          {} JSON
                        </button>
                      </div>
                      <button 
                        className="cb-btn cb-btn-sm cb-btn-ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(JSON.stringify(previewScenario, null, 2))
                        }}
                      >
                        📋 Copy JSON
                      </button>
                    </div>
                  </div>
                  
                  {previewMode === 'json' ? (
                    <pre className="casebuilder-json casebuilder-json-large">
                      {JSON.stringify(previewScenario, null, 2)}
                    </pre>
                  ) : (
                    <div className="cb-outline-view">
                      {renderOutline(previewScenario)}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Persona Preview Modal */}
      {previewPersona && (
        <div className="cb-modal-overlay" onClick={() => setPreviewPersona(null)}>
          <div className="cb-modal cb-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h2>Persona Details</h2>
              <button 
                className="cb-modal-close"
                onClick={() => setPreviewPersona(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="cb-modal-body">
              {previewPersona.loading || loadingPreview ? (
                <div className="cb-loading-state">
                  <p>⏳ Loading persona data...</p>
                </div>
              ) : previewPersona.error ? (
                <div className="casebuilder-callout casebuilder-callout--error">
                  <strong>Error:</strong> {previewPersona.error}
                </div>
              ) : (
                <div className="cb-preview-container">
                  <div className="cb-preview-toolbar">
                    <span className="cb-preview-info">
                      {previewPersona.display_name || previewPersona.patient_id || 'Persona'}
                    </span>
                    <div className="cb-preview-actions">
                      {previewMode === 'formatted' && (
                        <>
                          <button
                            className="cb-print-btn"
                            onClick={() => { void exportToWord() }}
                            title="Download as Word document"
                          >
                            📄 Download Word
                          </button>
                          <button
                            className="cb-print-btn"
                            onClick={() => window.print()}
                            title="Print formatted persona"
                          >
                            🖨️ Print
                          </button>
                        </>
                      )}
                      <div className="cb-toggle-group">
                        <button 
                          className={`cb-toggle-btn ${previewMode === 'formatted' ? 'cb-toggle-active' : ''}`}
                          onClick={() => setPreviewMode('formatted')}
                        >
                          📄 Formatted
                        </button>
                        <button 
                          className={`cb-toggle-btn ${previewMode === 'json' ? 'cb-toggle-active' : ''}`}
                          onClick={() => setPreviewMode('json')}
                        >
                          {} JSON
                        </button>
                      </div>
                      <button 
                        className="cb-btn cb-btn-sm cb-btn-ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(JSON.stringify(previewPersona, null, 2))
                        }}
                      >
                        📋 Copy JSON
                      </button>
                    </div>
                  </div>
                  
                  {previewMode === 'json' ? (
                    <pre className="casebuilder-json casebuilder-json-large">
                      {JSON.stringify(previewPersona, null, 2)}
                    </pre>
                  ) : (
                    <div className="cb-outline-view">
                      {renderOutline(previewPersona)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Generation Modal */}
      {showGenerateModal && (
        <div className="cb-modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="cb-modal" onClick={e => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h2>Generate Scenario with AI</h2>
              <button 
                className="cb-modal-close"
                onClick={() => setShowGenerateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="cb-modal-body">
              <section className="cb-card">
                <div className="cb-card-header">
                  <h3>Generate with AI</h3>
                  <p>Describe the clinical case. The assistant will produce a complete Schema v3 scenario.</p>
                </div>
            <div className="cb-card-body cb-card-body--stack">
              <label className="cb-field">
                <span>Case prompt</span>
                <textarea
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder="Describe the case you want to create..."
                  rows={6}
                />
              </label>

              <div className="cb-grid">
                <label>
                  <span>Primary region</span>
                  <select value={genRegion} onChange={e => setGenRegion(e.target.value as ScenarioRegion)}>
                    {REGION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="cb-switch">
                <input
                  type="checkbox"
                  checked={genResearch}
                  onChange={e => setGenResearch(e.target.checked)}
                />
                <span>Include evidence sweep (slower, fetches up to five sources)</span>
              </label>

              {error && (
                <div className="casebuilder-callout casebuilder-callout--error" role="alert">
                  {error.split('\n').map((line, idx) => (
                    <span key={idx}>{line}</span>
                  ))}
                </div>
              )}

              {!error && status && (
                <div className="casebuilder-callout casebuilder-callout--success" role="status">
                  {status}
                </div>
              )}

              <div className="cb-btn-group">
                <button
                  className="cb-btn cb-btn-primary"
                  onClick={() => { void generateWithAI() }}
                  disabled={generating || !genPrompt.trim()}
                >
                  {generating ? '⏳ Generating…' : '✨ Generate Scenario'}
                </button>
                <button
                  className="cb-btn cb-btn-ghost"
                  type="button"
                  onClick={() => {
                    setGenPrompt(DEFAULT_PROMPT)
                    setGenRegion('hip')
                    setGenResearch(false)
                    setError('')
                    setStatus('')
                  }}
                >
                  Reset inputs
                </button>
              </div>
            </div>
          </section>

          {generatedScenario && (
            <section className="cb-card cb-card--code">
              <div className="cb-card-header">
                <h3>Schema output</h3>
                <p>Review the generated JSON before saving to the catalog.</p>
              </div>
              <div className="cb-card-body">
                {sources.length > 0 && (
                  <div className="casebuilder-source-list">
                    <strong>Evidence sources ({sources.length})</strong>
                    <ul>
                      {sources.map((s, i) => (
                        <li key={`${s.url}-${i}`}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.title || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <pre className="casebuilder-json">
                  {JSON.stringify(generatedScenario, null, 2)}
                </pre>
              </div>
              <div className="cb-card-footer">
                <button
                  className="cb-btn cb-btn-primary cb-btn-full"
                  onClick={() => {
                    void (async () => {
                      await saveScenario()
                      // Reload scenarios after save
                      const scenariosData = await api.listSpsScenarios()
                      setScenarios(scenariosData)
                      setShowGenerateModal(false)
                    })()
                  }}
                  disabled={saving}
                >
                  {saving ? '💾 Saving…' : '💾 Save Scenario'}
                </button>
              </div>
            </section>
          )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
