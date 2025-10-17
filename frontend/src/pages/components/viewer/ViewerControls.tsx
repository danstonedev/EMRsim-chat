import { ANIMATIONS, DEFAULT_ANIMATION_ID } from './animations/manifest'

type ViewerControlsProps = {
  onClose: () => void
  onAnimationPrompt?: (prompt: string) => void
  promptResult?: string
  currentAnimation?: string
}

/**
 * UI overlay controls for the 3D viewer
 */
export default function ViewerControls({
  onClose,
  onAnimationPrompt,
  promptResult,
  currentAnimation,
}: ViewerControlsProps) {
  return (
    <>
      {/* Top bar with title and close button */}
      <div className="viewer-header">
        <h1 className="viewer-title">3D Anatomy Viewer</h1>
        <div className="viewer-header-actions">
          <button className="viewer-close-btn" onClick={onClose} aria-label="Close viewer">
            ✕
          </button>
        </div>
      </div>

      {/* Bottom controls removed in favor of the PlaybackModal being the single control surface */}

      {/* Direct Animation Selection via dropdown */}
      {onAnimationPrompt && (
        <div className="viewer-prompt-panel">
          <div className="viewer-prompt-label">Select Animation:</div>
          <div>
            <select
              className="viewer-select"
              aria-label="Select animation file"
              value={currentAnimation || DEFAULT_ANIMATION_ID}
              onChange={(e) => {
                onAnimationPrompt(e.target.value)
              }}
            >
              {ANIMATIONS.map(a => (
                <option key={a.id} value={a.id}>{a.id}</option>
              ))}
            </select>
          </div>

          {promptResult && <div className="viewer-prompt-result">{promptResult}</div>}
        </div>
      )}
    </>
  )
}
