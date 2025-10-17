import PrintIcon from '@mui/icons-material/Print'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

type CaseSetupPostStopMenuProps = {
  open: boolean
  onClose: () => void
  onPrintTranscript: () => boolean
  onContinue?: () => void | Promise<void>
  sessionId: string | null
}

export function CaseSetupPostStopMenu({ open, onClose, onPrintTranscript, onContinue, sessionId }: CaseSetupPostStopMenuProps) {
  if (!open) {
    return null
  }

  const handlePrintTranscript = () => {
    console.log('[CaseSetupPostStopMenu] View Transcript clicked, sessionId:', sessionId)
    const success = onPrintTranscript()
    console.log('[CaseSetupPostStopMenu] onPrintTranscript returned:', success)
    if (success) {
      onClose()
    }
  }

  const handleContinue = () => {
    console.log('[CaseSetupPostStopMenu] Continue clicked - resetting session')
    onClose()
    if (onContinue) {
      void onContinue()
    }
  }

  // Handle Escape key to close modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="encounter-end-backdrop" onClick={onClose} />
      
      {/* Centered Modal */}
      <div 
        className="encounter-end-modal" 
        role="dialog" 
        aria-labelledby="encounter-end-title" 
        aria-modal="true"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="encounter-end-modal__header">
          <CheckCircleOutlineIcon className="encounter-end-modal__icon" />
          <h2 id="encounter-end-title" className="encounter-end-modal__title">
            Encounter Complete
          </h2>
          <p className="encounter-end-modal__subtitle">
            What would you like to do next?
          </p>
        </div>

        <div className="encounter-end-modal__actions">
          <button
            type="button"
            className="encounter-end-modal__button encounter-end-modal__button--primary"
            onClick={handlePrintTranscript}
            disabled={!sessionId}
            title={!sessionId ? 'No encounter in progress' : 'Open printable transcript'}
          >
            <PrintIcon fontSize="small" />
            <span>View Transcript</span>
          </button>
          
          <button
            type="button"
            className="encounter-end-modal__button encounter-end-modal__button--secondary"
            onClick={handleContinue}
          >
            <span>Continue</span>
          </button>
        </div>
      </div>
    </>
  )
}
