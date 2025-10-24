import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import Scene from './components/viewer/Scene'
import PlaybackModal from './components/viewer/PlaybackModal'
import ViewerControls from './components/viewer/ViewerControls'
import { DEFAULT_ANIMATION_ID } from './components/viewer/animations/manifest'
import '../styles/viewer3d.css'
import RenderProfiler from '../shared/utils/renderProfiler'
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import PanToolIcon from '@mui/icons-material/PanTool'
import SlideshowIcon from '@mui/icons-material/Slideshow'
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
  const [showInstructions, setShowInstructions] = useState(true)
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
    navigate(-1) // Go back to previous page
  }, [onClose, navigate])

  const handleAnimationPrompt = useCallback((prompt: string) => {
    setAnimationPrompt(prompt)
  }, [])

  const handleAnimationChange = useCallback((id: string) => {
    // Sync the actual playing animation back to state
    setAnimationPrompt(id)
  }, [])

  const handlePromptResult = useCallback(() => {}, [])

  const containerClass = useMemo(() => embedded ? 'viewer3d-container viewer3d-container--embed' : 'viewer3d-container', [embedded])

  // Lightweight env flag parsing for perf toggles
  const parseBool = useCallback((v: unknown, fallback: boolean) => {
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v !== 0
    if (typeof v !== 'string') return fallback
    const s = v.trim().toLowerCase()
    return ['1','true','yes','on','enable','enabled'].includes(s) ? true : (['0','false','no','off','disable','disabled'].includes(s) ? false : fallback)
  }, [])
  const env = (import.meta as any)?.env ?? {}
  const enableShadows = parseBool(env.VITE_VIEWER_SHADOWS, false)
  const antialias = parseBool(env.VITE_VIEWER_AA, false)
  // Clamp DPR to reduce GPU load on high-DPI displays
  const dprRange: [number, number] = [1, 1.75]

  return (
    <RenderProfiler id="Viewer3D">
      <div className={containerClass}>
      {/* Navigation Instructions Popup */}
      {showInstructions && (
        <div className="viewer-instructions-overlay">
          <div className="viewer-instructions-card">
            <h2 className="viewer-instructions-title">3D Navigation Controls</h2>
            <div className="viewer-instructions-content">
              <div className="viewer-instruction-item">
                <strong><ThreeSixtyIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Rotate:</strong> Click and drag to orbit around the model
              </div>
              <div className="viewer-instruction-item">
                <strong><ZoomInIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Zoom:</strong> Scroll wheel or pinch to zoom in/out
              </div>
              <div className="viewer-instruction-item">
                <strong><PanToolIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Pan:</strong> Right-click and drag to move the view
              </div>
              <div className="viewer-instruction-item">
                <strong><SlideshowIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Controls:</strong> Use the playback panel at the bottom to select animations, adjust speed, and step through frames
              </div>
            </div>
            <button 
              className="viewer-instructions-btn"
              onClick={() => setShowInstructions(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

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
        dpr={dprRange}
        shadows={enableShadows}
        className="viewer3d-canvas"
        gl={{
          alpha: true,
          antialias,
          powerPreference: 'high-performance',
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
          onAnimationChange={handleAnimationChange}
        />
      </Canvas>

      <PlaybackModal
        isAnimating={isAnimating}
        setAnimating={setIsAnimating}
        currentAnimation={animationPrompt}
        onSelectAnimation={(id) => handleAnimationPrompt(id)}
        apiRef={playbackRef as any}
        onShowHelp={() => setShowInstructions(true)}
      />
      </div>
    </RenderProfiler>
  )
}
