import { useMemo } from 'react'
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
  // Only present animations that can actually bind to this rig
  const selectable = useMemo(() => {
    if (!apiRef?.current?.getDuration) return ANIMATIONS
    return ANIMATIONS.filter(a => (apiRef.current!.getDuration(a.id) ?? 0) > 0)
  }, [apiRef])

  return (
    <div className="playback-modal">
      <div className="playback-controls">
        <button className="viewer-btn viewer-btn--primary" onClick={() => setAnimating(!isAnimating)}>
          {isAnimating ? '⏸' : '▶'}
        </button>

        <select
          className="viewer-select playback-select"
          aria-label="Select animation"
          value={currentAnimation || selectable[0]?.id}
          onChange={e => onSelectAnimation(e.target.value)}
        >
          {selectable.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
        </select>
      </div>
    </div>
  )
}
