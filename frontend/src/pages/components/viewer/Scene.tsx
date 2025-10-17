import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { Grid, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PassiveOrbitControls } from './PassiveOrbitControls'
import V2Model from '../../v2/Model'
import { frameCamera } from './utils/cameraFramer'
import { animationDebug, animationError } from '../../../shared/utils/animationLogging'



type SceneProps = {
  isAnimating: boolean
  animationPrompt?: string
  controlsRef?: MutableRefObject<OrbitControlsImpl | null>
  onPromptResult?: (result: string) => void
  humanFigureRef?: React.Ref<unknown>
}

/**
 * 3D Scene setup with lighting, environment, and the human figure
 */
// Define Error Boundary outside of the Scene component so React preserves subtree between renders
class LocalErrorBoundary extends React.Component<React.PropsWithChildren<object>, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren<object>) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: any, info: any) {
    animationError('3D Scene error caught by boundary', error)
    animationError('3D Scene error message', error?.message)
    animationError('3D Scene error stack', error?.stack)
    animationError('3D Scene component stack', info?.componentStack)
    alert('3D Scene Error: ' + error?.message)
  }
  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="r3f-debug-overlay">
            <div className="r3f-debug-title">3D Scene Error</div>
            <div>There was a problem rendering the scene.</div>
            <div className="error-hint">Check the browser console for details.</div>
          </div>
        </Html>
      )
    }
    return this.props.children
  }
}

export default function Scene({ isAnimating, animationPrompt, controlsRef, humanFigureRef }: SceneProps) {
  
  const internalControlsRef = useRef<OrbitControlsImpl>(null)
  const orbitRef = controlsRef ?? internalControlsRef
  const { camera } = useThree()
  const [metrics, setMetrics] = useState<{ boundingSphere: THREE.Sphere; boundingBox: THREE.Box3; desiredHeight: number; scaleFactor: number } | null>(null)
  const metricsReceivedRef = useRef(false)
  // Debug overlay removed
  
  // Memoize the metrics callback to prevent infinite re-renders
  const handleMetrics = useCallback((newMetrics: { boundingSphere: THREE.Sphere; boundingBox: THREE.Box3; desiredHeight: number; scaleFactor: number }) => {
    // Only set metrics once to avoid triggering camera framing loop
    if (!metricsReceivedRef.current) {
  animationDebug('Scene received metrics (first time)', newMetrics)
      metricsReceivedRef.current = true
      setMetrics(newMetrics)
    }
  }, [])

  const zoomBounds = useMemo(() => {
    if (!metrics) {
      return { min: 0.5, max: 25 }
    }
    const radius = metrics.boundingSphere.radius
    return {
      min: Math.max(0.25, radius * 0.7),
      max: Math.max(20, radius * 8),
    }
  }, [metrics])

  useEffect(() => {
    if (!metrics || !orbitRef.current) {
      return
    }

  frameCamera(camera as any, orbitRef.current, metrics as any)
    // Only run when metrics first becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics])

  // Lightweight HUD for diagnostics (polls every 200ms when enabled)
  // Debug HUD polling removed

  // (moved LocalErrorBoundary to file scope above)

  return (
    <>
      {/* Camera controls - orbit around the figure */}
      <PassiveOrbitControls
        ref={orbitRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={zoomBounds.min}
        maxDistance={zoomBounds.max}
        maxPolarAngle={(3 * Math.PI) / 5}
      />

      {/* Enhanced lighting for realistic skin rendering - custom configuration for full viewer */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.6} />
      <directionalLight position={[0, 5, -10]} intensity={0.4} />
      <pointLight position={[0, 3, 5]} intensity={0.5} />

      {/* Ground grid for spatial reference */}
      <Grid
        args={[12, 12]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#6f6f6f"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#009A44"
        fadeDistance={20}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      {/* Placeholder figure so the scene is never empty while model loads */}
      {!metrics && (
        <mesh position={[0, 1, 0]}>
          <capsuleGeometry args={[0.25, 1.3, 6, 12]} />
          <meshStandardMaterial color="#c9c9c9" metalness={0.1} roughness={0.9} />
        </mesh>
      )}

      {/* v2 Model viewer */}
      <LocalErrorBoundary>
        <Suspense
          fallback={
            <Html center>
              <div className="viewer-loading">Loading Mannequin...</div>
            </Html>
          }
        >
          <V2Model
            ref={humanFigureRef as any}
            isAnimating={isAnimating}
            requestedId={animationPrompt}
            onActiveChange={() => { /* noop */ }}
            onMetrics={handleMetrics}
          />
        </Suspense>
      </LocalErrorBoundary>
      {/* Debug overlay removed */}
    </>
  )
}
