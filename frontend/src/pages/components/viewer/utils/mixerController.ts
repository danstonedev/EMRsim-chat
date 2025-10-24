import * as THREE from 'three'
import type { AnimationAction, AnimationMixer } from 'three'
import { ANIMATIONS } from '../animations/manifest'
import { getViewerSettings } from '../../../../shared/viewer/settings'

export function stopOthers(actions: Record<string, AnimationAction | null | undefined>, keep: string, mixer?: AnimationMixer) {
  Object.entries(actions).forEach(([name, a]) => {
    if (!a) return
    if (name !== keep) {
      try { a.stop() } catch { /* noop */ }
      try { (a as any).setEffectiveWeight?.(0) } catch { /* noop */ }
      // Ensure the mixer does not evaluate this action at all
      try { (a as any).enabled = false } catch { /* noop */ }
      try { (a as any).paused = true } catch { /* noop */ }
    }
  })
  // Settle any residual bindings immediately
  try { mixer?.update(0) } catch { /* noop */ }
}

export function applyLoopPolicy(action: AnimationAction, id: string) {
  const spec = ANIMATIONS.find(a => a.id === id)
  if (!spec) return
  try {
    if (spec.loop === 'repeat') {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    } else {
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
    }
    const speed = typeof spec.speed === 'number' ? spec.speed : getViewerSettings().defaultSpeed
    action.timeScale = speed
  } catch { /* noop */ }
}

export function playAction(
  actions: Record<string, AnimationAction | null | undefined>,
  mixer: AnimationMixer | undefined,
  id: string
) {
  stopOthers(actions, id, mixer)
  const target = actions[id]
  if (!target) return
  // If the target is already the active, weighted action, avoid resetting/replaying
  try {
    const running = (target as any).isRunning?.() === true
    const enabled = (target as any).enabled !== false
    const weight = typeof (target as any).getEffectiveWeight === 'function' ? (target as any).getEffectiveWeight() : 1
    if (running && enabled && weight >= 0.99) {
      // Ensure loop policy and timescale are correct, then bail
      applyLoopPolicy(target, id)
      try { (target as any).paused = false } catch { /* noop */ }
  try { (target as any).setEffectiveTimeScale?.((target as any).timeScale ?? getViewerSettings().defaultSpeed) } catch { /* noop */ }
      try { (target as any).setEffectiveWeight?.(1) } catch { /* noop */ }
      try { mixer?.update(0) } catch { /* noop */ }
      return
    }
  } catch { /* noop */ }
  // If resuming from pause, do not reset or jump to time 0; just unpause and continue
  try {
    const wasPaused = (target as any).paused === true
    if (wasPaused) {
      applyLoopPolicy(target, id)
      try { (target as any).enabled = true } catch { /* noop */ }
      try { (target as any).paused = false } catch { /* noop */ }
      try { (target as any).setEffectiveWeight?.(1) } catch { /* noop */ }
  try { (target as any).setEffectiveTimeScale?.((target as any).timeScale ?? getViewerSettings().defaultSpeed) } catch { /* noop */ }
      target.play()
      try { mixer?.update(0) } catch { /* noop */ }
      return
    }
  } catch { /* noop */ }
  // Enable only the target action before playing
  try { (target as any).enabled = true } catch { /* noop */ }
  try { (target as any).paused = false } catch { /* noop */ }
  try { target.reset() } catch { /* noop */ }
  applyLoopPolicy(target, id)
  // Debug: report clip duration and effective time scale
  // debug logging removed
  try { (target as any).setEffectiveWeight?.(1) } catch { /* noop */ }
  try { (target as any).setEffectiveTimeScale?.((target as any).timeScale ?? getViewerSettings().defaultSpeed) } catch { /* noop */ }
  try { (target as any).time = 0 } catch { /* noop */ }
  target.play()
  try { mixer?.update(0) } catch { /* noop */ }
}

export function setPaused(action: AnimationAction | null | undefined, paused: boolean) {
  if (!action) return
  action.paused = paused
}
