import * as THREE from 'three'
import { animationDebug, animationError, animationWarn } from '../../../../shared/utils/animationLogging'

export interface Movement {
  name: string
  duration: number
  loop: boolean
  keyframes: MovementKeyframe[]
}

export interface MovementKeyframe {
  time: number // 0 to 1 normalized time
  joints: Record<string, JointTransform>
}

export interface JointTransform {
  rotation?: { x?: number; y?: number; z?: number }
  position?: { x?: number; y?: number; z?: number }
}

export class MovementLibrary {
  private static movements: Map<string, Movement> = new Map()
  static {
    // Initialize with basic movements
    this.registerMovement('idle', {
      name: 'idle',
      duration: 4,
      loop: true,
      keyframes: [
        {
          time: 0,
          joints: {
            spine: { rotation: { x: 0, y: 0, z: 0 } },
            chest: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
        {
          time: 0.5,
          joints: {
            spine: { rotation: { x: 0.02, y: 0, z: 0 } },
            chest: { rotation: { x: 0.01, y: 0, z: 0 } },
          },
        },
        {
          time: 1,
          joints: {
            spine: { rotation: { x: 0, y: 0, z: 0 } },
            chest: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
      ],
    })

    this.registerMovement('wave', {
      name: 'wave',
      duration: 2,
      loop: false,
      keyframes: [
        {
          time: 0,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.2 } },
            rightLowerArm: { rotation: { x: 0, y: -0.3, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
        {
          time: 0.25,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.8 } },
            rightLowerArm: { rotation: { x: 0, y: -0.5, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: -0.3 } },
          },
        },
        {
          time: 0.5,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.8 } },
            rightLowerArm: { rotation: { x: 0, y: -0.5, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: 0.3 } },
          },
        },
        {
          time: 0.75,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.8 } },
            rightLowerArm: { rotation: { x: 0, y: -0.5, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: -0.3 } },
          },
        },
        {
          time: 1,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: 0 } },
            rightLowerArm: { rotation: { x: 0, y: 0, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
      ],
    })

    this.registerMovement('walk', {
      name: 'walk',
      duration: 1.5,
      loop: true,
      keyframes: [
        {
          time: 0,
          joints: {
            leftUpperLeg: { rotation: { x: 0.3, y: 0, z: 0 } },
            leftLowerLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            rightLowerLeg: { rotation: { x: 0, y: 0, z: 0 } },
            leftUpperArm: { rotation: { x: -0.2, y: 0, z: 0 } },
            rightUpperArm: { rotation: { x: 0.2, y: 0, z: 0 } },
            spine: { rotation: { x: 0.05, y: 0, z: 0 } },
          },
        },
        {
          time: 0.5,
          joints: {
            leftUpperLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            leftLowerLeg: { rotation: { x: 0, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: 0.3, y: 0, z: 0 } },
            rightLowerLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            leftUpperArm: { rotation: { x: 0.2, y: 0, z: 0 } },
            rightUpperArm: { rotation: { x: -0.2, y: 0, z: 0 } },
            spine: { rotation: { x: 0.05, y: 0, z: 0 } },
          },
        },
        {
          time: 1,
          joints: {
            leftUpperLeg: { rotation: { x: 0.3, y: 0, z: 0 } },
            leftLowerLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: -0.3, y: 0, z: 0 } },
            rightLowerLeg: { rotation: { x: 0, y: 0, z: 0 } },
            leftUpperArm: { rotation: { x: -0.2, y: 0, z: 0 } },
            rightUpperArm: { rotation: { x: 0.2, y: 0, z: 0 } },
            spine: { rotation: { x: 0.05, y: 0, z: 0 } },
          },
        },
      ],
    })

    this.registerMovement('point', {
      name: 'point',
      duration: 1,
      loop: false,
      keyframes: [
        {
          time: 0,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.5 } },
            rightLowerArm: { rotation: { x: 0, y: 0, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
        {
          time: 1,
          joints: {
            rightUpperArm: { rotation: { x: 0, y: 0, z: -1.5 } },
            rightLowerArm: { rotation: { x: 0, y: 0, z: 0 } },
            rightHand: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
      ],
    })

    this.registerMovement('sit', {
      name: 'sit',
      duration: 1.5,
      loop: false,
      keyframes: [
        {
          time: 0,
          joints: {
            spine: { rotation: { x: 0, y: 0, z: 0 } },
            leftUpperLeg: { rotation: { x: 0, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: 0, y: 0, z: 0 } },
          },
        },
        {
          time: 0.5,
          joints: {
            spine: { rotation: { x: 0.1, y: 0, z: 0 } },
            leftUpperLeg: { rotation: { x: -1.5, y: 0, z: 0 } },
            leftLowerLeg: { rotation: { x: 1.5, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: -1.5, y: 0, z: 0 } },
            rightLowerLeg: { rotation: { x: 1.5, y: 0, z: 0 } },
            hips: { position: { y: -0.5 } },
          },
        },
        {
          time: 1,
          joints: {
            spine: { rotation: { x: 0.1, y: 0, z: 0 } },
            leftUpperLeg: { rotation: { x: -1.5, y: 0, z: 0 } },
            leftLowerLeg: { rotation: { x: 1.5, y: 0, z: 0 } },
            rightUpperLeg: { rotation: { x: -1.5, y: 0, z: 0 } },
            rightLowerLeg: { rotation: { x: 1.5, y: 0, z: 0 } },
            hips: { position: { y: -0.5 } },
          },
        },
      ],
    })
  }

  static registerMovement(name: string, movement: Movement) {
    this.movements.set(name.toLowerCase(), movement)
  }

  static getMovement(name: string): Movement | undefined {
    return this.movements.get(name.toLowerCase())
  }

  static getAllMovementNames(): string[] {
    return Array.from(this.movements.keys())
  }
}

export class MovementController {
  private mixer: THREE.AnimationMixer
  private currentAction: THREE.AnimationAction | null = null
  private clock = new THREE.Clock()
  private boneMap: Map<string, THREE.Bone> = new Map()
  private isPlaying = false
  private paused = false

  constructor(private model: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(model)
    this.mapBones()
  }

  private mapBones() {
    const foundBones: { original: string; mapped: string }[] = []

    this.model.traverse(child => {
      if (child instanceof THREE.Bone) {
        const name = child.name
        
        // Map Mixamo bones - they use "mixamorig" prefix with numbers
        if (name.toLowerCase().includes('mixamorig')) {
          // Remove the mixamorig prefix and number for cleaner mapping
          const cleanName = name.replace(/mixamorig\d*/i, '')
          
          // Core bones
          if (cleanName === 'Hips') {
            this.boneMap.set('hips', child)
            foundBones.push({ original: name, mapped: 'hips' })
          }
          if (cleanName === 'Spine') {
            this.boneMap.set('spine', child)
            foundBones.push({ original: name, mapped: 'spine' })
          }
          if (cleanName === 'Spine1') {
            this.boneMap.set('spine1', child)
            foundBones.push({ original: name, mapped: 'spine1' })
          }
          if (cleanName === 'Spine2') {
            this.boneMap.set('chest', child)
            foundBones.push({ original: name, mapped: 'chest' })
          }
          if (cleanName === 'Neck') {
            this.boneMap.set('neck', child)
            foundBones.push({ original: name, mapped: 'neck' })
          }
          if (cleanName === 'Head') {
            this.boneMap.set('head', child)
            foundBones.push({ original: name, mapped: 'head' })
          }
          
          // Left arm
          if (cleanName === 'LeftShoulder') {
            this.boneMap.set('leftShoulder', child)
            foundBones.push({ original: name, mapped: 'leftShoulder' })
          }
          if (cleanName === 'LeftArm') {
            this.boneMap.set('leftUpperArm', child)
            foundBones.push({ original: name, mapped: 'leftUpperArm' })
          }
          if (cleanName === 'LeftForeArm') {
            this.boneMap.set('leftLowerArm', child)
            foundBones.push({ original: name, mapped: 'leftLowerArm' })
          }
          if (cleanName === 'LeftHand') {
            this.boneMap.set('leftHand', child)
            foundBones.push({ original: name, mapped: 'leftHand' })
          }
          
          // Right arm
          if (cleanName === 'RightShoulder') {
            this.boneMap.set('rightShoulder', child)
            foundBones.push({ original: name, mapped: 'rightShoulder' })
          }
          if (cleanName === 'RightArm') {
            this.boneMap.set('rightUpperArm', child)
            foundBones.push({ original: name, mapped: 'rightUpperArm' })
          }
          if (cleanName === 'RightForeArm') {
            this.boneMap.set('rightLowerArm', child)
            foundBones.push({ original: name, mapped: 'rightLowerArm' })
          }
          if (cleanName === 'RightHand') {
            this.boneMap.set('rightHand', child)
            foundBones.push({ original: name, mapped: 'rightHand' })
          }
          
          // Left leg
          if (cleanName === 'LeftUpLeg') {
            this.boneMap.set('leftUpperLeg', child)
            foundBones.push({ original: name, mapped: 'leftUpperLeg' })
          }
          if (cleanName === 'LeftLeg') {
            this.boneMap.set('leftLowerLeg', child)
            foundBones.push({ original: name, mapped: 'leftLowerLeg' })
          }
          if (cleanName === 'LeftFoot') {
            this.boneMap.set('leftFoot', child)
            foundBones.push({ original: name, mapped: 'leftFoot' })
          }
          
          // Right leg
          if (cleanName === 'RightUpLeg') {
            this.boneMap.set('rightUpperLeg', child)
            foundBones.push({ original: name, mapped: 'rightUpperLeg' })
          }
          if (cleanName === 'RightLeg') {
            this.boneMap.set('rightLowerLeg', child)
            foundBones.push({ original: name, mapped: 'rightLowerLeg' })
          }
          if (cleanName === 'RightFoot') {
            this.boneMap.set('rightFoot', child)
            foundBones.push({ original: name, mapped: 'rightFoot' })
          }
        }
      }
    })
    
    // debug logs removed
  }

  playMovement(
    movementName: string,
    options?: {
      fadeIn?: number
      fadeOut?: number
      onComplete?: () => void
    }
  ) {
    // debug logs removed
    
    const movement = MovementLibrary.getMovement(movementName)
    if (!movement) {
      animationError('Movement not found', { movementName })
      return
    }

    const clip = this.createAnimationClip(movement)
    // debug logs removed
    
    if (clip.tracks.length === 0) {
      animationError('No animation tracks generated for clip', { movementName: movement.name })
      return
    }
    
    const action = this.mixer.clipAction(clip)
    
    if (movement.loop) {
      action.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
    }

    if (this.currentAction && this.currentAction !== action) {
      // debug logs removed
      this.currentAction.fadeOut(options?.fadeOut ?? 0.5)
    }

    action.reset()
    action.fadeIn(options?.fadeIn ?? 0.5)
    action.play()
    
    this.currentAction = action
    this.isPlaying = true
    // debug logs removed

    if (options?.onComplete && !movement.loop) {
      const handler = () => {
        // debug logs removed
        options.onComplete?.()
        this.mixer.removeEventListener('finished', handler)
      }
      this.mixer.addEventListener('finished', handler)
    }
  }

  private createAnimationClip(movement: Movement): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = []

    // Collect all joint names from all keyframes
    const allJoints = new Set<string>()
    movement.keyframes.forEach(kf => {
      Object.keys(kf.joints).forEach(joint => allJoints.add(joint))
    })

    // Create tracks for each joint
    allJoints.forEach(jointName => {
      const bone = this.boneMap.get(jointName)
      if (!bone) {
        animationWarn('Bone not found for joint', { jointName })
        return
      }

      const times: number[] = []
      const rotationValues: number[] = []
      const positionValues: number[] = []
      let hasRotation = false
      let hasPosition = false

      movement.keyframes.forEach(kf => {
        const transform = kf.joints[jointName]
        times.push(kf.time * movement.duration)

        if (transform) {
          if (transform.rotation) {
            hasRotation = true
            // Create quaternion from Euler angles - make rotations more pronounced
            const euler = new THREE.Euler(
              (transform.rotation.x ?? 0) * 2, // Amplify rotations
              (transform.rotation.y ?? 0) * 2,
              (transform.rotation.z ?? 0) * 2,
              'XYZ'
            )
            const quaternion = new THREE.Quaternion().setFromEuler(euler)
            rotationValues.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
          } else {
            // Default quaternion (no rotation)
            rotationValues.push(0, 0, 0, 1)
          }

          if (transform.position) {
            hasPosition = true
            positionValues.push(
              (transform.position.x ?? 0) * 10, // Amplify position changes
              (transform.position.y ?? 0) * 10,
              (transform.position.z ?? 0) * 10
            )
          } else {
            positionValues.push(bone.position.x, bone.position.y, bone.position.z)
          }
        } else {
          rotationValues.push(0, 0, 0, 1)
          positionValues.push(bone.position.x, bone.position.y, bone.position.z)
        }
      })

      // CRITICAL FIX: Use the actual bone name, not the mapped name
      const boneName = bone.name // This should be like "mixamorig1RightArm"
      
      if (hasRotation) {
        animationDebug('Creating rotation track for bone', boneName)
        tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, rotationValues))
      }

      if (hasPosition && (jointName === 'hips' || jointName === 'root')) {
        // Only apply position to root/hips to avoid breaking the rig
        animationDebug('Creating position track for bone', boneName)
        tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.position`, times, positionValues))
      }
    })

    if (tracks.length === 0) {
      animationWarn('No animation tracks created for movement', movement.name)
    } else {
      animationDebug('Created animation tracks for movement', {
        movementName: movement.name,
        trackCount: tracks.length,
      })
    }

    return new THREE.AnimationClip(movement.name, movement.duration, tracks)
  }

  update() {
    if (this.paused) return
    const delta = this.clock.getDelta()
    if (delta > 0) {
      this.mixer.update(delta)
    }
  }

  stop() {
  animationDebug('Stopping animation playback')
    if (this.currentAction) {
      this.currentAction.stop()
      this.currentAction = null
      this.isPlaying = false
    }
  }

  // Debug method
  getDebugInfo() {
    return {
      isPlaying: this.isPlaying,
      currentAction: this.currentAction ? this.currentAction.getClip().name : 'none',
      mixerTime: this.mixer.time,
      boneCount: this.boneMap.size,
    }
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }
}
