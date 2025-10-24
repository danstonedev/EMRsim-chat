import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { normalizeHumanModel, type ModelMetrics } from './utils/modelMetrics'
import { withBase, BASE_MODEL_PATH } from '../../../shared/viewer/config'
import { analyzeModelSkeleton, logSkeletonInfo } from './utils/skeletonAnalyzer'
import { ProceduralAnimator } from './utils/proceduralAnimator'
import { routeAnimationPrompt } from './utils/promptRouter'
// debug flags removed
import { MovementController } from './utils/movementSystem'
import { animationDebug } from '../../../shared/utils/animationLogging'

type HumanFigureProps = {
  isAnimating: boolean
  animationPrompt?: string
  onMetrics?: (metrics: ModelMetrics) => void
  onPromptResult?: (result: string) => void
}

/**
 * Professional human figure loaded from Mixamo Manny model
 * Model: /models/Manny_Static.glb (Manny character from Mixamo)
 * Supports text-based animation prompts for procedural poses
 */
export default function HumanFigure({
  isAnimating: isAnimating,
  animationPrompt,
  onMetrics,
  onPromptResult,
}: HumanFigureProps) {
  // Resolve model URL using Vite base path to work under subpaths and dev/prod
  const MODEL_URL = withBase(BASE_MODEL_PATH)
  
  animationDebug('HumanFigure loading model', MODEL_URL)
  
  const gltf = useGLTF(MODEL_URL)
  const scene = gltf.scene
  
  animationDebug('HumanFigure model loaded', scene)
  
  const animatorRef = useRef<ProceduralAnimator | null>(null)
  const movementControllerRef = useRef<MovementController | null>(null)
  const lastPromptRef = useRef<string>('')
  const modelRef = useRef<{ root: THREE.Group; metrics: ModelMetrics } | null>(null)

  // Only normalize once, cache the result
  if (!modelRef.current) {
  animationDebug('HumanFigure normalizing model')
    modelRef.current = normalizeHumanModel(scene)
  animationDebug('HumanFigure model normalized', modelRef.current.metrics)
  }

  const { root, metrics } = modelRef.current

  useEffect(() => {
    onMetrics?.(metrics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize both the procedural animator and movement controller (only once)
  useEffect(() => {
    if (!animatorRef.current) {
      animatorRef.current = new ProceduralAnimator(root)
    }

    if (!movementControllerRef.current) {
      movementControllerRef.current = new MovementController(root)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update animation frame (respect isAnimating state)
  useFrame(() => {
    if (!isAnimating) return
    
    const controller = movementControllerRef.current
    if (controller) {
      controller.update()
    }
  })

  // Handle animation prompt changes
  useEffect(() => {
    if (!animationPrompt) return
    if (animationPrompt === lastPromptRef.current) return
    lastPromptRef.current = animationPrompt

    routeAnimationPrompt(
      animationPrompt,
      animatorRef.current,
      movementControllerRef.current,
      { onPromptResult }
    )
  }, [animationPrompt, onPromptResult])

  useEffect(() => {
  if (process.env.NODE_ENV !== 'production') {
      const size = metrics.boundingBox.getSize(new THREE.Vector3())
      animationDebug('HumanFigure metrics', {
        size,
        scaleFactor: metrics.scaleFactor,
        sphereRadius: metrics.boundingSphere.radius,
      })
      const skeletonInfo = analyzeModelSkeleton(scene)
      logSkeletonInfo(skeletonInfo)
    }
  }, [metrics, scene])

  animationDebug('HumanFigure rendering group', root)
  return (
    <group>
      <primitive object={root} />
    </group>
  )
}

// Skip preload during Vitest to avoid jsdom issues
if (!(import.meta as any).vitest) {
  try {
  (useGLTF as any)?.preload?.(withBase(BASE_MODEL_PATH))
  } catch { /* noop */ }
}
