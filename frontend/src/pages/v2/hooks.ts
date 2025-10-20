import * as THREE from 'three'
import { useCallback, useEffect, useRef } from 'react'
import type { AnimationAction, AnimationMixer } from 'three'
import { ANIMATIONS, pickDefaultId } from './manifest'
import { playAction, setPaused } from './mixer'
import { applyRestPoseFromSource } from './clipSelection'
import { SkeletonUtils } from 'three-stdlib'

export function useBaseRigDiagnostics(scene: THREE.Object3D, baseAnimations?: THREE.AnimationClip[]) {
  useEffect(() => {
    let skinned: THREE.SkinnedMesh | null = null
    let boneCount = 0
    scene.traverse((o) => {
      if (!skinned && (o as any).isSkinnedMesh) skinned = o as THREE.SkinnedMesh
      if ((o as any).isBone) boneCount++
    })
    if (!skinned || boneCount === 0) {
      /* Base model missing skinned mesh or skeleton */
    }
  }, [scene])

  // Stop any embedded base animations if present (avoid lingering idle)
  useEffect(() => {
    if (!baseAnimations || baseAnimations.length === 0) return
    const tempMixer = new THREE.AnimationMixer(scene)
    try {
      for (const clip of baseAnimations) {
        try { tempMixer.clipAction(clip).stop() } catch { /* noop */ }
      }
      tempMixer.stopAllAction()
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
}) {
  const { actions, names, mixer, isAnimating, onActiveChange, scene, gltfs } = params
  const currentRef = useRef<string | null>(null)
  const lastPoseForId = useRef<string | null>(null)
  const lastPausedState = useRef<boolean | null>(null)

  const applyRestPoseFor = useCallback((id: string) => {
    try {
      const idx = ANIMATIONS.findIndex(a => a.id === id)
      if (idx < 0) return
      const sourceRoot = (gltfs[idx]?.scene as THREE.Object3D) || null
      if (!sourceRoot) return
      const ok = applyRestPoseFromSource(scene, sourceRoot, SkeletonUtils as any)
      if (ok) {
        lastPoseForId.current = id
      }
    } catch {
      /* Failed to apply rest pose */
    }
  }, [gltfs, scene])

  const switchTo = useCallback((id: string) => {
    if (!actions) return false
    if (!actions[id]) return false
    // Guard: avoid re-triggering the same clip (prevents micro cross-fades/twitch)
    if (currentRef.current === id) {
      return true
    }
    // Validate that the action has usable bindings (not just tracks)
    const act: any = (actions as any)[id]
    const clip = act?.getClip?.()
    const bindings = Array.isArray((act as any)?._propertyBindings) ? (act as any)._propertyBindings.length : undefined
    const hasTracks = !!(clip && Array.isArray(clip.tracks) && clip.tracks.length > 0)
    const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
    if (!hasBindings) {
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
    return true
  }, [actions, mixer, onActiveChange, applyRestPoseFor, names])

  // default selection
  useEffect(() => {
    if (!actions || names.length === 0 || currentRef.current) return
    
    // Check if any clips have bound actions yet (async loading race condition)
    const hasAnyBoundActions = names.some(n => {
      const a: any = (actions as any)[n]
      if (!a) return false
      const bindings = Array.isArray((a as any)?._propertyBindings) ? (a as any)._propertyBindings.length : 0
      return bindings > 0
    })
    
    // If clips loaded but no actions bound yet, wait for next render
    if (!hasAnyBoundActions) return
    
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
      switchTo(chosen)
    }
  }, [actions, names, mixer, onActiveChange, switchTo])

  // play/pause (sync pause state when isAnimating or active animation changes)
  useEffect(() => {
    const id = currentRef.current
    if (!id || !actions) return
    const shouldBePaused = !isAnimating
    // Only call setPaused if the pause state actually changed
    if (lastPausedState.current !== shouldBePaused) {
      setPaused(actions[id], shouldBePaused)
      lastPausedState.current = shouldBePaused
    }
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
          return
        }
        // Validate repeat fallback has usable bindings
        const act: any = (actions as any)[firstRepeat]
        const clip = act?.getClip?.()
        const bindings = Array.isArray((act as any)?._propertyBindings) ? (act as any)._propertyBindings.length : undefined
        const hasTracks = !!(clip && Array.isArray(clip.tracks) && clip.tracks.length > 0)
        const hasBindings = typeof bindings === 'number' ? bindings > 0 : hasTracks
        if (!hasBindings) {
          return
        }
        if (lastPoseForId.current !== firstRepeat) applyRestPoseFor(firstRepeat)
        playAction(actions as any, mixer as any, firstRepeat)
        currentRef.current = firstRepeat
        onActiveChange?.(firstRepeat)
      }
    }
    ;(mixer as any).addEventListener?.('finished', onFinished)
    return () => { try { (mixer as any).removeEventListener?.('finished', onFinished) } catch { /* noop */ } }
  }, [mixer, actions, names, onActiveChange, applyRestPoseFor])

  return { get current() { return currentRef.current }, applyRestPoseFor, switchTo }
}
