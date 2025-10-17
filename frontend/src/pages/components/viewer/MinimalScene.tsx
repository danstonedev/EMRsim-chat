import { useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PassiveOrbitControls } from './PassiveOrbitControls'

type MinimalSceneProps = {
  controlsRef?: React.MutableRefObject<OrbitControlsImpl | null>
}

/**
 * Minimal test scene - just a cube to verify 3D rendering works
 */
export default function MinimalScene({ controlsRef }: MinimalSceneProps) {
  const internalControlsRef = useRef<OrbitControlsImpl>(null)
  const orbitRef = controlsRef ?? internalControlsRef

  return (
    <>
      {/* Camera controls */}
      <PassiveOrbitControls
        ref={orbitRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={20}
      />

      {/* Basic lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      {/* Simple test cube */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    </>
  )
}
