import { useMemo } from 'react'
import { ANIMATIONS, DEFAULT_ANIMATION_ID } from './animations/manifest'

export type ChatAnimationInlinePreviewProps = {
  animationId?: string
  onExpand?: () => void
}

/**
 * Chat inline animation preview - Compact view embedded in chat messages
 * Optimized with error boundaries and frameloop control for smooth performance
 */
export default function ChatAnimationInlinePreview({ animationId, onExpand }: ChatAnimationInlinePreviewProps) {
  const resolvedId = useMemo(() => {
    const ids = new Set(ANIMATIONS.map(a => a.id))
    if (animationId && ids.has(animationId)) return animationId
    return DEFAULT_ANIMATION_ID
  }, [animationId])

  // Inline preview removed per simplification: just render a button to open the embedded 3D viewer
  return (
    <div className="chat-animation-player chat-animation-player--inline">
      <button
        className="viewer-btn viewer-btn--primary"
        onClick={(e) => { e.stopPropagation(); onExpand?.() }}
        aria-label={`Open 3D Viewer for ${resolvedId}`}
        title="Open 3D Viewer"
      >
        ⤢ Open 3D Viewer
      </button>
      <div className="viewer-hint">Animation: {resolvedId}</div>
    </div>
  )
}
