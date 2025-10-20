import { useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import Scene from './Scene'
import { ANIMATIONS } from './manifest'
import '../../styles/viewer3d.css'

export default function ViewerV2() {
  const [isAnimating, setAnimating] = useState(true)
  const [requested, setRequested] = useState<string | undefined>(undefined)
  const [active, setActive] = useState<string | undefined>(undefined)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const onActiveChange = useCallback((id: string) => setActive(id), [])
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
  const dprRange: [number, number] = [1, 1.75]

  return (
    <div className="viewer3d-container">
      <div className="viewer-controls">
        <button className="viewer-btn viewer-btn--primary" onClick={() => setAnimating(a => !a)}>
          {isAnimating ? '⏸ Pause' : '▶ Play'}
        </button>
        <select
          aria-label="Select animation"
          className="viewer-select"
          value={requested ?? active ?? ''}
          onChange={e => setRequested(e.target.value)}
          onBlur={() => { if (!requested) setRequested(active) }}
        >
          <option value="" disabled>Select animation</option>
          {ANIMATIONS.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
        </select>
      </div>
      <Canvas camera={{ position: [0, 2, 8], fov: 50 }} className="viewer3d-canvas" dpr={dprRange} shadows={enableShadows} gl={{ antialias, powerPreference: 'high-performance' }}>
        <Scene isAnimating={isAnimating} requestedId={requested} controlsRef={controlsRef} onActiveChange={onActiveChange} />
      </Canvas>
    </div>
  )
}
