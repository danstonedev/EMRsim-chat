import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { ANIMATIONS, MODEL } from './manifest'
import { useBaseRigDiagnostics, usePlayback } from './hooks'
import { useRetargetedClips } from './useModelClips'
import { useViewerSettings } from '../../shared/viewer/settings'
import { ANIMATIONS as SHARED_ANIMS } from '../components/viewer/animations/manifest'

export type V2PlaybackAPI = {
  getDuration: (id?: string) => number | null
  getCurrentTime: () => number
  setSpeed: (s: number) => void
  getSpeed: () => number
  seek: (t: number) => void
  getCurrentId?: () => string | null
  play?: () => void
  pause?: () => void
}

type Props = {
  isAnimating: boolean
  requestedId?: string
  onActiveChange?: (id: string) => void
  onMetrics?: (m: { boundingBox: THREE.Box3; boundingSphere: THREE.Sphere; desiredHeight: number; scaleFactor: number }) => void
}

const Model = forwardRef<V2PlaybackAPI | null, Props>(function Model({ isAnimating, requestedId, onActiveChange, onMetrics }, apiRef) {
  const { settings } = useViewerSettings()
  const BASE_URL = (import.meta as any).env?.BASE_URL || '/'
  const baseUrl = useMemo(() => `${BASE_URL}${settings.baseModelPath}`, [BASE_URL, settings.baseModelPath])
  const baseGltf = useGLTF(baseUrl) as unknown as { scene: THREE.Object3D; animations?: THREE.AnimationClip[] }
  const { scene } = baseGltf

  const { clips, gltfs, loadAnimation } = useRetargetedClips(scene, ANIMATIONS, requestedId)

  const groupRef = useRef<THREE.Group>(null)
  const lastRequestedRef = useRef<string | null>(null)

  // Maintain a small set of bound clip ids to avoid creating actions for all clips at once
  const allNames = useMemo(() => clips.map(c => c.name), [clips])
  const [boundIds, setBoundIds] = useState<string[]>(() => {
    const first = requestedId && allNames.includes(requestedId) ? requestedId : (allNames[0] || '')
    return first ? [first] : []
  })
  
  // Load animation on demand when requestedId changes
  useEffect(() => {
    if (!requestedId || allNames.includes(requestedId)) return
    // Animation not loaded yet, load it now
    void loadAnimation(requestedId)
  }, [requestedId, allNames, loadAnimation])
  
  // Keep a tiny LRU of bound ids; include requested/current when it changes
  useEffect(() => {
    if (!requestedId || !allNames.includes(requestedId)) return
    setBoundIds(prev => {
      const next = [requestedId, ...prev.filter(id => id !== requestedId)]
      // Limit bound set to a small number to cap binding cost
      return next.slice(0, 3)
    })
  }, [requestedId, allNames])
  
  // If no bound yet but clips arrived, bind the first available
  useEffect(() => {
    if (boundIds.length === 0 && allNames.length > 0) setBoundIds([allNames[0]])
  }, [allNames, boundIds.length])

  const activeClips = useMemo(() => {
    return clips.filter(c => boundIds.includes(c.name))
  }, [clips, boundIds])
  const { actions, mixer } = useAnimations(activeClips, groupRef)

  useBaseRigDiagnostics(scene, baseGltf.animations)

  const { switchTo, current } = usePlayback({
    actions,
    names: allNames as string[],
    mixer: mixer as any,
    isAnimating,
    onActiveChange,
    scene,
    gltfs: gltfs as any,
  })

  // Imperative playback API for external UIs (PlaybackModal)
  useImperativeHandle(apiRef, () => ({
    getDuration: (id?: string) => {
      const targetId = id || (current as unknown as string | null) || (allNames?.[0] as string | undefined)
      if (!targetId) return null
      const clip = clips.find(c => c.name === targetId)
      return clip ? clip.duration : null
    },
    getCurrentTime: () => {
      const cur = (current as unknown as string | null) || (allNames?.[0] as string | undefined)
      if (!cur) return 0
      const a = (actions as any)?.[cur]
      return Number(a?.time ?? 0)
    },
    setSpeed: (s: number) => {
      const cur = (current as unknown as string | null) || (allNames?.[0] as string | undefined)
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { a?.setEffectiveTimeScale?.(s) } catch { /* noop */ }
      try { (a as any).timeScale = s } catch { /* noop */ }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
    getSpeed: () => {
      const cur = (current as unknown as string | null) || (allNames?.[0] as string | undefined)
      if (!cur) return 1
      const a = (actions as any)?.[cur]
      return Number((a as any)?.timeScale ?? 1)
    },
    seek: (t: number) => {
      const cur = (current as unknown as string | null) || (allNames?.[0] as string | undefined)
      if (!cur) return
      
      const a = (actions as any)?.[cur]
      if (!a) return
      
      try { 
        (a as any).time = Math.max(0, Number(t) || 0)
      } catch { 
        // Ignore seek errors
      }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
    getCurrentId: () => {
      try {
        const cur = (current as unknown as string | null)
        return cur ?? null
      } catch {
        return null
      }
    },
    play: () => {
      const cur = ((current as unknown as string | null) || (allNames?.find((n: string) => (actions as any)?.[n]) as string | undefined) || (allNames?.[0] as string | undefined))
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { (a as any).paused = false } catch { /* noop */ }
      try {
        const spec = SHARED_ANIMS.find(s => s.id === cur)
        const raw = (a as any).timeScale ?? spec?.speed ?? 1
        const ts = Number.isFinite(raw) ? Math.max(0.25, raw) : 1
        ;(a as any).setEffectiveTimeScale?.(ts)
      } catch { /* noop */ }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
    pause: () => {
      const cur = ((current as unknown as string | null) || (allNames?.find((n: string) => (actions as any)?.[n]) as string | undefined) || (allNames?.[0] as string | undefined))
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { (a as any).paused = true } catch { /* noop */ }
      try { (a as any).setEffectiveTimeScale?.(0) } catch { /* noop */ }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
  }), [actions, allNames, mixer, clips, current])

  // Emit basic metrics once base scene is ready
  useEffect(() => {
    if (!scene) return
    try {
      const bbox = new THREE.Box3().setFromObject(scene)
      const sphere = bbox.getBoundingSphere(new THREE.Sphere())
      const size = bbox.getSize(new THREE.Vector3())
      const desiredHeight = size.y
      const scaleFactor = 1
      ;(onMetrics as any)?.({ boundingBox: bbox, boundingSphere: sphere, desiredHeight, scaleFactor })
    } catch { /* noop */ }
  }, [scene, onMetrics])

  // handle requests (only when requestedId actually changes)
  useEffect(() => {
    if (!requestedId || !actions) return
    
    // Only switch if the requestedId has actually changed
    if (lastRequestedRef.current === requestedId) return
    
    // Check if the requested animation is bound yet (async loading)
    const act: any = (actions as any)[requestedId]
    if (!act) return // Animation not loaded/bound yet, wait for next render
    
    const bindings = Array.isArray(act?._propertyBindings) ? act._propertyBindings.length : 0
    if (bindings === 0) return // Not bound yet, wait for next render
    
    lastRequestedRef.current = requestedId
    switchTo(requestedId)
  }, [requestedId, actions, switchTo])

  useFrame((_, d) => {
    if (!mixer) return
    mixer.update(d)
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={MODEL.scale ?? 1} rotation={MODEL.rotation as any} />
    </group>
  )
})

export default Model
