import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../shared/api'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import PauseIcon from '@mui/icons-material/Pause'

type Turn = {
  id: string
  role: string
  text: string
  created_at: string
}

export default function TranscriptPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [turns, setTurns] = useState<Turn[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(true)

  // Compute a friendly date once
  const sessionDate = useMemo(() => {
    return new Date().toLocaleDateString()
  }, [])

  // Load transcript data
  useEffect(() => {
    let cancelled = false
    let pollInterval: number | null = null

    async function load() {
      if (!sessionId) {
        setError('Missing sessionId in URL')
        setTurns([])
        return
      }
      try {
        const data = await api.getSessionTurns(sessionId)
        if (!cancelled) {
          setTurns(data as Turn[])
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load transcript')
          setTurns([])
        }
      }
    }

    // Initial load
    void load()

    // Set up polling for live updates (every 2 seconds)
    if (isLive) {
      pollInterval = window.setInterval(() => {
        void load()
      }, 2000)
    }

    return () => {
      cancelled = true
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [sessionId, isLive])

  const doPrint = () => {
    try {
      window.print()
    } catch {
      // no-op
    }
  }

  const roleLabel = (role: string) => (role === 'user' ? 'Student' : 'Patient')

  return (
    <div>
      <style>{`
        :root { --und-green: #009A44; --student-blue: #0b5fff; }
        body { color: #111; }
        .wrap { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; line-height: 1.35; font-size: 13px; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta { color: #555; margin-bottom: 16px; font-size: 12px; }
        .no-print { margin-bottom: 12px; }
        .btn { display: inline-block; padding: 6px 12px; background: #0d6efd; color: #fff; border-radius: 6px; text-decoration: none; font-size: 13px; border: 0; cursor: pointer; }
        .btn:hover { background: #0b5ed7; }
        .btn-toggle { margin-left: 8px; }
        .live-indicator { margin-left: 8px; color: #dc3545; }

        .transcript { display: block; }
        .line { display: grid; grid-template-columns: 76px 1fr; column-gap: 10px; align-items: start; margin: 0 0 6px; padding: 0; break-inside: avoid; }
        .who { font-weight: 700; text-align: right; white-space: nowrap; }
        .who--assistant { color: var(--und-green); }
        .who--user { color: var(--student-blue); }
        .txt { white-space: pre-wrap; }

        @media print {
          .no-print { display: none; }
          .wrap { margin: 10mm 12mm; font-size: 11.5px; line-height: 1.35; }
          .line { margin-bottom: 5px; }
        }
      `}</style>

      <div className="wrap">
        <div className="no-print">
          <button className="btn" onClick={doPrint}>Print Transcript</button>
          <button
            className="btn btn-toggle"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? (
              <>
                <FiberManualRecordIcon sx={{ fontSize: 14, mr: 0.5 }} /> Live
              </>
            ) : (
              <>
                <PauseIcon sx={{ fontSize: 14, mr: 0.5 }} /> Paused
              </>
            )}
          </button>
        </div>
        <h1>Encounter Transcript</h1>
        <div className="meta">
          Date: {sessionDate}
          {sessionId ? ` · Session ID: ${sessionId}` : ''}
          {isLive && <span className="live-indicator">● Live updating</span>}
        </div>

        {error && (
         <p className="err">{error}</p>
        )}

        <div className="transcript" role="list">
          {turns === null && <p><em>Loading…</em></p>}
          {turns && turns.length === 0 && !error && <p><em>No conversation recorded yet.</em></p>}
          {turns && turns.map((t) => (
            <div key={t.id} className="line" role="listitem">
              <div className={`who who--${t.role}`}>{roleLabel(t.role)}:</div>
              <div className="txt">{t.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
