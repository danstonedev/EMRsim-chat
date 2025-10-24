import * as THREE from 'three'
import type { Pose, BonePose } from './poseLibrary'

/**
 * Applies a pose to a 3D model's skeleton
 */
export class ProceduralAnimator {
  private boneMap: Map<string, THREE.Bone> = new Map()
  private originalPoses: Map<string, { rotation: THREE.Euler; position: THREE.Vector3 }> = new Map()

  constructor(model: THREE.Object3D) {
    this.extractBones(model)
    this.saveOriginalPoses()
  }

  /**
   * Extracts all bones from the model and creates a lookup map
   */
  private extractBones(model: THREE.Object3D): void {
    model.traverse(child => {
      if (child instanceof THREE.Bone) {
        this.boneMap.set(child.name, child)
      }
    })
  }

  /**
   * Saves the original pose for resetting
   */
  private saveOriginalPoses(): void {
    this.boneMap.forEach((bone, name) => {
      this.originalPoses.set(name, {
        rotation: bone.rotation.clone(),
        position: bone.position.clone(),
      })
    })
  }

  /**
   * Applies a pose to the skeleton
   */
  applyPose(pose: Pose, blend: number = 1.0): void {
    Object.entries(pose.bones).forEach(([boneName, bonePose]) => {
      const bone = this.boneMap.get(boneName)
      if (!bone) return

      this.applyBonePose(bone, bonePose, blend)
    })
  }

  /**
   * Applies a pose to a specific bone with optional blending
   */
  private applyBonePose(bone: THREE.Bone, bonePose: BonePose, blend: number): void {
    // Apply rotation
    if (bonePose.rotation) {
      const targetRotation = new THREE.Euler(
        bonePose.rotation.x ?? bone.rotation.x,
        bonePose.rotation.y ?? bone.rotation.y,
        bonePose.rotation.z ?? bone.rotation.z
      )

      if (blend < 1.0) {
        // Blend between current and target rotation
        const currentQuat = new THREE.Quaternion().setFromEuler(bone.rotation)
        const targetQuat = new THREE.Quaternion().setFromEuler(targetRotation)
        currentQuat.slerp(targetQuat, blend)
        bone.rotation.setFromQuaternion(currentQuat)
      } else {
        bone.rotation.copy(targetRotation)
      }
    }

    // Apply position (less common, but supported)
    if (bonePose.position) {
      const targetPosition = new THREE.Vector3(
        bonePose.position.x ?? bone.position.x,
        bonePose.position.y ?? bone.position.y,
        bonePose.position.z ?? bone.position.z
      )

      if (blend < 1.0) {
        bone.position.lerp(targetPosition, blend)
      } else {
        bone.position.copy(targetPosition)
      }
    }
  }

  /**
   * Smoothly transitions between two poses over time
   */
  transitionToPose(targetPose: Pose, duration: number, onComplete?: () => void): void {
    const startTime = performance.now()
    const currentPose = this.getCurrentPose()

    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1.0)

      // Ease-in-out interpolation
      const alpha = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      this.blendPoses(currentPose, targetPose, alpha)

      if (progress < 1.0) {
        requestAnimationFrame(animate)
      } else {
        onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }

  /**
   * Blends between two poses
   */
  private blendPoses(poseA: Pose, poseB: Pose, alpha: number): void {
    const allBoneNames = new Set([...Object.keys(poseA.bones), ...Object.keys(poseB.bones)])

    allBoneNames.forEach(boneName => {
      const bone = this.boneMap.get(boneName)
      if (!bone) return

      const boneA = poseA.bones[boneName] || { rotation: { x: 0, y: 0, z: 0 } }
      const boneB = poseB.bones[boneName] || { rotation: { x: 0, y: 0, z: 0 } }

      // Interpolate rotation
      if (boneA.rotation || boneB.rotation) {
        const rotA = new THREE.Euler(boneA.rotation?.x ?? 0, boneA.rotation?.y ?? 0, boneA.rotation?.z ?? 0)
        const rotB = new THREE.Euler(boneB.rotation?.x ?? 0, boneB.rotation?.y ?? 0, boneB.rotation?.z ?? 0)

        const quatA = new THREE.Quaternion().setFromEuler(rotA)
        const quatB = new THREE.Quaternion().setFromEuler(rotB)
        quatA.slerp(quatB, alpha)
        bone.rotation.setFromQuaternion(quatA)
      }
    })
  }

  /**
   * Gets the current pose of the skeleton
   */
  getCurrentPose(): Pose {
    const bones: Record<string, BonePose> = {}

    this.boneMap.forEach((bone, name) => {
      bones[name] = {
        rotation: {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z,
        },
        position: {
          x: bone.position.x,
          y: bone.position.y,
          z: bone.position.z,
        },
      }
    })

    return {
      name: 'Current',
      description: 'Current skeleton pose',
      bones,
    }
  }

  /**
   * Resets skeleton to original pose
   */
  reset(): void {
    this.boneMap.forEach((bone, name) => {
      const original = this.originalPoses.get(name)
      if (original) {
        bone.rotation.copy(original.rotation)
        bone.position.copy(original.position)
      }
    })
  }

  /**
   * Gets a bone by name
   */
  getBone(name: string): THREE.Bone | undefined {
    return this.boneMap.get(name)
  }

  /**
   * Gets all bone names
   */
  getBoneNames(): string[] {
    return Array.from(this.boneMap.keys())
  }
}
