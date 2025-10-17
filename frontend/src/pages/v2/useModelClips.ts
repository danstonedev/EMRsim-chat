import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three-stdlib'
import type { AnimationSpec } from '../components/viewer/animations/manifest'
import { pickSourceClip } from './clipSelection'
import { remapTracksByName, retargetClipToTarget } from './rigMapping'
import { animationDebug, animationWarn } from '../../shared/utils/animationLogging'

export function useRetargetedClips(
  scene: THREE.Object3D,
  animations: AnimationSpec[],
  log = false,
) {
  const urls = animations.map(a => a.path)
  const gltfs = useLoader(GLTFLoader, urls) as Array<{ scene?: THREE.Object3D; animations?: THREE.AnimationClip[] }>

  const clips = ((): THREE.AnimationClip[] => {
    const out: THREE.AnimationClip[] = []
    for (let i = 0; i < animations.length; i++) {
      const spec = animations[i]
      const srcAnims = gltfs[i]?.animations
      let srcClip = pickSourceClip({ id: spec.id, clipIndex: spec.clipIndex, clipName: spec.clipName }, srcAnims)
  if (log && srcAnims) animationDebug('v2 source clips', { animationId: spec.id, clipNames: srcAnims.map(c => c.name) })
      if (!srcClip && srcAnims && srcAnims.length > 0) srcClip = srcAnims[0]
      if (!srcClip) {
        animationWarn('v2 missing animation in source GLTF', {
          animationId: spec.id,
          path: spec.path,
          animationCount: srcAnims?.length ?? 0,
        })
        continue
      }
      // Try retarget; if empty result, fallback to track rename remap
      let finalClip: THREE.AnimationClip | null = null
      try {
        const sourceRoot = (gltfs[i]?.scene as THREE.Object3D) || null
        const retargeted = retargetClipToTarget(scene, sourceRoot, srcClip)
        finalClip = retargeted && retargeted.tracks?.length ? retargeted : null
        if (finalClip && log) animationDebug('v2 retarget success', {
          animationId: spec.id,
          trackCount: finalClip.tracks.length,
        })
      } catch (e) {
        if (log) animationWarn('v2 retarget failed', {
          animationId: spec.id,
          message: (e as any)?.message,
        })
      }
      if (!finalClip) {
        const remapClip = remapTracksByName(scene, srcClip)
        finalClip = remapClip
        if (log) animationDebug('v2 track-name remap applied', {
          animationId: spec.id,
          trackCount: remapClip.tracks.length,
        })
      }
      finalClip.name = spec.id
      out.push(finalClip)
    }
    return out
  })()

  return { clips, gltfs }
}
