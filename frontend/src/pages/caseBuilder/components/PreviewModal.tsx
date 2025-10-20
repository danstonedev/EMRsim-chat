import type { ReactNode, MouseEvent } from 'react'
import type { PreviewMode } from '../types'

export type PreviewModalProps = {
  title: string
  infoLabel: string
  previewMode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  onClose: () => void
  onExportWord?: () => void
  onCopyJson: () => void
  loading: boolean
  loadingMessage: string
  errorMessage: string | null
  formattedContent: ReactNode
  jsonContent: string
  printTooltip: string
  exportTooltip: string
}

export function PreviewModal({
  title,
  infoLabel,
  previewMode,
  onModeChange,
  onClose,
  onExportWord,
  onCopyJson,
  loading,
  loadingMessage,
  errorMessage,
  formattedContent,
  jsonContent,
  printTooltip,
  exportTooltip,
}: PreviewModalProps) {
  const handleOverlayClick = () => onClose()

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <div className="cb-modal-overlay" onClick={handleOverlayClick}>
      <div className="cb-modal cb-modal-wide" onClick={stopPropagation}>
        <div className="cb-modal-header">
          <h2>{title}</h2>
          <button className="cb-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="cb-modal-body">
          {loading ? (
            <div className="cb-loading-state">
              <p>{loadingMessage}</p>
            </div>
          ) : errorMessage ? (
            <div className="casebuilder-callout casebuilder-callout--error">
              <strong>Error:</strong> {errorMessage}
            </div>
          ) : (
            <div className="cb-preview-container">
              <div className="cb-preview-toolbar">
                <span className="cb-preview-info">{infoLabel}</span>
                <div className="cb-preview-actions">
                  {previewMode === 'formatted' && (
                    <>
                      {onExportWord && (
                        <button className="cb-print-btn" onClick={onExportWord} title={exportTooltip}>
                          📄 Download Word
                        </button>
                      )}
                      <button className="cb-print-btn" onClick={() => window.print()} title={printTooltip}>
                        🖨️ Print
                      </button>
                    </>
                  )}
                  <div className="cb-toggle-group">
                    <button
                      className={`cb-toggle-btn ${previewMode === 'formatted' ? 'cb-toggle-active' : ''}`}
                      onClick={() => onModeChange('formatted')}
                    >
                      📄 Formatted
                    </button>
                    <button
                      className={`cb-toggle-btn ${previewMode === 'json' ? 'cb-toggle-active' : ''}`}
                      onClick={() => onModeChange('json')}
                    >
                      {} JSON
                    </button>
                  </div>
                  <button className="cb-btn cb-btn-sm cb-btn-ghost" onClick={onCopyJson}>
                    📋 Copy JSON
                  </button>
                </div>
              </div>
              {previewMode === 'json' ? (
                <pre className="casebuilder-json casebuilder-json-large">{jsonContent}</pre>
              ) : (
                <div className="cb-outline-view">{formattedContent}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
