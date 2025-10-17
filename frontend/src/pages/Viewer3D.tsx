import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import Scene from './components/viewer/Scene'
import PlaybackModal from './components/viewer/PlaybackModal'
import ViewerControls from './components/viewer/ViewerControls'
import { DEFAULT_ANIMATION_ID } from './components/viewer/animations/manifest'
import '../styles/viewer3d.css'
import RenderProfiler from '../shared/utils/renderProfiler'
// Debug disabled: no viewer debug flag import

/**
 * 3D Anatomy Viewer Page
 * Full-screen immersive 3D environment for viewing animated human figures
 */

type Viewer3DProps = {
  embedded?: boolean
  initialAnimationId?: string
  onClose?: () => void
}

export default function Viewer3D({ embedded = false, initialAnimationId, onClose }: Viewer3DProps) {
  const navigate = useNavigate()
  const [isAnimating, setIsAnimating] = useState(true)
  const [animationPrompt, setAnimationPrompt] = useState<string>(initialAnimationId || DEFAULT_ANIMATION_ID)
  // Debug disabled: remove debugEnabled state
  // Prompt result UI moved into modal; keep internal state minimal
  const cameraControlsRef = useRef<any>(null)
  const playbackRef = useRef<any>(null)

  // If the initialAnimationId prop changes, reflect it
  useEffect(() => {
    // If conversation did not specify an animation, default to Stand.glb
    if (initialAnimationId && initialAnimationId.trim().length > 0) {
      setAnimationPrompt(initialAnimationId)
    } else {
      setAnimationPrompt(DEFAULT_ANIMATION_ID)
    }
  }, [initialAnimationId])

  // Bottom controls removed; playback and camera reset are managed via PlaybackModal and PassiveOrbitControls

  const handleClose = useCallback(() => {
    if (onClose) return onClose()
    navigate('/voice')
  }, [onClose, navigate])

  const handleAnimationPrompt = useCallback((prompt: string) => {
    setAnimationPrompt(prompt)
  }, [])

  const handlePromptResult = useCallback(() => {}, [])

  const containerClass = useMemo(() => embedded ? 'viewer3d-container viewer3d-container--embed' : 'viewer3d-container', [embedded])

  return (
    <RenderProfiler id="Viewer3D">
      <div className={containerClass}>
      {/* UI Overlay */}
      <ViewerControls
        onClose={handleClose}
        // Legacy inline animation selector remains disabled; PlaybackModal handles selection
        onAnimationPrompt={undefined}
        promptResult={undefined}
        currentAnimation={undefined}
      />

      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [0, 2, 10],
          fov: 50,
        }}
        frameloop={isAnimating ? 'always' : 'demand'}
        shadows
        className="viewer3d-canvas"
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: 2, // ACESFilmicToneMapping for realistic rendering
        }}
        style={{ background: 'linear-gradient(to bottom, #9e9e9e 0%, #e0e0e0 100%)' }}
      >
        <Scene
          isAnimating={isAnimating}
          animationPrompt={animationPrompt}
          controlsRef={cameraControlsRef}
          onPromptResult={handlePromptResult}
          humanFigureRef={playbackRef}
        />
      </Canvas>

      <PlaybackModal
        isAnimating={isAnimating}
        setAnimating={setIsAnimating}
        currentAnimation={animationPrompt}
        onSelectAnimation={(id) => handleAnimationPrompt(id)}
        apiRef={playbackRef as any}
      />
      </div>
    </RenderProfiler>
  )
}
