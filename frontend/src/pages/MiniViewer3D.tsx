import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import V2Model from './v2/Model'
import { ANIMATIONS } from './components/viewer/animations/manifest'
import '../styles/viewer3d.css'

/**
 * Mini 3D Viewer - Lightweight preview component
 * Uses manifest animations for consistency with main viewer
 * Optimized with demand-based frameloop for better performance
 */
export default function MiniViewer3D() {
  // Get first 3 animations from manifest for quick preview
  const previewAnimations = useMemo(() => ANIMATIONS.slice(0, 3), [])
  const [selected, setSelected] = useState<string>(previewAnimations[0]?.id || 'Stand.glb')
  const [isAnimating, setIsAnimating] = useState(true)
  
  return (
    <div className="viewer3d-container">
      <div className="mini-viewer-controls">
        <button 
          className="viewer-btn viewer-btn--primary"
          onClick={() => setIsAnimating(v => !v)}
          aria-label={isAnimating ? 'Pause' : 'Play'}
        >
          {isAnimating ? '⏸' : '▶'}
        </button>
        <label className="mini-viewer-label">
          Animation:
          <select 
            value={selected} 
            onChange={(e) => setSelected(e.target.value)} 
            className="viewer-select"
          >
            {previewAnimations.map(anim => (
              <option key={anim.id} value={anim.id}>
                {anim.id.replace('.glb', '')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Canvas
        camera={{ position: [0, 2, 8], fov: 50 }}
        className="viewer3d-canvas"
        shadows
        gl={{ 
          antialias: true,
          powerPreference: 'high-performance',
        }}
        frameloop={isAnimating ? 'always' : 'demand'}
        dpr={[1, 2]}
      >
        {/* v2 Model directly */}
        <V2Model isAnimating={isAnimating} requestedId={selected} onActiveChange={() => {}} />
      </Canvas>
    </div>
  )
}
