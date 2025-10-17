import { Grid } from '@react-three/drei'
import Model from './Model'
import { MutableRefObject } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PassiveOrbitControls } from '../components/viewer/PassiveOrbitControls'

type Props = {
  isAnimating: boolean
  requestedId?: string
  controlsRef?: MutableRefObject<OrbitControlsImpl | null>
  onActiveChange?: (id: string) => void
}

export default function Scene({ isAnimating, requestedId, controlsRef, onActiveChange }: Props) {
  return (
    <>
      <PassiveOrbitControls ref={controlsRef} enablePan enableZoom enableRotate />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 7]} intensity={1.2} castShadow />
      <Grid args={[12, 12]} cellSize={0.5} />
  <Model isAnimating={isAnimating} requestedId={requestedId} onActiveChange={onActiveChange} />
    </>
  )
}
