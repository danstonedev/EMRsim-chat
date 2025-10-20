import { PreviewModal } from './PreviewModal'
import type { PreviewMode, ScenarioPreview } from '../types'
import { isErrorPreview, isLoadingPreview, isScenarioData } from '../types'
import { getScenarioDisplayName, renderOutline } from '../utils'

export type ScenarioPreviewModalProps = {
  preview: ScenarioPreview
  loading: boolean
  previewMode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  onClose: () => void
  onExportWord: () => void
}

export function ScenarioPreviewModal({
  preview,
  loading,
  previewMode,
  onModeChange,
  onClose,
  onExportWord,
}: ScenarioPreviewModalProps) {
  const jsonContent = preview ? JSON.stringify(preview, null, 2) : '{}'
  const errorMessage = isErrorPreview(preview) ? preview.error : null
  const infoLabel = getScenarioDisplayName(preview)
  const formattedContent = isScenarioData(preview) ? renderOutline(preview) : null

  return (
    <PreviewModal
      title="Scenario JSON Schema"
      infoLabel={infoLabel}
      previewMode={previewMode}
      onModeChange={onModeChange}
      onClose={onClose}
      onExportWord={onExportWord}
      onCopyJson={() => { void navigator.clipboard.writeText(jsonContent) }}
      loading={loading || isLoadingPreview(preview)}
      loadingMessage="⏳ Loading scenario data..."
      errorMessage={errorMessage}
      formattedContent={formattedContent}
      jsonContent={jsonContent}
      printTooltip="Print formatted scenario"
      exportTooltip="Download as Word document"
    />
  )
}
