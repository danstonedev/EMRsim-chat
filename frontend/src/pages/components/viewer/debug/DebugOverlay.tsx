import { Html } from '@react-three/drei'
import type { ModelMetrics } from '../utils/modelMetrics'

type DebugOverlayProps = {
  metrics?: ModelMetrics | null
  extra?: Record<string, any>
}

export function DebugOverlay({ metrics, extra }: DebugOverlayProps) {
  return (
    <Html position={[0, 2.5, 0]} transform occlude={false} zIndexRange={[100, 0]}>
      <div className="r3f-debug-overlay">
        <div className="r3f-debug-title">Debug</div>
        {metrics && (
          <div className="r3f-debug-section">
            <div>scale: {metrics.scaleFactor.toFixed(3)}</div>
            <div>radius: {metrics.boundingSphere.radius.toFixed(3)}</div>
          </div>
        )}
        {extra && (
          <div className="r3f-debug-section">
            {Object.entries(extra).map(([k, v]) => (
              <div key={k}>
                {k}: {String(v)}
              </div>
            ))}
          </div>
        )}
      </div>
    </Html>
  )
}
