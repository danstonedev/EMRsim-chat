interface CaseSetupHeaderProps {
  view: 'chat' | 'builder'
  setView: (v: 'chat' | 'builder') => void
  logOpen: boolean
  openLog: () => void
}

export default function CaseSetupHeader({ view, setView, logOpen, openLog }: CaseSetupHeaderProps) {
  return (
    <header className="header app-nav app-nav--dark" role="banner">
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="title header__brand bruno-ace-regular" aria-label="Application">
            VSPx
          </div>
        </div>
        <nav className="header-nav" aria-label="Primary">
          <ul className="nav-tabs">
            <li>
              <button
                type="button"
                className="nav-pill"
                data-active={view === 'builder'}
                onClick={() => setView(view === 'chat' ? 'builder' : 'chat')}
                title={view === 'chat' ? 'Open Case Builder' : 'Back to Chat'}
              >
                {view === 'chat' ? 'Case Builder' : 'Back to Chat'}
              </button>
            </li>
            <li>
              <a href="/3d-viewer" className="nav-pill" title="Open 3D Anatomy Viewer">
                3D Viewer
              </a>
            </li>
            <li>
              <button
                type="button"
                className="nav-pill"
                data-active={logOpen}
                onClick={() => openLog()}
                aria-haspopup="dialog"
              >
                Diagnostics
              </button>
            </li>
          </ul>
        </nav>
        <div className="nav-spacer" />
      </div>
    </header>
  )
}
