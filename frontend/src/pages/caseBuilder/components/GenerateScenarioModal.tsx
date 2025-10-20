import type { MouseEvent } from 'react'
import type { ClinicalScenarioV3, ScenarioRegion, ScenarioSourceLite } from '../types'

export type GenerateScenarioModalProps = {
  prompt: string
  region: ScenarioRegion
  includeResearch: boolean
  error: string
  status: string
  generating: boolean
  saving: boolean
  generatedScenario: ClinicalScenarioV3 | null
  sources: ScenarioSourceLite[]
  regionOptions: Array<{ value: ScenarioRegion; label: string }>
  onClose: () => void
  onPromptChange: (value: string) => void
  onRegionChange: (value: ScenarioRegion) => void
  onIncludeResearchChange: (value: boolean) => void
  onGenerate: () => void
  onReset: () => void
  onSave: () => void
}

export function GenerateScenarioModal({
  prompt,
  region,
  includeResearch,
  error,
  status,
  generating,
  saving,
  generatedScenario,
  sources,
  regionOptions,
  onClose,
  onPromptChange,
  onRegionChange,
  onIncludeResearchChange,
  onGenerate,
  onReset,
  onSave,
}: GenerateScenarioModalProps) {
  const handleOverlayClick = () => onClose()

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <div className="cb-modal-overlay" onClick={handleOverlayClick}>
      <div className="cb-modal" onClick={stopPropagation}>
        <div className="cb-modal-header">
          <h2>Generate Scenario with AI</h2>
          <button className="cb-modal-close" onClick={onClose} aria-label="Close">
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
                  value={prompt}
                  onChange={event => onPromptChange(event.target.value)}
                  placeholder="Describe the case you want to create..."
                  rows={6}
                />
              </label>

              <div className="cb-grid">
                <label>
                  <span>Primary region</span>
                  <select value={region} onChange={event => onRegionChange(event.target.value as ScenarioRegion)}>
                    {regionOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="cb-switch">
                <input
                  type="checkbox"
                  checked={includeResearch}
                  onChange={event => onIncludeResearchChange(event.target.checked)}
                />
                <span>Include evidence sweep (slower, fetches up to five sources)</span>
              </label>

              {error && (
                <div className="casebuilder-callout casebuilder-callout--error" role="alert">
                  {error.split('\n').map((line, index) => (
                    <span key={index}>{line}</span>
                  ))}
                </div>
              )}

              {!error && status && (
                <div className="casebuilder-callout casebuilder-callout--success" role="status">
                  {status}
                </div>
              )}

              <div className="cb-btn-group">
                <button className="cb-btn cb-btn-primary" onClick={onGenerate} disabled={generating || !prompt.trim()}>
                  {generating ? '⏳ Generating…' : '✨ Generate Scenario'}
                </button>
                <button className="cb-btn cb-btn-ghost" type="button" onClick={onReset}>
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
                      {sources.map((source, index) => (
                        <li key={`${source.url}-${index}`}>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.title || source.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <pre className="casebuilder-json">{JSON.stringify(generatedScenario, null, 2)}</pre>
              </div>
              <div className="cb-card-footer">
                <button className="cb-btn cb-btn-primary cb-btn-full" onClick={onSave} disabled={saving}>
                  {saving ? '💾 Saving…' : '💾 Save Scenario'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
