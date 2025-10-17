import { Html } from '@react-three/drei'
import './DebugOverlay.css'

type AnimationDebugOverlayProps = {
  currentAnimation: string | null
  position?: [number, number, number]
  additionalInfo?: Record<string, any>
}

/**
 * Reusable debug overlay for 3D animation viewers.
 * Shows current animation name and optional additional debug info.
 */
export function AnimationDebugOverlay({
  currentAnimation,
  position = [0, 2, 0],
  additionalInfo,
}: AnimationDebugOverlayProps) {
  return (
    <Html position={position} center>
      <div className="debug-overlay">
        <div>
          <strong>Anim:</strong> {currentAnimation ?? '(none)'}
        </div>
        {additionalInfo &&
          Object.entries(additionalInfo).map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {String(value)}
            </div>
          ))}
      </div>
    </Html>
  )
}
