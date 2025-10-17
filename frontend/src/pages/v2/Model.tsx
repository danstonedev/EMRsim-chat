import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
// Debug analysis helpers removed
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
  getDebugInfo?: () => { id: string | null; time: number; speed: number; paused: boolean; weight: number; bindings: number }
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
  const LOG = false

  const { clips, gltfs } = useRetargetedClips(scene, ANIMATIONS, LOG)

  const groupRef = useRef<THREE.Group>(null)
  const { actions, names, mixer } = useAnimations(clips, groupRef)

  useBaseRigDiagnostics(scene, baseGltf.animations, LOG)

  const { switchTo, current } = usePlayback({
    actions,
    names: names as string[],
    mixer: mixer as any,
    isAnimating,
    onActiveChange,
    scene,
    gltfs: gltfs as any,
    log: LOG,
  })

  // Imperative playback API for external UIs (PlaybackModal)
  useImperativeHandle(apiRef, () => ({
    getDuration: (id?: string) => {
      const targetId = id || (current as unknown as string | null) || (names?.[0] as string | undefined)
      if (!targetId) return null
      const clip = clips.find(c => c.name === targetId)
      return clip ? clip.duration : null
    },
    getCurrentTime: () => {
      const cur = (current as unknown as string | null) || (names?.[0] as string | undefined)
      if (!cur) return 0
      const a = (actions as any)?.[cur]
      return Number(a?.time ?? 0)
    },
    setSpeed: (s: number) => {
      const cur = (current as unknown as string | null) || (names?.[0] as string | undefined)
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { a?.setEffectiveTimeScale?.(s) } catch { /* noop */ }
      try { (a as any).timeScale = s } catch { /* noop */ }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
    getSpeed: () => {
      const cur = (current as unknown as string | null) || (names?.[0] as string | undefined)
      if (!cur) return 1
      const a = (actions as any)?.[cur]
      return Number((a as any)?.timeScale ?? 1)
    },
    seek: (t: number) => {
      const cur = (current as unknown as string | null) || (names?.[0] as string | undefined)
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { (a as any).time = Math.max(0, Number(t) || 0) } catch { /* noop */ }
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
    getDebugInfo: () => {
      try {
        const cur = (current as unknown as string | null) || null
        const a = cur ? (actions as any)?.[cur] : null
        const time = Number(a?.time ?? 0)
        const speed = Number((a as any)?.timeScale ?? 1)
        const paused = Boolean((a as any)?.paused)
        const weight = Number((a as any)?.getEffectiveWeight?.() ?? (a as any)?.weight ?? 0)
        const bindings = Array.isArray((a as any)?._propertyBindings) ? (a as any)._propertyBindings.length : 0
        return { id: cur, time, speed, paused, weight, bindings }
      } catch {
        return { id: null, time: 0, speed: 1, paused: false, weight: 0, bindings: 0 }
      }
    },
    play: () => {
      const cur = ((current as unknown as string | null) || (names?.find(n => (actions as any)?.[n]) as string | undefined) || (names?.[0] as string | undefined))
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
      const cur = ((current as unknown as string | null) || (names?.find(n => (actions as any)?.[n]) as string | undefined) || (names?.[0] as string | undefined))
      if (!cur) return
      const a = (actions as any)?.[cur]
      try { (a as any).paused = true } catch { /* noop */ }
      try { (a as any).setEffectiveTimeScale?.(0) } catch { /* noop */ }
      try { (mixer as any)?.update?.(0) } catch { /* noop */ }
    },
  }), [actions, names, mixer, clips, current])

  // Debug: report binding coverage per clip when logging is enabled
  // Debug logging removed

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

  // handle requests
  useEffect(() => {
    if (!requestedId || !actions) return
    switchTo(requestedId)
  }, [requestedId, actions, switchTo])

  useFrame((_, d) => { if (mixer) mixer.update(d) })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={MODEL.scale ?? 1} rotation={MODEL.rotation as any} />
    </group>
  )
})

export default Model
