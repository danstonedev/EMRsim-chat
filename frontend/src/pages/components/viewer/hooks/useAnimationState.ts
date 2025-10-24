import { useRef, useEffect } from 'react'

export type AnimationStateRefs = {
  currentAnimationRef: React.MutableRefObject<string | null>
  lastPromptRef: React.MutableRefObject<string>
  animatingRef: React.MutableRefObject<boolean>
  initializedRef: React.MutableRefObject<boolean>
  reportedOnceRef: React.MutableRefObject<boolean>
  lastActionsRef: React.MutableRefObject<any>
}

/**
 * Manages common animation state refs used across viewer components.
 * Consolidates ref declarations and synchronization logic.
 */
export function useAnimationState(isAnimating: boolean, mixer: any): AnimationStateRefs {
  const currentAnimationRef = useRef<string | null>(null)
  const lastPromptRef = useRef<string>('')
  const animatingRef = useRef<boolean>(isAnimating)
  const initializedRef = useRef<boolean>(false)
  const reportedOnceRef = useRef<boolean>(false)
  const lastActionsRef = useRef<any>(null)

  // Keep animating state in sync
  useEffect(() => {
    animatingRef.current = isAnimating
    try {
      (mixer as any).timeScale = isAnimating ? 1 : 0
    } catch {
      /* noop */
    }
  }, [isAnimating, mixer])

  return {
    currentAnimationRef,
    lastPromptRef,
    animatingRef,
    initializedRef,
    reportedOnceRef,
    lastActionsRef,
  }
}
