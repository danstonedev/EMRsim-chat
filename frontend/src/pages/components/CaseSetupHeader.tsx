import { Link } from 'react-router-dom'
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'

interface CaseSetupHeaderProps {
  logOpen: boolean
  openLog: () => void
  sessionId?: string | null
}

export default function CaseSetupHeader({ logOpen, openLog, sessionId }: CaseSetupHeaderProps) {
  const handlePrintClick = () => {
    if (sessionId) {
      window.open(`/transcript/${sessionId}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <header className="header app-nav app-nav--dark" role="banner">
      <div className="nav-inner">
        <div className="nav-brand">
          <Link to="/" className="title header__brand bruno-ace-regular" aria-label="Application Home">
            VSPx
          </Link>
        </div>
        <div className="nav-spacer" />
        <nav className="header-nav" aria-label="Primary">
          <button
            type="button"
            className="nav-pill nav-pill--icon"
            onClick={handlePrintClick}
            disabled={!sessionId}
            aria-label="View Encounter Transcript"
            title={sessionId ? "View Encounter Transcript" : "No active session"}
          >
            <PrintOutlinedIcon fontSize="small" />
            <span className="sr-only">Transcript</span>
          </button>
          <button
            type="button"
            className="nav-pill nav-pill--icon"
            data-active={logOpen}
            onClick={() => openLog()}
            aria-haspopup="dialog"
            aria-label="Diagnostics"
            title="Diagnostics"
          >
            <TroubleshootOutlinedIcon fontSize="small" />
            <span className="sr-only">Diagnostics</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
