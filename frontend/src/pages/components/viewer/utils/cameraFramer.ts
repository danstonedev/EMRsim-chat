import type { PerspectiveCamera } from 'three'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ModelMetrics } from './modelMetrics'

/**
 * Frame the camera and orbit controls around the model using its metrics.
 * Keeps all camera math in one place for easier debugging.
 */
export function frameCamera(
  camera: PerspectiveCamera,
  controls: OrbitControlsImpl | null | undefined,
  metrics: ModelMetrics
) {
  const bbox = metrics.boundingBox
  const target = new THREE.Vector3(0, bbox.getCenter(new THREE.Vector3()).y, 0)
  const distance = metrics.boundingSphere.radius * 3.5
  const offset = new THREE.Vector3(0, 0.2, 1).normalize().multiplyScalar(distance)
  const position = target.clone().add(offset)

  camera.position.copy(position)
  camera.near = 0.05
  camera.far = Math.max(200, metrics.boundingSphere.radius * 20)
  camera.updateProjectionMatrix()

  if (controls) {
    const radius = metrics.boundingSphere.radius
    const min = Math.max(0.25, radius * 0.7)
    const max = Math.max(20, radius * 8)
    controls.minDistance = min
    controls.maxDistance = max
    controls.target.copy(target)
    controls.update()
  }
}
