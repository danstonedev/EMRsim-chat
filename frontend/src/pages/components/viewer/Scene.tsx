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



type SceneProps = {
  isAnimating: boolean
  animationPrompt?: string
  controlsRef?: MutableRefObject<OrbitControlsImpl | null>
  onPromptResult?: (result: string) => void
  humanFigureRef?: React.Ref<unknown>
  onAnimationChange?: (id: string) => void
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
  componentDidCatch(error: any) {
    // Silent error handling for production
    try {
      console.error('3D Scene Error:', error?.message || error)
    } catch {
      /* noop */
    }
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

export default function Scene({ isAnimating, animationPrompt, controlsRef, humanFigureRef, onAnimationChange }: SceneProps) {
  
  const internalControlsRef = useRef<OrbitControlsImpl>(null)
  const orbitRef = controlsRef ?? internalControlsRef
  const { camera } = useThree()
  const [metrics, setMetrics] = useState<{ boundingSphere: THREE.Sphere; boundingBox: THREE.Box3; desiredHeight: number; scaleFactor: number } | null>(null)
  const metricsReceivedRef = useRef(false)
  const [lightsReady, setLightsReady] = useState(false)
  // Env-driven perf mode: trims lights and grid complexity
  const parseBool = useCallback((v: unknown, fallback: boolean) => {
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v !== 0
    if (typeof v !== 'string') return fallback
    const s = v.trim().toLowerCase()
    return ['1','true','yes','on','enable','enabled'].includes(s) ? true : (['0','false','no','off','disable','disabled'].includes(s) ? false : fallback)
  }, [])
  const env = (import.meta as any)?.env ?? {}
  const perfMode = parseBool(env.VITE_VIEWER_PERF_MODE, false)
  // Debug overlay removed
  
  // Memoize the metrics callback to prevent infinite re-renders
  const handleMetrics = useCallback((newMetrics: { boundingSphere: THREE.Sphere; boundingBox: THREE.Box3; desiredHeight: number; scaleFactor: number }) => {
    // Only set metrics once to avoid triggering camera framing loop
    if (!metricsReceivedRef.current) {
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

  // Defer secondary lights to reduce TTFP; keep ambient + key light immediate
  useEffect(() => {
    if (perfMode) return
  const raf = requestAnimationFrame(() => setLightsReady(true))
  return () => cancelAnimationFrame(raf)
  }, [perfMode])

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
      <ambientLight intensity={perfMode ? 0.6 : 0.8} />
      {/* Key light always present; shadowing still controlled by Canvas prop */}
      <directionalLight
        position={[5, 10, 7]}
        intensity={perfMode ? 0.9 : 1.2}
        castShadow={!perfMode}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Secondary lights are skipped in perf mode; otherwise deferred one frame */}
      {!perfMode && lightsReady && (
        <>
          <directionalLight position={[-5, 5, -5]} intensity={0.6} />
          <directionalLight position={[0, 5, -10]} intensity={0.4} />
          <pointLight position={[0, 3, 5]} intensity={0.5} />
        </>
      )}

      {/* Ground grid for spatial reference */}
      <Grid
        args={perfMode ? [8, 8] : [12, 12]}
        cellSize={perfMode ? 0.75 : 0.5}
        cellThickness={perfMode ? 0.3 : 0.4}
        cellColor="#6f6f6f"
        sectionSize={perfMode ? 2.5 : 2}
        sectionThickness={perfMode ? 0.6 : 0.8}
        sectionColor="#009A44"
        fadeDistance={perfMode ? 14 : 20}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      {/* No placeholder - keep scene clean during load */}

      {/* v2 Model viewer */}
      <LocalErrorBoundary>
        <Suspense fallback={null}>
          <V2Model
            ref={humanFigureRef as any}
            isAnimating={isAnimating}
            requestedId={animationPrompt}
            onActiveChange={onAnimationChange}
            onMetrics={handleMetrics}
          />
        </Suspense>
      </LocalErrorBoundary>
      {/* Debug overlay removed */}
    </>
  )
}
