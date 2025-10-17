import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Scene from '../viewer/Scene'
import { ANIMATIONS, DEFAULT_ANIMATION_ID } from './animations/manifest'
import ErrorBoundary from './ErrorBoundary'
import PlaybackModal, { type PlaybackAPI } from './PlaybackModal'

export type ChatAnimationPlayerProps = {
  animationId?: string
}

/**
 * Chat animation player - Modal view for animation playback
 * Optimized with error boundaries and proper suspense fallbacks
 */
export default function ChatAnimationPlayer({ animationId }: ChatAnimationPlayerProps) {
  const [isAnimating, setAnimating] = useState(true)
  const [selectedId, setSelectedId] = useState<string | undefined>(animationId)
  const playbackRef = useRef<PlaybackAPI | null>(null)

  const resolvedId = useMemo(() => {
    const ids = new Set(ANIMATIONS.map(a => a.id))
    if (selectedId && ids.has(selectedId)) return selectedId
    return DEFAULT_ANIMATION_ID
  }, [selectedId])

  return (
    <div className="chat-animation-player">
  <div className="player-canvas-wrap">
        <ErrorBoundary>
          <Canvas
            camera={{ position: [2.4, 1.4, 2.4], fov: 48 }}
            shadows
            gl={{ powerPreference: 'high-performance' }}
            frameloop={isAnimating ? 'always' : 'demand'}
            dpr={[1, 2]}
          >
            <Suspense
              fallback={
                <Html center>
                  <div className="viewer-loading">Loading...</div>
                </Html>
              }
            >
              <Scene
                isAnimating={isAnimating}
                animationPrompt={resolvedId}
                humanFigureRef={(instance: any) => {
                  playbackRef.current = instance as PlaybackAPI | null
                }}
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      </div>
      <PlaybackModal
        isAnimating={isAnimating}
        setAnimating={setAnimating}
        currentAnimation={resolvedId}
        onSelectAnimation={setSelectedId}
        apiRef={playbackRef}
      />
    </div>
  )
}
