import { useCallback, useImperativeHandle, type Ref } from 'react'
import type * as THREE from 'three'

export type PlaybackAPI = {
  getDuration: (id?: string) => number | null
  getCurrentTime: () => number
  setSpeed: (s: number) => void
  getSpeed: () => number
  seek: (t: number) => void
}

type UsePlaybackAPIProps = {
  actions: Record<string, any> | null
  currentAnimationId: string | null
  isAnimating: boolean
  defaultNames?: string[]
}

/**
 * Reusable hook that exposes a standard playback API for animation controls.
 * Used by HumanFigure.fixed and can be used by other animation components.
 */
export function usePlaybackAPI(
  ref: Ref<PlaybackAPI | null>,
  props: UsePlaybackAPIProps
) {
  const { actions, currentAnimationId, isAnimating, defaultNames = [] } = props

  const getDuration = useCallback(
    (id?: string) => {
      const clipName = id || currentAnimationId || defaultNames[0]
      const action: THREE.AnimationAction | undefined = clipName
        ? (actions?.[clipName] as unknown as THREE.AnimationAction | undefined)
        : undefined
      const clip = action?.getClip?.()
      return typeof clip?.duration === 'number' ? clip.duration : null
    },
    [actions, currentAnimationId, defaultNames]
  )

  const getCurrentTime = useCallback(() => {
    try {
      const id = currentAnimationId
      if (!id || !actions?.[id]) return 0
      const action = actions[id] as unknown as THREE.AnimationAction | undefined
      return typeof action?.time === 'number' ? action.time : 0
    } catch {
      return 0
    }
  }, [actions, currentAnimationId])

  const setSpeed = useCallback(
    (s: number) => {
      const id = currentAnimationId
      if (!id || !actions?.[id]) return
      try {
        const action = actions[id] as unknown as THREE.AnimationAction
        // Prefer official API
        action.setEffectiveTimeScale?.(s)
        // Best-effort direct property if available in typings
        if (typeof (action as any).timeScale === 'number') {
          ;(action as any).timeScale = s
        }
      } catch {
        /* noop */
      }
    },
    [actions, currentAnimationId]
  )

  const getSpeed = useCallback(() => {
    const id = currentAnimationId
    if (!id || !actions?.[id]) return 1
    try {
      const action = actions[id] as unknown as THREE.AnimationAction
      const viaGetter = action.getEffectiveTimeScale?.()
      if (typeof viaGetter === 'number') return viaGetter
      const direct = (action as any).timeScale
      return typeof direct === 'number' ? direct : 1
    } catch {
      return 1
    }
  }, [actions, currentAnimationId])

  const seek = useCallback(
    (t: number) => {
      const id = currentAnimationId
      if (!id || !actions?.[id]) return
      try {
        const action = actions[id] as unknown as THREE.AnimationAction
        ;(action as any).time = t
        action.paused = !isAnimating
      } catch {
        /* noop */
      }
    },
    [actions, currentAnimationId, isAnimating]
  )

  useImperativeHandle(
    ref,
    () => ({
      getDuration,
      getCurrentTime,
      setSpeed,
      getSpeed,
      seek,
    }),
    [getDuration, getCurrentTime, setSpeed, getSpeed, seek]
  )

  return {
    getDuration,
    getCurrentTime,
    setSpeed,
    getSpeed,
    seek,
  }
}
