import { useState, useEffect } from 'react'
import { api } from '../shared/api'
import type { ClinicalScenarioV3, ScenarioRegion, ScenarioSourceLite } from '../shared/types/scenario'
import { saveAs } from 'file-saver'
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'

type ScenarioLite = {
  scenario_id: string
  title: string
  region: string
  difficulty?: string | null
  setting?: string | null
  tags?: string[]
  persona_id?: string | null
  persona_name?: string | null
  persona_headline?: string | null
}

type PersonaLite = {
  id: string
  display_name: string | null
  headline: string | null
  age?: number | null
  sex?: string | null
  voice?: string | null
  tags?: string[]
}

const REGION_OPTIONS: Array<{ value: ScenarioRegion; label: string }> = [
  { value: 'hip', label: 'Hip' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle_foot', label: 'Ankle/Foot' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'cervical_spine', label: 'Cervical Spine' },
  { value: 'lumbar_spine', label: 'Lumbar Spine' },
  { value: 'thoracic_spine', label: 'Thoracic Spine' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist_hand', label: 'Wrist/Hand' },
  { value: 'sports_trauma_general', label: 'Sports/Trauma' },
]

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
          .map((issue: any) => issue?.message || issue?.path?.join?.('.') || issue?.code)
          .filter(Boolean)
          .slice(0, 5)
        if (details.length) {
          return `Schema validation failed:\n${details.join('\n')}`
        }
        return 'Scenario failed schema validation on the server.'
      }
      if (typeof parsed?.error === 'string') {
        return parsed.error.replace(/_/g, ' ')
      }
    } catch {
      // Ignore JSON parse errors and fall back to the raw message
    }
  }

  return raw
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
  
  // Preview modal (for both scenarios and personas)
  const [previewScenario, setPreviewScenario] = useState<any>(null)
  const [previewPersona, setPreviewPersona] = useState<any>(null)
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
        const [scenariosData, personasData] = await Promise.all([
          api.listSpsScenarios(),
          api.getSpsPersonas()
        ])
        setScenarios(scenariosData)
        setPersonas(personasData)
      } catch (e) {
        console.error('Failed to load library:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

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
        const parts = keys.map(k => `${k.replace(/_/g, ' ')}: ${value[k]}`)
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
  
  function renderOutline(data: any) {
    return renderValue(data, 0)
  }

  // Load full scenario for preview
  async function loadScenarioPreview(scenarioId: string) {
    console.log('[CaseBuilder] Loading scenario preview:', scenarioId)
    setPreviewScenario({ loading: true }) // Open modal immediately
    setLoadingPreview(true)
    try {
      const scenario = await api.getSpsScenarioById(scenarioId)
      console.log('[CaseBuilder] Scenario loaded:', scenario)
      setPreviewScenario(scenario)
    } catch (e) {
      console.error('[CaseBuilder] Failed to load scenario preview:', e)
      setPreviewScenario({ error: `Failed to load scenario: ${e}` })
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
      console.log('[CaseBuilder] Persona loaded:', persona)
      setPreviewPersona(persona)
    } catch (e) {
      console.error('[CaseBuilder] Failed to load persona preview:', e)
      setPreviewPersona({ error: `Failed to load persona: ${e}` })
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
    } catch (e: any) {
      console.error('Generation failed:', e)
      setError(formatApiError(e))
      setStatus('')
    } finally {
      setGenerating(false)
    }
  }

  async function exportToWord() {
    const data = previewScenario || previewPersona
    if (!data) return

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
    const filename = previewScenario 
      ? `${previewScenario.title || previewScenario.scenario_id || 'scenario'}.docx`
      : `${previewPersona.display_name || previewPersona.patient_id || 'persona'}.docx`
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
              parts.push(`${k.replace(/_/g, ' ')}: ${v}`)
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
    } catch (e: any) {
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
              {view === 'scenarios' && (
                <div className="cb-table-container">
                  {scenarios.length === 0 ? (
                    <div className="cb-card">
                      <div className="cb-card-body">
                        <p>No scenarios found. Generate one to get started!</p>
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
                        {scenarios.map(scenario => (
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
                                onClick={() => loadScenarioPreview(scenario.scenario_id)}
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
                                onClick={() => loadPersonaPreview(persona.id)}
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
              {previewScenario.loading || loadingPreview ? (
                <div className="cb-loading-state">
                  <p>⏳ Loading scenario data...</p>
                </div>
              ) : previewScenario.error ? (
                <div className="casebuilder-callout casebuilder-callout--error">
                  <strong>Error:</strong> {previewScenario.error}
                </div>
              ) : (
                <div className="cb-preview-container">
                  <div className="cb-preview-toolbar">
                    <span className="cb-preview-info">
                      {previewScenario.title || previewScenario.meta?.title || previewScenario.scenario_id || 'Scenario'}
                    </span>
                    <div className="cb-preview-actions">
                      {previewMode === 'formatted' && (
                        <>
                          <button
                            className="cb-print-btn"
                            onClick={exportToWord}
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
                          navigator.clipboard.writeText(JSON.stringify(previewScenario, null, 2))
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
              )}
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
                            onClick={exportToWord}
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
                          navigator.clipboard.writeText(JSON.stringify(previewPersona, null, 2))
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
                  onClick={generateWithAI}
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
                  onClick={async () => {
                    await saveScenario()
                    // Reload scenarios after save
                    const scenariosData = await api.listSpsScenarios()
                    setScenarios(scenariosData)
                    setShowGenerateModal(false)
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
