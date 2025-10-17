import { useRef, useEffect, useCallback } from 'react'
import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playAction, setPaused } from '../../../v2/mixer'

export type AnimationControllerAPI = {
  getDuration: (id?: string) => number | null
  getCurrentTime: () => number
  setSpeed: (s: number) => void
  getSpeed: () => number
  seek: (t: number) => void
  play: (id: string) => void
  pause: () => void
  resume: () => void
}

type UseAnimationControllerParams = {
  clips: THREE.AnimationClip[]
  groupRef: React.RefObject<THREE.Group>
  isAnimating: boolean
  selectedAnimation?: string
  defaultAnimation?: string
  onAnimationChange?: (id: string) => void
}

/**
 * Unified animation controller hook
 * Manages animation playback, speed, seeking, and state
 * Extracted from HumanFigure.fixed.tsx for reuse across viewers
 */
export function useAnimationController({
  clips,
  groupRef,
  isAnimating,
  selectedAnimation,
  defaultAnimation,
  onAnimationChange,
}: UseAnimationControllerParams): {
  actions: Record<string, THREE.AnimationAction | null>
  names: string[]
  mixer: THREE.AnimationMixer | null
  currentAnimation: string | null
  api: AnimationControllerAPI
} {
  const { actions, names, mixer } = useAnimations(clips, groupRef)
  const currentAnimationRef = useRef<string | null>(null)
  const animatingRef = useRef<boolean>(isAnimating)
  const initializedRef = useRef(false)

  // Keep animating state in ref to avoid stale closures
  useEffect(() => {
    animatingRef.current = isAnimating
    if (mixer) {
      try {
        (mixer as any).timeScale = isAnimating ? 1 : 0
      } catch {
        /* noop */
      }
    }
  }, [isAnimating, mixer])

  // Update mixer every frame when animating
  useFrame((_, delta) => {
    if (!mixer || !animatingRef.current) return
    mixer.update(delta)
  })

  // Initialize with default animation
  useEffect(() => {
    if (initializedRef.current) return
    if (!actions || names.length === 0) return

    const defaultId = defaultAnimation || names[0]
    const defaultAction = actions[defaultId]

    if (defaultAction) {
      playAction(actions as any, mixer as any, defaultId)
      if (!isAnimating) setPaused(defaultAction as any, true)
      currentAnimationRef.current = defaultId
      initializedRef.current = true
      onAnimationChange?.(defaultId)
    }
  }, [actions, names, mixer, isAnimating, defaultAnimation, onAnimationChange])

  // Handle animation selection changes
  useEffect(() => {
    if (!selectedAnimation || !actions || !mixer) return
    if (selectedAnimation === currentAnimationRef.current) return
    if (!names.includes(selectedAnimation)) return

    playAction(actions as any, mixer as any, selectedAnimation)
    currentAnimationRef.current = selectedAnimation
    onAnimationChange?.(selectedAnimation)
  }, [selectedAnimation, actions, mixer, names, onAnimationChange])

  // Create API for external control
  const api: AnimationControllerAPI = {
    getDuration: useCallback(
      (id?: string) => {
        const clipName = id || currentAnimationRef.current || names[0]
        const action = clipName ? actions?.[clipName] : undefined
        if (!action) return null
        const clip = (action as any).getClip?.()
        const duration = clip?.duration
        return typeof duration === 'number' ? duration : null
      },
      [actions, names]
    ),

    getCurrentTime: useCallback(() => {
      const id = currentAnimationRef.current
      if (!id || !actions?.[id]) return 0
      const action = actions[id] as any
      const time = action?.time
      return typeof time === 'number' ? time : 0
    }, [actions]),

    setSpeed: useCallback(
      (s: number) => {
        const id = currentAnimationRef.current
        if (!id || !actions?.[id]) return
        try {
          const action = actions[id] as any
          action.setEffectiveTimeScale?.(s)
          if (typeof action.timeScale === 'number') {
            action.timeScale = s
          }
        } catch {
          /* noop */
        }
      },
      [actions]
    ),

    getSpeed: useCallback(() => {
      const id = currentAnimationRef.current
      if (!id || !actions?.[id]) return 1
      try {
        const action = actions[id] as any
        const viaGetter = action.getEffectiveTimeScale?.()
        if (typeof viaGetter === 'number') return viaGetter
        const direct = action.timeScale
        return typeof direct === 'number' ? direct : 1
      } catch {
        return 1
      }
    }, [actions]),

    seek: useCallback(
      (t: number) => {
        const id = currentAnimationRef.current
        if (!id || !actions?.[id]) return
        try {
          const action = actions[id] as any
          action.time = t
          action.paused = !isAnimating
        } catch {
          /* noop */
        }
      },
      [actions, isAnimating]
    ),

    play: useCallback(
      (id: string) => {
        if (!actions || !mixer || !names.includes(id)) return
        playAction(actions as any, mixer as any, id)
        currentAnimationRef.current = id
        onAnimationChange?.(id)
      },
      [actions, mixer, names, onAnimationChange]
    ),

    pause: useCallback(() => {
      const id = currentAnimationRef.current
      if (!id || !actions?.[id]) return
      setPaused(actions[id] as any, true)
    }, [actions]),

    resume: useCallback(() => {
      const id = currentAnimationRef.current
      if (!id || !actions?.[id]) return
      setPaused(actions[id] as any, false)
    }, [actions]),
  }

  return {
    actions: actions as Record<string, THREE.AnimationAction | null>,
    names,
    mixer: mixer as THREE.AnimationMixer | null,
    currentAnimation: currentAnimationRef.current,
    api,
  }
}
