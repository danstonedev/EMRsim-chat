import { useEffect, useMemo, useState } from 'react'
import { useAnimationFrame } from '../../../shared/hooks/useAnimationFrame'
import { ANIMATIONS } from './animations/manifest'

export type PlaybackAPI = {
  getDuration: (id?: string) => number | null
  getCurrentTime: () => number
  setSpeed: (s: number) => void
  getSpeed: () => number
  seek: (t: number) => void
}

type Props = {
  isAnimating: boolean
  setAnimating: (v: boolean) => void
  currentAnimation?: string
  onSelectAnimation: (id: string) => void
  apiRef?: React.RefObject<PlaybackAPI | null>
}

export default function PlaybackModal({ isAnimating, setAnimating, currentAnimation, onSelectAnimation, apiRef }: Props) {
  const [localTime, setLocalTime] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [speed, setSpeedState] = useState(() => apiRef?.current?.getSpeed?.() ?? 1)
  const duration = useMemo(() => apiRef?.current?.getDuration(currentAnimation) ?? 0, [apiRef, currentAnimation]) || 0

  // Only present animations that can actually bind to this rig
  const selectable = useMemo(() => {
    if (!apiRef?.current?.getDuration) return ANIMATIONS
    return ANIMATIONS.filter(a => (apiRef.current!.getDuration(a.id) ?? 0) > 0)
  }, [apiRef])

  // Keep speed state in sync when API changes
  useEffect(() => { setSpeedState(apiRef?.current?.getSpeed?.() ?? 1) }, [apiRef])

  // Poll current time while animating using reusable RAF hook
  // (skip polling when dragging - rely on slider state instead)
  useAnimationFrame(() => {
    if (!dragging && apiRef?.current) {
      try {
        const t = apiRef?.current?.getCurrentTime?.() ?? 0
        if (!Number.isNaN(t)) setLocalTime(t)
      } catch { /* noop */ }
    }
  }, true) // Always enabled, but conditional logic inside callback

  const setSpeed = (s: number) => {
    const clamped = Math.max(0.25, Math.min(2, Number.isFinite(s) ? s : 1))
    setSpeedState(clamped)
    try { apiRef?.current?.setSpeed?.(clamped) } catch { /* noop */ }
  }

  return (
    <div className="playback-modal">
      <div className="playback-controls">
        <button className="viewer-btn viewer-btn--primary" onClick={() => setAnimating(!isAnimating)}>
          {isAnimating ? '⏸' : '▶'}
        </button>
        <button className="viewer-btn" onClick={() => setSpeed(speed - 0.25)}>−</button>
        <div className="playback-speed-value">{speed.toFixed(2)}x</div>
        <button className="viewer-btn" onClick={() => setSpeed(speed + 0.25)}>+</button>

        <select
          className="viewer-select playback-select"
          aria-label="Select animation"
          value={currentAnimation || selectable[0]?.id}
          onChange={e => onSelectAnimation(e.target.value)}
        >
          {selectable.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
        </select>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.001)}
        step={0.001}
        value={Math.min(localTime, Math.max(duration, 0.001))}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onChange={(e) => {
          const t = Number(e.target.value)
          setLocalTime(t)
          try { apiRef?.current?.seek?.(t) } catch { /* noop */ }
        }}
        className="playback-timeline"
        aria-label="timeline"
      />
    </div>
  )
}
