import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { GLTFLoader } from 'three-stdlib'
import type { AnimationSpec } from '../components/viewer/animations/manifest'
import { pickSourceClip } from './clipSelection'
import { remapTracksByName, retargetClipToTarget } from './rigMapping'
import { extendGLTFLoader } from '../components/viewer/utils/loaderConfig'

type GLTFResult = { scene?: THREE.Object3D; animations?: THREE.AnimationClip[] }

export function useRetargetedClips(
  scene: THREE.Object3D,
  animations: AnimationSpec[],
  priorityId?: string,
) {
  const { gl } = useThree()
  
  // Lazy-load GLTFs on demand instead of loading all upfront
  const [clips, setClips] = useState<THREE.AnimationClip[]>([])
  const loadedGltfsRef = useRef<Map<string, GLTFResult>>(new Map())
  const loadingIdsRef = useRef<Set<string>>(new Set())
  const loaderRef = useRef<GLTFLoader | null>(null)

  // Initialize loader once
  if (!loaderRef.current) {
    const loader = new GLTFLoader()
    try { extendGLTFLoader(loader as any, gl as any) } catch { /* noop */ }
    loaderRef.current = loader
  }

  // Helper to load a single GLTF by id
  const loadGltfById = async (animId: string): Promise<GLTFResult | null> => {
    const spec = animations.find(a => a.id === animId)
    if (!spec) return null

    // Check cache first
    if (loadedGltfsRef.current.has(animId)) {
      return loadedGltfsRef.current.get(animId)!
    }

    // Check if already loading
    if (loadingIdsRef.current.has(animId)) {
      // Wait for existing load to complete
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!loadingIdsRef.current.has(animId)) {
            clearInterval(checkInterval)
            resolve(loadedGltfsRef.current.get(animId) || null)
          }
        }, 50)
      })
    }

    loadingIdsRef.current.add(animId)

    try {
      const gltf = await loaderRef.current!.loadAsync(spec.path)
      const result: GLTFResult = { scene: gltf.scene, animations: gltf.animations }
      loadedGltfsRef.current.set(animId, result)
      return result
    } catch {
      /* noop */
      return null
    } finally {
      loadingIdsRef.current.delete(animId)
    }
  }

  // Helper to build one clip by id
  const buildClipById = async (animId: string): Promise<THREE.AnimationClip | null> => {
    const spec = animations.find(a => a.id === animId)
    if (!spec) return null

    const gltf = await loadGltfById(animId)
    if (!gltf) return null

    const srcAnims = gltf.animations
    let srcClip = pickSourceClip({ id: spec.id, clipIndex: spec.clipIndex, clipName: spec.clipName }, srcAnims)
    if (!srcClip && srcAnims && srcAnims.length > 0) srcClip = srcAnims[0]
    if (!srcClip) {
      /* No source clip found */
      return null
    }
    let finalClip: THREE.AnimationClip | null = null
    try {
      const sourceRoot = (gltf.scene as THREE.Object3D) || null
      const retargeted = retargetClipToTarget(scene, sourceRoot, srcClip)
      finalClip = retargeted && retargeted.tracks?.length ? retargeted : null
    } catch {
      /* Retarget failed */
    }
    if (!finalClip) {
      const remapClip = remapTracksByName(scene, srcClip)
      finalClip = remapClip
    }
    finalClip.name = spec.id
    return finalClip
  }

  // Load animations on demand when requestedIds changes
  useEffect(() => {
    let cancelled = false

    const loadRequested = async () => {
      if (!scene || animations.length === 0) return

      // Determine which animations to load
      const toLoad: string[] = []
      
      // Always load priority/requested animation first
      if (priorityId && !loadedGltfsRef.current.has(priorityId)) {
        toLoad.push(priorityId)
      }

      // If no priority, load first animation as default
      if (!priorityId && animations.length > 0 && !loadedGltfsRef.current.has(animations[0].id)) {
        toLoad.push(animations[0].id)
      }

      // Load requested animations
      for (const animId of toLoad) {
        if (cancelled) return
        
        try {
          const clip = await buildClipById(animId)
          if (clip && !cancelled) {
            setClips(prev => {
              // Avoid duplicates
              if (prev.some(c => c.name === clip.name)) return prev
              return [...prev, clip]
            })
          }
        } catch {
          /* Failed to load animation */
        }
      }
    }

    void loadRequested()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, animations, priorityId])

  // Expose method to load additional animations on demand
  const loadAnimation = async (animId: string) => {
    if (loadedGltfsRef.current.has(animId)) {
      // Already loaded, ensure it's in clips
      const existing = clips.find(c => c.name === animId)
      if (existing) return existing
    }

    try {
      const clip = await buildClipById(animId)
      if (clip) {
        setClips(prev => {
          if (prev.some(c => c.name === clip.name)) return prev
          return [...prev, clip]
        })
        return clip
      }
    } catch {
      /* Failed to load animation on demand */
    }
    return null
  }

  return { clips, gltfs: Array.from(loadedGltfsRef.current.values()), loadAnimation }
}
