import { useMemo, useState, useEffect } from 'react'
import { ANIMATIONS, getAnimationDisplayName } from './animations/manifest'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

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
  onShowHelp?: () => void
}

export default function PlaybackModal({ isAnimating, setAnimating, currentAnimation, onSelectAnimation, apiRef, onShowHelp }: Props) {
  const [speed, setSpeed] = useState(1)

  // Only present animations that can actually bind to this rig
  const selectable = useMemo(() => {
    if (!apiRef?.current?.getDuration) return ANIMATIONS
    return ANIMATIONS.filter(a => (apiRef.current!.getDuration(a.id) ?? 0) > 0)
  }, [apiRef])

  // Sync speed from API
  useEffect(() => {
    if (!apiRef?.current?.getSpeed) return
    const currentSpeed = apiRef.current.getSpeed()
    setSpeed(currentSpeed)
  }, [currentAnimation, apiRef])

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    apiRef?.current?.setSpeed?.(newSpeed)
  }

  const handleFrameStep = (direction: 'forward' | 'backward') => {
    if (!apiRef?.current) return
    const currentTime = apiRef.current.getCurrentTime()
    const duration = apiRef.current.getDuration(currentAnimation) ?? 0
    
    // Step by 1/30th of a second (roughly one frame at 30fps)
    const frameTime = 1 / 30
    let newTime: number
    
    if (direction === 'forward') {
      newTime = currentTime + frameTime
      // If we go past the end, loop back to the beginning
      if (newTime >= duration) {
        newTime = 0
      }
    } else {
      newTime = currentTime - frameTime
      // If we go past the beginning, loop to the end
      if (newTime < 0) {
        newTime = Math.max(0, duration - frameTime)
      }
    }
    
    apiRef.current.seek(newTime)
  }

  return (
    <div className="playback-modal">
      {/* Primary Controls Row */}
      <div className="playback-controls-primary">
        {/* Playback group */}
        <div className="playback-control-group">
          <button className="viewer-btn viewer-btn--primary" onClick={() => setAnimating(!isAnimating)}>
            {isAnimating ? '⏸' : '▶'}
          </button>

          {/* Frame step buttons - only show when paused */}
          {!isAnimating && (
            <>
              <button 
                className="viewer-btn viewer-btn--frame-step"
                onClick={() => handleFrameStep('backward')}
                title="Step backward one frame"
                aria-label="Step backward one frame"
              >
                ⏮
              </button>
              <button 
                className="viewer-btn viewer-btn--frame-step"
                onClick={() => handleFrameStep('forward')}
                title="Step forward one frame"
                aria-label="Step forward one frame"
              >
                ⏭
              </button>
            </>
          )}
        </div>

        {/* Animation selector */}
        <select
          className="viewer-select playback-select"
          aria-label="Select animation"
          value={currentAnimation || selectable[0]?.id}
          onChange={e => onSelectAnimation(e.target.value)}
        >
          {selectable.map(a => <option key={a.id} value={a.id}>{getAnimationDisplayName(a.id)}</option>)}
        </select>

        {/* Speed controls group */}
        <div className="playback-control-group playback-speed-controls">
          <button 
            className="viewer-btn viewer-btn--speed"
            onClick={() => handleSpeedChange(Math.max(0.25, speed - 0.25))}
            aria-label="Decrease speed"
            disabled={speed <= 0.25}
          >
            −
          </button>
          <span className="playback-speed-value">{speed.toFixed(2)}x</span>
          <button 
            className="viewer-btn viewer-btn--speed"
            onClick={() => handleSpeedChange(Math.min(2, speed + 0.25))}
            aria-label="Increase speed"
            disabled={speed >= 2}
          >
            +
          </button>
        </div>

        {/* Help button */}
        {onShowHelp && (
          <button 
            className="viewer-btn viewer-btn--help"
            onClick={onShowHelp}
            title="Show navigation help"
            aria-label="Show navigation help"
          >
            <HelpOutlineIcon sx={{ fontSize: 20 }} />
          </button>
        )}
      </div>
    </div>
  )
}
