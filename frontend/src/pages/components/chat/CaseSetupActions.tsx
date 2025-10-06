import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PrintIcon from '@mui/icons-material/Print'
import SettingsIcon from '@mui/icons-material/Settings'
import type { ReactElement } from 'react'

type CaseSetupActionsProps = {
  shouldShowMicControl: boolean
  renderMicControl: () => ReactElement
  onOpenSettings: () => void
  personaId: string | null
  scenarioId: string
  printDropdownOpen: boolean
  setPrintDropdownOpen: (open: boolean) => void
  onPrintScenario: () => boolean
  onPrintTranscript: () => boolean
  sessionId: string | null
}

export function CaseSetupActions({
  shouldShowMicControl,
  renderMicControl,
  onOpenSettings,
  personaId,
  scenarioId,
  printDropdownOpen,
  setPrintDropdownOpen,
  onPrintScenario,
  onPrintTranscript,
  sessionId,
}: CaseSetupActionsProps) {
  const canPrint = Boolean(personaId && scenarioId)
  const printTitle = canPrint ? 'Print options' : 'Select persona and scenario to print'

  return (
    <div className="case-setup-inline__icon-actions">
      {shouldShowMicControl && renderMicControl()}

      <button
        type="button"
        className="icon-btn"
        onClick={onOpenSettings}
        aria-label="Advanced settings"
        title="Advanced settings"
      >
        <SettingsIcon />
      </button>

      <div className="print-dropdown-container">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
          disabled={!canPrint}
          aria-label="Print options"
          aria-haspopup="menu"
          title={printTitle}
        >
          <PrintIcon fontSize="small" />
          <ExpandMoreIcon className="print-dropdown-chevron" sx={{ fontSize: 12 }} />
        </button>
        {printDropdownOpen && (
          <div className="print-dropdown-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="print-dropdown-item"
              onClick={() => {
                if (onPrintScenario()) {
                  setPrintDropdownOpen(false)
                }
              }}
            >
              Print Scenario
            </button>
            <button
              type="button"
              role="menuitem"
              className="print-dropdown-item"
              onClick={() => {
                if (onPrintTranscript()) {
                  setPrintDropdownOpen(false)
                }
              }}
              disabled={!sessionId}
            >
              Print Transcript
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
