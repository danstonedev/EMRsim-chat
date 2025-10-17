import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { withBase, BASE_MODEL_PATH } from '../../../../shared/viewer/config'
import * as THREE from 'three'
import { animationDebug } from '../../../../shared/utils/animationLogging'

export type HumanFigureMetrics = {
  height: number
  center: THREE.Vector3
  radius: number
}

export function useHumanFigure() {
  const { scene } = useGLTF(withBase(BASE_MODEL_PATH))

  const { root, metrics } = useMemo(() => {
    const clonedModel = scene.clone(true)
    const container = new THREE.Group()
    container.name = 'HumanFigureRoot'
    container.add(clonedModel)

    // Enable shadows for all meshes
  clonedModel.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        // Apply consistent skin-tone material
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0xd4a574, // Skin tone
          metalness: 0,
          roughness: 0.7,
          flatShading: false,
          side: THREE.FrontSide,
        })
      }
    })

    const bbox = new THREE.Box3().setFromObject(clonedModel)
    const size = bbox.getSize(new THREE.Vector3())
    const desiredHeight = 1.8
    const scale = desiredHeight / size.y
    clonedModel.scale.setScalar(scale)

    bbox.setFromObject(clonedModel)
    const center = bbox.getCenter(new THREE.Vector3())
    clonedModel.position.sub(center)

    bbox.setFromObject(clonedModel)
    clonedModel.position.y -= bbox.min.y

    const sphere = bbox.getBoundingSphere(new THREE.Sphere())

    return {
      root: container,
      metrics: {
        height: desiredHeight,
        center: clonedModel.position.clone(),
        radius: sphere.radius,
      },
    }
  }, [scene])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return
    }

    const bbox = new THREE.Box3().setFromObject(root)
    const size = bbox.getSize(new THREE.Vector3())
    animationDebug('HumanFigure hook metrics', {
      size,
      position: root.position.clone(),
      scale: root.scale.clone(),
    })
  }, [root])

  return { root, metrics }
}

if (!(import.meta as any).vitest) {
  try { (useGLTF as any)?.preload?.(withBase(BASE_MODEL_PATH)) } catch { /* noop */ }
}
