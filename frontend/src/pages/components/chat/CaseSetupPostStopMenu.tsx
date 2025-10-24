import PrintIcon from '@mui/icons-material/Print'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { createPortal } from 'react-dom'
import { useEffect, useMemo } from 'react'

type CaseSetupPostStopMenuProps = {
  open: boolean
  onClose: () => void
  onPrintTranscript: () => boolean
  onContinue?: () => void | Promise<void>
  sessionId: string | null
}

export function CaseSetupPostStopMenu({ open, onClose, onPrintTranscript, onContinue, sessionId }: CaseSetupPostStopMenuProps) {
  const container = useMemo(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.setAttribute('data-portal-root', 'encounter-end-modal')
    return el
  }, [])

  useEffect(() => {
    if (!open || !container || typeof document === 'undefined') return
    document.body.appendChild(container)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      try { document.body.removeChild(container) } catch { /* ignore */ }
    }
  }, [open, container])

  if (!open || !container) return null

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

  return createPortal(
    <>
      {/* Backdrop - no onClick to prevent closing on backdrop click */}
      <div className="encounter-end-backdrop" />

      {/* Centered Modal */}
      <div
        className="encounter-end-modal"
        role="dialog"
        aria-labelledby="encounter-end-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="encounter-end-modal__header">
          <CheckCircleOutlineIcon className="encounter-end-modal__icon" />
          <h2 id="encounter-end-title" className="encounter-end-modal__title">
            Encounter Complete
          </h2>
          <p className="encounter-end-modal__subtitle">What would you like to do next?</p>
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
            <span>Restart</span>
          </button>
        </div>
      </div>
    </>,
    container
  )
}
