import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { forwardRef, useImperativeHandle } from 'react'

/**
 * OrbitControls wrapper that adds passive event listeners to reduce console warnings
 */
export const PassiveOrbitControls = forwardRef<OrbitControlsImpl, React.ComponentProps<typeof OrbitControls>>(
  (props, ref) => {
    const controlsRef = useRef<OrbitControlsImpl>(null)

    useImperativeHandle(ref, () => controlsRef.current!, [])

    useEffect(() => {
      const controls = controlsRef.current
      const domElement = controls?.domElement as HTMLElement | undefined
      if (!domElement) return
      // Hint browsers not to scroll/zoom the page on touch interactions
      domElement.style.touchAction = 'none'
      ;(domElement.style as any).msTouchAction = 'none'
    }, [])

    return <OrbitControls ref={controlsRef} {...props} />
  }
)

PassiveOrbitControls.displayName = 'PassiveOrbitControls'
