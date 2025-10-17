import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CaseBuilder from './CaseBuilder'
import '../styles/index.css'

export default function CaseBuilderPage() {
  const navigate = useNavigate()
  const goChat = useCallback(() => navigate('/voice'), [navigate])
  const goViewer = useCallback(() => navigate('/3d-viewer'), [navigate])

  return (
    <div className="app-root app-shell">
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
                <button type="button" className="nav-pill" onClick={goChat} title="Back to Chat">
                  Back to Chat
                </button>
              </li>
              <li>
                <button type="button" className="nav-pill" onClick={goViewer} title="Open 3D Anatomy Viewer">
                  3D Viewer
                </button>
              </li>
            </ul>
          </nav>
          <div className="nav-spacer" />
        </div>
      </header>

      <div className="app-body-row">
        <main className="main main--builder">
          <CaseBuilder />
        </main>
      </div>
    </div>
  )
}
