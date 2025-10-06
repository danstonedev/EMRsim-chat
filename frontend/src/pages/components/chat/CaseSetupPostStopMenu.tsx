import CloseIcon from '@mui/icons-material/Close'
import PrintIcon from '@mui/icons-material/Print'

type CaseSetupPostStopMenuProps = {
  open: boolean
  onClose: () => void
  onPrintTranscript: () => boolean
  sessionId: string | null
}

export function CaseSetupPostStopMenu({ open, onClose, onPrintTranscript, sessionId }: CaseSetupPostStopMenuProps) {
  if (!open) {
    return null
  }

  const handlePrintTranscript = () => {
    if (onPrintTranscript()) {
      onClose()
    }
  }

  return (
    <div className="mic-poststop-container">
      <div className="mic-poststop-menu" role="dialog" aria-label="Encounter ended actions">
        <button type="button" className="mic-poststop-close" aria-label="Close" onClick={onClose} title="Close">
          <CloseIcon fontSize="small" />
        </button>
        <div className="mic-poststop-actions">
          <button
            type="button"
            className="mic-popover-item"
            onClick={handlePrintTranscript}
            disabled={!sessionId}
            title={!sessionId ? 'No encounter in progress' : 'Open printable transcript'}
          >
            <PrintIcon fontSize="small" />
            <span>Print transcript</span>
          </button>
          <button type="button" className="mic-popover-item" onClick={onClose} title="Close">
            <CloseIcon fontSize="small" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  )
}
