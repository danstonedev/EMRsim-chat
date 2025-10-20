import { PreviewModal } from './PreviewModal'
import type { PreviewMode, PersonaPreview } from '../types'
import { isErrorPreview, isLoadingPreview, isPersonaData } from '../types'
import { getPersonaDisplayName, renderOutline } from '../utils'

export type PersonaPreviewModalProps = {
  preview: PersonaPreview
  loading: boolean
  previewMode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  onClose: () => void
  onExportWord: () => void
}

export function PersonaPreviewModal({
  preview,
  loading,
  previewMode,
  onModeChange,
  onClose,
  onExportWord,
}: PersonaPreviewModalProps) {
  const jsonContent = preview ? JSON.stringify(preview, null, 2) : '{}'
  const errorMessage = isErrorPreview(preview) ? preview.error : null
  const infoLabel = getPersonaDisplayName(preview)
  const formattedContent = isPersonaData(preview) ? renderOutline(preview) : null

  return (
    <PreviewModal
      title="Persona Details"
      infoLabel={infoLabel}
      previewMode={previewMode}
      onModeChange={onModeChange}
      onClose={onClose}
      onExportWord={onExportWord}
      onCopyJson={() => { void navigator.clipboard.writeText(jsonContent) }}
      loading={loading || isLoadingPreview(preview)}
      loadingMessage="⏳ Loading persona data..."
      errorMessage={errorMessage}
      formattedContent={formattedContent}
      jsonContent={jsonContent}
      printTooltip="Print formatted persona"
      exportTooltip="Download as Word document"
    />
  )
}
