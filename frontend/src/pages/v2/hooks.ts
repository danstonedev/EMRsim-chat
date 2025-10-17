import * as THREE from 'three'
import { useCallback, useEffect, useRef } from 'react'
import type { AnimationAction, AnimationMixer } from 'three'
import { ANIMATIONS, pickDefaultId } from './manifest'
import { playAction, setPaused } from './mixer'
import { applyRestPoseFromSource } from './clipSelection'
import { SkeletonUtils } from 'three-stdlib'
import { animationDebug, animationError, animationWarn } from '../../shared/utils/animationLogging'

export function useBaseRigDiagnostics(scene: THREE.Object3D, baseAnimations?: THREE.AnimationClip[], log = false) {
  useEffect(() => {
    let skinned: THREE.SkinnedMesh | null = null
    let boneCount = 0
    scene.traverse((o) => {
      if (!skinned && (o as any).isSkinnedMesh) skinned = o as THREE.SkinnedMesh
      if ((o as any).isBone) boneCount++
    })
    if (!skinned || boneCount === 0) {
      animationError('v2 base model missing skinned mesh or skeleton', {
        skinnedFound: !!skinned,
        boneCount,
      })
    } else if (log) {
      animationDebug('v2 base rig ready', {
        boneCount,
        hasSkeleton: !!(skinned as any)?.skeleton,
      })
    }
  }, [scene, log])

  // Stop any embedded base animations if present (avoid lingering idle)
  useEffect(() => {
    if (!baseAnimations || baseAnimations.length === 0) return
    const tempMixer = new THREE.AnimationMixer(scene)
    try {
      for (const clip of baseAnimations) {
        try { tempMixer.clipAction(clip).stop() } catch { /* noop */ }
      }
      tempMixer.stopAllAction()
  if (log) animationDebug('v2 stopped embedded base animations', baseAnimations.map(c => c.name))
    } catch { /* noop */ }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function usePlayback(params: {
  actions: Record<string, AnimationAction | null | undefined> | undefined
  names: string[]
  mixer: AnimationMixer | undefined
  isAnimating: boolean
  onActiveChange?: (id: string) => void
  scene: THREE.Object3D
  gltfs: Array<{ scene?: THREE.Object3D } | undefined>
  log?: boolean
}) {
  const { actions, names, mixer, isAnimating, onActiveChange, scene, gltfs, log } = params
  const currentRef = useRef<string | null>(null)
  const lastPoseForId = useRef<string | null>(null)

  const applyRestPoseFor = useCallback((id: string) => {
    try {
      const idx = ANIMATIONS.findIndex(a => a.id === id)
      if (idx < 0) return
      const sourceRoot = (gltfs[idx]?.scene as THREE.Object3D) || null
      if (!sourceRoot) return
      const ok = applyRestPoseFromSource(scene, sourceRoot, SkeletonUtils as any)
      if (ok) {
        lastPoseForId.current = id
        if (log) animationDebug('v2 applied rest pose', { animationId: id })
      }
    } catch (e) {
      if (log) animationWarn('v2 failed to apply rest pose', { animationId: id, message: (e as any)?.message })
    }
  }, [gltfs, scene, log])

  const switchTo = useCallback((id: string) => {
    if (!actions) return false
    if (!actions[id]) return false
    // Guard: avoid re-triggering the same clip (prevents micro cross-fades/twitch)
    if (currentRef.current === id) {
      if (log) animationDebug('v2 switchTo ignored (already current)', { animationId: id })
      return true
    }
    // Validate that the action has usable bindings (not just tracks)
    const act: any = (actions as any)[id]
    const clip = act?.getClip?.()
    const bindings = Array.isArray((act as any)?._propertyBindings) ? (act as any)._propertyBindings.length : undefined
    const hasTracks = !!(clip && Array.isArray(clip.tracks) && clip.tracks.length > 0)
    const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
    if (!hasBindings) {
      if (log) animationWarn('v2 switchTo aborted: no bound properties', {
        animationId: id,
        trackCount: clip?.tracks?.length ?? 0,
        bindingCount: bindings,
      })
      return false
    }
    if (lastPoseForId.current !== id) applyRestPoseFor(id)
    let ok = playAction(actions as any, mixer as any, id)
    if (!ok) {
      // Try another candidate with bindings
      const fallback = (names as string[]).find(n => {
        const a: any = (actions as any)[n]
        const clip = a?.getClip?.()
        const bindings = Array.isArray((a as any)?._propertyBindings) ? (a as any)._propertyBindings.length : undefined
        const hasTracks = !!(clip && Array.isArray(clip.tracks) && clip.tracks.length > 0)
        const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
        return hasBindings
      })
      if (fallback && fallback !== id) {
        ok = playAction(actions as any, mixer as any, fallback)
        if (ok) id = fallback
      }
    }
    if (!ok) return false
    ;(currentRef as any).current = id
    onActiveChange?.(id)
    if (log) {
      const running = Object.entries(actions)
        .filter(([, a]) => (a as any)?.isRunning?.())
        .map(([n]) => n)
      animationDebug('v2 switchTo result', { activeId: id, running })
    }
    return true
  }, [actions, mixer, onActiveChange, log, applyRestPoseFor, names])

  // default selection
  useEffect(() => {
    if (!actions || names.length === 0 || currentRef.current) return
    // Prefer a default that has bound tracks
    const candidates = [pickDefaultId(names as string[]) || names[0], ...names]
    const chosen = candidates.find(n => {
      const a: any = (actions as any)[n]
      const c = a?.getClip?.()
      const bindings = Array.isArray((a as any)?._propertyBindings) ? (a as any)._propertyBindings.length : undefined
      const hasTracks = !!(c && Array.isArray(c.tracks) && c.tracks.length > 0)
      const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
      return hasBindings
    })
    if (chosen && actions[chosen]) {
      const ok = switchTo(chosen)
      if (ok) {
        // Pause after starting if needed so mixer has a bound target but no motion
        if (!isAnimating) setPaused(actions[chosen], true)
        if (log) animationDebug('v2 default animation selected', { animationId: chosen })
      }
    } else if (log) {
      animationWarn('v2 no valid default animation with bound tracks found')
    }
  }, [actions, names, mixer, isAnimating, onActiveChange, log, switchTo])

  // play/pause
  useEffect(() => {
    const id = currentRef.current
    if (!id || !actions) return
    setPaused(actions[id], !isAnimating)
  }, [isAnimating, actions])

  // handle finished -> fallback
  useEffect(() => {
    if (!mixer || !actions) return
    const onFinished = () => {
      const id = currentRef.current
      if (!id) return
      const firstRepeat = (names as string[]).find(n => ANIMATIONS.find(a => a.id === n && a.loop === 'repeat'))
      if (firstRepeat && actions[firstRepeat]) {
        if (currentRef.current === firstRepeat) {
          if (log) animationDebug('v2 finished event already on repeat clip', { animationId: firstRepeat })
          return
        }
        // Validate repeat fallback has usable bindings
        const act: any = (actions as any)[firstRepeat]
        const clip = act?.getClip?.()
        const bindings = Array.isArray((act as any)?._propertyBindings) ? (act as any)._propertyBindings.length : undefined
        const hasTracks = !!(clip && Array.isArray(clip.tracks) && clip.tracks.length > 0)
        const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
        if (!hasBindings) {
          if (log) animationWarn('v2 finished: repeat fallback missing bound properties', { animationId: firstRepeat })
          return
        }
        if (lastPoseForId.current !== firstRepeat) applyRestPoseFor(firstRepeat)
        playAction(actions as any, mixer as any, firstRepeat)
        currentRef.current = firstRepeat
        onActiveChange?.(firstRepeat)
        if (log) animationDebug('v2 one-shot finished, fallback applied', { animationId: firstRepeat })
      }
    }
    ;(mixer as any).addEventListener?.('finished', onFinished)
    return () => { try { (mixer as any).removeEventListener?.('finished', onFinished) } catch { /* noop */ } }
  }, [mixer, actions, names, onActiveChange, log, applyRestPoseFor])

  return { get current() { return currentRef.current }, applyRestPoseFor, switchTo }
}
