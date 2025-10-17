import * as THREE from 'three'
import type { AnimationAction, AnimationMixer } from 'three'
import { ANIMATIONS } from './manifest'
import { getViewerSettings } from '../../shared/viewer/settings'

export function stopOthers(actions: Record<string, AnimationAction | null | undefined>, keep: string) {
  Object.entries(actions).forEach(([name, a]) => {
    if (!a || name === keep) return
  try { a.stop() } catch { /* noop */ }
  try { (a as any).setEffectiveWeight?.(0) } catch { /* noop */ }
  })
}

export function applyLoopPolicy(action: AnimationAction, id: string) {
  const spec = ANIMATIONS.find(a => a.id === id)
  if (!spec) return
  if (spec.loop === 'repeat') {
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
  } else {
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
  }
  // Apply per-clip speed if provided; default 1
  const raw = spec.speed ?? getViewerSettings().defaultSpeed
  const speed = Number.isFinite(raw) ? Math.max(0.25, raw) : 1
  try { (action as any).timeScale = speed } catch { /* noop */ }
  try { (action as any).setEffectiveTimeScale?.(speed) } catch { /* noop */ }
}

export function playAction(
  actions: Record<string, AnimationAction | null | undefined>,
  mixer: AnimationMixer | undefined,
  id: string
): boolean {
  // Crossfade from any running action to the new one for ~80ms as a safety net
  const target = actions[id]
  if (!target) return false
  Object.entries(actions).forEach(([name, a]) => {
    if (!a || name === id) return
    try {
      if ((a as any).isRunning?.()) {
        ;(a as any).crossFadeTo?.(target, 0.08, false)
      } else {
        a.stop()
      }
    } catch { /* noop */ }
  })
  try { target.reset() } catch { /* noop */ }
  applyLoopPolicy(target, id)
  // Ensure we are not paused and have full weight
  try { (target as any).paused = false } catch { /* noop */ }
  try { (target as any).enabled = true } catch { /* noop */ }
  // Effective time scale is set in applyLoopPolicy to respect per-clip speed
  try { (target as any).setEffectiveWeight?.(1) } catch { /* noop */ }
  try { (target as any).time = 0 } catch { /* noop */ }
  target.play()
  try { mixer?.update(0) } catch { /* noop */ }

  // After playing, verify that bindings exist; otherwise, this action won't affect the model
  try {
    const bindings = Array.isArray((target as any)?._propertyBindings) ? (target as any)._propertyBindings.length : undefined
    if (typeof bindings === 'number' && bindings <= 0) {
      // Stop this action; report failure to caller so it can choose a different clip
      try { (target as any).stop?.() } catch { /* noop */ }
      return false
    }
  } catch { /* ignore */ }
  return true
}

export function setPaused(action: AnimationAction | null | undefined, paused: boolean) {
  if (!action) return
  try { (action as any).paused = paused } catch { /* noop */ }
  // When resuming, restore the clip's inherent speed (timeScale)
  try {
    const cur = (action as any).timeScale
    const current = Number.isFinite(cur) && cur > 0 ? cur : 0.5
    ;(action as any).setEffectiveTimeScale?.(paused ? 0 : current)
  } catch { /* noop */ }
}
