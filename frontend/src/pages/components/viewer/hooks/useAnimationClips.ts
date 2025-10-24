import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { ANIMATIONS } from '../animations/manifest'
import { withBase, BASE_MODEL_PATH } from '../../../../shared/viewer/config'
import { GLTFLoader } from 'three-stdlib'
import { animationWarn } from '../../../../shared/utils/animationLogging'

export type LoadedAnimations = {
  baseScene: THREE.Object3D
  clips: THREE.AnimationClip[] // names set to spec.id (filename)
}

export function useAnimationClips(): LoadedAnimations {
  // Use the checked-in base model that exists under public/models
  const baseModelUrl = withBase(BASE_MODEL_PATH)

  const baseGltf = useGLTF(baseModelUrl)
  const baseScene = baseGltf.scene as THREE.Object3D
  
  // Debug: Check if base model has animations
  // debug logging removed

  // Load all animation GLBs in one hook call (array) to follow Hooks rules
  const animUrls = ANIMATIONS.map(a => a.path)
  const animGlts: any[] = useLoader(GLTFLoader, animUrls) as any

  const clips = useMemo(() => {
    const out: THREE.AnimationClip[] = []
    
  // debug logging removed
    
    for (let i = 0; i < ANIMATIONS.length; i++) {
      const spec = ANIMATIONS[i]
      const gltf = animGlts[i]
  const srcClips: THREE.AnimationClip[] = (gltf?.animations ?? []) as any
      
      if (!srcClips.length) {
        animationWarn('No animation clips found', { animationId: spec.id })
        continue
      }
      
      let src: THREE.AnimationClip | undefined = srcClips[0]
      if (srcClips.length > 1) {
        const clipName = (spec as any).clipName as string | undefined
        if (clipName) {
          const byName = srcClips.find(c => c.name === clipName || c.name.toLowerCase().includes(clipName.toLowerCase()))
          if (byName) src = byName
        } else if (typeof (spec as any).clipIndex === 'number') {
          const idx = Math.max(0, Math.min(srcClips.length - 1, (spec as any).clipIndex as number))
          src = srcClips[idx]
        } else {
          const stem = spec.id.replace(/\.[^/.]+$/, '')
          const byStem = srcClips.find(c => c.name.toLowerCase().includes(stem.toLowerCase()))
          if (byStem) src = byStem
        }
      }
      if (!src) {
        animationWarn('No selectable clip for animation', { animationId: spec.id })
        continue
      }
      
  // debug logging removed
      
      // Instead of retargeting, just use the animation directly
      // The animation files from Mixamo should work with the base model skeleton
  const cloned = src.clone()
      cloned.name = spec.id
      
    // debug logging removed
      out.push(cloned)
    }
    
    return out
  }, [animGlts])

  return { baseScene, clips }
}
