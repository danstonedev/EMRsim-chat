import { useEffect, useRef } from 'react'
import { animationError } from '../utils/animationLogging'

/**
 * Custom hook for requestAnimationFrame loops with automatic cleanup.
 * Provides a stable callback reference and handles all RAF lifecycle management.
 * 
 * @param callback - Function to call on each animation frame
 * @param enabled - Whether the animation loop should run (default: true)
 * 
 * @example
 * ```tsx
 * // Poll current time while animating
 * useAnimationFrame(() => {
 *   const currentTime = api.getCurrentTime()
 *   setTime(currentTime)
 * }, isAnimating)
 * 
 * // Canvas rendering loop
 * useAnimationFrame((deltaTime) => {
 *   ctx.clearRect(0, 0, width, height)
 *   drawFrame(deltaTime)
 * }, true)
 * ```
 */
export function useAnimationFrame(
  callback: (deltaTime?: number) => void,
  enabled: boolean = true
): void {
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  const lastTimeRef = useRef<number>(0)

  // Keep callback fresh without restarting the loop
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) {
      // Cancel any existing animation frame when disabled
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const loop = (currentTime: number) => {
      const deltaTime = lastTimeRef.current ? currentTime - lastTimeRef.current : 0
      lastTimeRef.current = currentTime
      
      try {
        callbackRef.current(deltaTime)
      } catch (error) {
        animationError('useAnimationFrame callback error', error)
      }
      
      rafRef.current = requestAnimationFrame(loop)
    }

    // Start the loop
    rafRef.current = requestAnimationFrame(loop)

    // Cleanup on unmount or when enabled changes
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimeRef.current = 0
    }
  }, [enabled])
}
