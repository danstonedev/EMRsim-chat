import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

export type ModelMetrics = {
  desiredHeight: number
  scaleFactor: number
  boundingBox: THREE.Box3
  boundingSphere: THREE.Sphere
}

export function normalizeHumanModel(scene: THREE.Object3D, desiredHeight = 1.8) {
  // Use SkeletonUtils.clone to properly rebind skinned meshes to cloned bones
  const root = new THREE.Group()
  const model = SkeletonUtils.clone(scene)
  root.add(model)

  model.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Ensure skinned meshes use a skinning-enabled material
      if (child instanceof THREE.SkinnedMesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            if (mat && typeof (mat as any) === 'object' && 'skinning' in (mat as any)) {
              ;(mat as any).skinning = true
            }
          })
        } else if (mesh.material) {
          const m = mesh.material as any
          if (m && typeof m === 'object' && 'skinning' in m) {
            m.skinning = true
          }
        }
      }
    }
  })

  const bbox = new THREE.Box3().setFromObject(model)
  const size = bbox.getSize(new THREE.Vector3())
  const scaleFactor = desiredHeight / size.y
  model.scale.setScalar(scaleFactor)

  bbox.setFromObject(model)
  const center = bbox.getCenter(new THREE.Vector3())
  model.position.sub(center)

  bbox.setFromObject(model)
  model.position.y -= bbox.min.y

  const metrics: ModelMetrics = {
    desiredHeight,
    scaleFactor,
    boundingBox: bbox.clone(),
    boundingSphere: bbox.getBoundingSphere(new THREE.Sphere()),
  }

  return { root, metrics }
}
