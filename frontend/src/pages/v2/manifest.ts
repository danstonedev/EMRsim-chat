export type ModelConfig = {
  // Path relative to BASE to the GLB of the base rig/model
  baseModelPath: string
  // Optional transforms if the model needs basic adjustments
  scale?: number
  rotation?: [number, number, number]
}
import { BASE_MODEL_PATH } from '../../shared/viewer/config'
// Re-use the shared animations manifest so IDs and paths are consistent across the app
export type { AnimationSpec, LoopPolicy } from '../components/viewer/animations/manifest'
import { ANIMATIONS as SHARED_ANIMATIONS, DEFAULT_ANIMATION_ID } from '../components/viewer/animations/manifest'

export const MODEL: ModelConfig = {
  baseModelPath: BASE_MODEL_PATH,
  scale: 1,
}

// Use the consolidated list detected by the scanner so chat, modal, and v2 viewer all agree
export const ANIMATIONS = SHARED_ANIMATIONS

export function pickDefaultId(ids: string[]): string | undefined {
  // Prefer explicit default (Stand.glb) when available
  if (ids.includes(DEFAULT_ANIMATION_ID)) return DEFAULT_ANIMATION_ID
  // Otherwise prefer first repeat clip; else first available
  const repeatPreferred = ANIMATIONS.find(a => a.loop === 'repeat' && ids.includes(a.id))
  if (repeatPreferred) return repeatPreferred.id
  return ids[0]
}
