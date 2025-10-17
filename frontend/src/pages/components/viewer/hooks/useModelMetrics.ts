import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { animationDebug } from '../../../../shared/utils/animationLogging'

export type ModelMetrics = {
  desiredHeight: number
  scaleFactor: number
  boundingBox: THREE.Box3
  boundingSphere: THREE.Sphere
}

type UseModelMetricsProps = {
  scene: THREE.Group | THREE.Object3D
  desiredHeight?: number
  onMetrics?: (metrics: ModelMetrics) => void
  debug?: boolean
}

/**
 * Calculates and caches model metrics (bounding box, scale factor, etc.)
 * Reusable across all viewer components that need model scaling.
 */
export function useModelMetrics({
  scene,
  desiredHeight = 1.8,
  onMetrics,
  debug = false,
}: UseModelMetricsProps): ModelMetrics | null {
  const metricsRef = useRef<ModelMetrics | null>(null)

  // Calculate metrics once on mount
  if (!metricsRef.current && scene) {
  if (debug) animationDebug('Calculating model metrics (first time)')

    const bbox = new THREE.Box3().setFromObject(scene)
    const size = bbox.getSize(new THREE.Vector3())
    const scaleFactor = desiredHeight / size.y

    metricsRef.current = {
      desiredHeight,
      scaleFactor,
      boundingBox: bbox.clone(),
      boundingSphere: bbox.getBoundingSphere(new THREE.Sphere()),
    }

  if (debug) animationDebug('Model metrics calculated', metricsRef.current)
  }

  const metrics = metricsRef.current

  // Send metrics back to parent (only once on mount)
  useEffect(() => {
    if (onMetrics && metrics) {
  if (debug) animationDebug('Sending model metrics to parent')
      onMetrics(metrics)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return metrics
}
