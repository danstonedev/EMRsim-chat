import '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'

declare global {
  namespace JSX {
    // Merge R3F's ThreeElements into React's intrinsic elements.
    // Avoid declaring an empty interface body to sidestep TS redundant interface warnings.
    type IntrinsicElements = ThreeElements
  }
}
