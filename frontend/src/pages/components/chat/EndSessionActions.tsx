import { useEffect, useRef, useState } from 'react'
import PrintIcon from '@mui/icons-material/Print'

type EndSessionActionsProps = {
  open: boolean
  onClose: () => void
  onPrintTranscript: () => boolean
  onPrintTranscriptAsync?: () => Promise<boolean>
  onOpenFacultyKey?: () => boolean
  // Restart the same scenario immediately (compose + optionally auto-start voice handled upstream)
  onRestartNow?: () => void | Promise<void>
  // Return to the setup pickers without auto-restarting; upstream should clear state
  onNewScenario?: () => void | Promise<void>
  sessionId: string | null
}

export function EndSessionActions({ open, onClose, onPrintTranscript, onPrintTranscriptAsync, onOpenFacultyKey, onRestartNow, onNewScenario, sessionId }: EndSessionActionsProps) {
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  useEffect(() => {
    if (open) {
      // Move focus to the primary action for quick keyboard access
      primaryBtnRef.current?.focus()
    }
  }, [open])
  if (!open) return null

  const handlePrint = async () => {
    if (isPrinting) return
    if (onPrintTranscriptAsync) {
      setIsPrinting(true)
      try {
        const ok = await onPrintTranscriptAsync()
        if (ok) onClose()
      } finally {
        setIsPrinting(false)
      }
    } else {
      const ok = onPrintTranscript()
      if (ok) onClose()
    }
  }

  const handleFacultyKey = () => {
    if (!onOpenFacultyKey) return
    const ok = onOpenFacultyKey()
    if (ok) onClose()
  }

  const handleRestartNow = () => {
    onClose()
    if (onRestartNow) void onRestartNow()
  }

  const handleNewScenario = () => {
    onClose()
    if (onNewScenario) void onNewScenario()
  }

  return (
    <div className="end-actions-bar mic-poststop-container" role="region" aria-label="Encounter complete actions">
      <div className="end-actions-bar__inner">
        <div className="end-actions-bar__title">Encounter complete</div>
        <div className="end-actions-bar__actions">
          <button
            type="button"
            className="end-actions-bar__btn end-actions-bar__btn--primary"
            ref={primaryBtnRef}
            onClick={handlePrint}
            disabled={!sessionId || isPrinting}
            title={!sessionId ? 'No transcript available yet' : isPrinting ? 'Preparing transcript…' : 'Open printable transcript'}
          >
            {isPrinting ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <PrintIcon fontSize="small" />
            )}
            <span>{isPrinting ? 'Preparing…' : 'View Transcript'}</span>
          </button>

          <button
            type="button"
            className="end-actions-bar__btn"
            onClick={handleFacultyKey}
            title="Open Faculty Key (case narrative)"
          >
            Faculty Key
          </button>

          <button
            type="button"
            className="end-actions-bar__btn"
            onClick={handleRestartNow}
          >
            Restart Now
          </button>

          <button
            type="button"
            className="end-actions-bar__btn"
            onClick={handleNewScenario}
          >
            New Scenario
          </button>
        </div>
      </div>
    </div>
  )
}

export default EndSessionActions
