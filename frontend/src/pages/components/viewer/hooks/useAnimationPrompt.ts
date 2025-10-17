import { useEffect } from 'react'
import { playAction, setPaused } from '../../../v2/mixer'
import { animationDebug, animationInfo, animationWarn } from '../../../../shared/utils/animationLogging'

type UseAnimationPromptProps = {
  animationPrompt?: string
  actions: Record<string, any> | null
  names: string[]
  mixer: any
  isAnimating: boolean
  currentAnimationRef: React.MutableRefObject<string | null>
  lastPromptRef: React.MutableRefObject<string>
  onPromptResult?: (result: string) => void
  debug?: boolean
}

/**
 * Handles animation prompt matching and switching logic.
 * Extracts the prompt processing logic into a reusable hook.
 */
export function useAnimationPrompt({
  animationPrompt,
  actions,
  names,
  mixer,
  isAnimating,
  currentAnimationRef,
  lastPromptRef,
  onPromptResult,
  debug = false,
}: UseAnimationPromptProps) {
  useEffect(() => {
    if (!animationPrompt || !actions || names.length === 0) return

    // Debounce: if the prompt hasn't changed, don't re-process
    if (animationPrompt === lastPromptRef.current) return
    lastPromptRef.current = animationPrompt

  if (debug) animationDebug('Animation prompt received', animationPrompt)

    // Prompt is an exact filename like "Jump.glb"; try exact equality and fallback to first
    let matchedAnimation: string | null =
      names.find((n) => n === animationPrompt) || null
    if (!matchedAnimation)
      matchedAnimation = names.find((n) => n.endsWith(animationPrompt)) || null
    if (!matchedAnimation && names.length > 0) matchedAnimation = names[0]

    if (matchedAnimation && actions[matchedAnimation]) {
      if (debug) animationDebug('Switching to animation', matchedAnimation)
      animationInfo(`Playing animation: ${matchedAnimation}`)
      
      playAction(actions as any, mixer as any, matchedAnimation)
      currentAnimationRef.current = matchedAnimation

      // If currently paused, immediately pause the newly switched action and gate mixer
      if (!isAnimating) {
        try {
          const a = actions[matchedAnimation]
          if (a) setPaused(a as any, true)
          try {
            (mixer as any).timeScale = 0
          } catch {
            /* noop */
          }
        } catch {
          /* noop */
        }
      }

      if (onPromptResult) {
        onPromptResult(`Playing animation: ${matchedAnimation}`)
      }
    } else {
      if (debug)
        animationWarn('No matching animation found for prompt', animationPrompt)
      if (onPromptResult) {
        onPromptResult(`No animation found matching: ${animationPrompt}`)
      }
    }
  }, [
    animationPrompt,
    actions,
    names,
    mixer,
    isAnimating,
    currentAnimationRef,
    lastPromptRef,
    onPromptResult,
    debug,
  ])
}
