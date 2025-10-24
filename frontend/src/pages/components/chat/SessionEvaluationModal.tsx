import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'

export type EvaluationData = {
  rating: number
  strengths: string[]
  improvements: string[]
  notes: string
  createdAt: number
  sessionId: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  sessionId: string | null
  onRestart?: () => void | Promise<void>
}

const STRENGTHS = ['Empathy', 'Active listening', 'Organization', 'Clinical reasoning']
const IMPROVEMENTS = ['History depth', 'Follow-up questions', 'Time management', 'Counseling/education']

export default function SessionEvaluationModal({ open, onClose, sessionId, onRestart }: Props) {
  const container = useMemo(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.setAttribute('data-portal-root', 'session-eval-modal')
    return el
  }, [])

  const [rating, setRating] = useState(0)
  const [strengths, setStrengths] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !container || typeof document === 'undefined') return
    document.body.appendChild(container)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      try { document.body.removeChild(container) } catch {}
    }
  }, [open, container])

  if (!open || !container) return null

  const persistEvaluation = (data: EvaluationData) => {
    try {
      const key = 'emrsim.sessionEvaluations'
      const existing = JSON.parse(localStorage.getItem(key) || '[]') as EvaluationData[]
      localStorage.setItem(key, JSON.stringify([...existing, data]))
    } catch (e) {
      console.warn('[SessionEvaluation] Failed to persist locally:', e)
    }
  }

  const buildPayload = (): EvaluationData => ({
    rating,
    strengths,
    improvements,
    notes: notes.trim(),
    createdAt: Date.now(),
    sessionId,
  })

  const toggleFrom = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  return createPortal(
    <>
      <div className="encounter-end-backdrop" onClick={onClose} />
      <div className="encounter-end-modal" role="dialog" aria-modal="true" aria-labelledby="session-eval-title">
        <div className="encounter-end-modal__header">
          <h2 id="session-eval-title" className="encounter-end-modal__title">Evaluate Session</h2>
          <p className="encounter-end-modal__subtitle">Optional quick evaluation before restarting or closing.</p>
        </div>

        <div className="session-eval__section">
          <label className="session-eval__label">Overall rating</label>
          <div className="session-eval__stars" role="radiogroup" aria-label="Overall rating">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                type="button"
                className={`star ${rating >= n ? 'star--filled' : ''}`}
                onClick={() => setRating(n)}
                title={`${n} star${n>1?'s':''}`}
              >
                {rating >= n ? <StarIcon /> : <StarBorderIcon />}
              </button>
            ))}
          </div>
        </div>

        <div className="session-eval__section">
          <label className="session-eval__label">Strengths</label>
          <div className="session-eval__tags">
            {STRENGTHS.map(s => (
              <button
                key={s}
                type="button"
                className={`tag ${strengths.includes(s) ? 'tag--selected' : ''}`}
                onClick={() => toggleFrom(strengths, s, setStrengths)}
              >{s}</button>
            ))}
          </div>
        </div>

        <div className="session-eval__section">
          <label className="session-eval__label">Areas to improve</label>
          <div className="session-eval__tags">
            {IMPROVEMENTS.map(s => (
              <button
                key={s}
                type="button"
                className={`tag ${improvements.includes(s) ? 'tag--selected' : ''}`}
                onClick={() => toggleFrom(improvements, s, setImprovements)}
              >{s}</button>
            ))}
          </div>
        </div>

        <div className="session-eval__section">
          <label htmlFor="session-eval-notes" className="session-eval__label">Notes</label>
          <textarea id="session-eval-notes" className="session-eval__notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What went well? What would you change next time?" />
        </div>

        <div className="encounter-end-modal__actions">
          <button
            type="button"
            className="encounter-end-modal__button encounter-end-modal__button--secondary"
            onClick={() => {
              persistEvaluation(buildPayload())
              onClose()
            }}
          >Save & Close</button>

          <button
            type="button"
            className="encounter-end-modal__button encounter-end-modal__button--primary"
            onClick={async () => {
              persistEvaluation(buildPayload())
              onClose()
              if (onRestart) await onRestart()
            }}
          >Save & Restart</button>
        </div>
      </div>
    </>,
    container
  )
}
