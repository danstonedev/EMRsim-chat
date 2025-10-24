import * as THREE from 'three'
import { animationDebug } from '../../../../shared/utils/animationLogging'

export type BoneInfo = {
  name: string
  position: THREE.Vector3
  rotation: THREE.Euler
  children: string[]
  depth: number
}

export type SkeletonInfo = {
  hasSkeleton: boolean
  boneCount: number
  bones: Map<string, BoneInfo>
  rootBones: string[]
  hierarchy: string
}

/**
 * Analyzes a 3D model to extract skeletal information
 */
export function analyzeModelSkeleton(scene: THREE.Object3D): SkeletonInfo {
  const bones = new Map<string, BoneInfo>()
  const rootBones: string[] = []
  let hasSkeleton = false

  // Find all bones in the scene
  scene.traverse(child => {
    if (child instanceof THREE.Bone) {
      hasSkeleton = true
      
      const boneInfo: BoneInfo = {
        name: child.name || `Bone_${child.id}`,
        position: child.position.clone(),
        rotation: child.rotation.clone(),
        children: child.children.filter(c => c instanceof THREE.Bone).map(c => c.name || `Bone_${c.id}`),
        depth: 0,
      }

      bones.set(boneInfo.name, boneInfo)

      // Check if this is a root bone (parent is not a bone)
      if (!child.parent || !(child.parent instanceof THREE.Bone)) {
        rootBones.push(boneInfo.name)
      }
    }
  })

  // Calculate depth for each bone
  const calculateDepth = (boneName: string, depth: number = 0): void => {
    const bone = bones.get(boneName)
    if (!bone) return

    bone.depth = depth
    bone.children.forEach(childName => calculateDepth(childName, depth + 1))
  }

  rootBones.forEach(rootName => calculateDepth(rootName))

  // Generate hierarchy string
  const hierarchy = generateHierarchyString(bones, rootBones)

  return {
    hasSkeleton,
    boneCount: bones.size,
    bones,
    rootBones,
    hierarchy,
  }
}

/**
 * Generates a visual representation of the bone hierarchy
 */
function generateHierarchyString(bones: Map<string, BoneInfo>, rootBones: string[], indent = ''): string {
  let result = ''

  const printBone = (boneName: string, currentIndent: string): void => {
    const bone = bones.get(boneName)
    if (!bone) return

    result += `${currentIndent}├─ ${bone.name}\n`

    bone.children.forEach((childName, index) => {
      const isLast = index === bone.children.length - 1
      const childIndent = currentIndent + (isLast ? '   ' : '│  ')
      printBone(childName, childIndent)
    })
  }

  rootBones.forEach(rootName => printBone(rootName, indent))

  return result
}

/**
 * Finds bones by name pattern (case-insensitive)
 */
export function findBonesByPattern(skeletonInfo: SkeletonInfo, pattern: string | RegExp): BoneInfo[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern

  return Array.from(skeletonInfo.bones.values()).filter(bone => regex.test(bone.name))
}

/**
 * Gets all bones at a specific depth level
 */
export function getBonesByDepth(skeletonInfo: SkeletonInfo, depth: number): BoneInfo[] {
  return Array.from(skeletonInfo.bones.values()).filter(bone => bone.depth === depth)
}

/**
 * Prints skeleton analysis to console (dev mode only)
 */
export function logSkeletonInfo(skeletonInfo: SkeletonInfo): void {
  if (process.env.NODE_ENV === 'production') return

  // Group bones by common patterns
  const limbBones = findBonesByPattern(skeletonInfo, /arm|leg|hand|foot/i)
  const spineBones = findBonesByPattern(skeletonInfo, /spine|back/i)
  const headBones = findBonesByPattern(skeletonInfo, /head|neck/i)
  animationDebug('Skeleton analysis snapshot', {
    hasSkeleton: skeletonInfo.hasSkeleton,
    boneCount: skeletonInfo.boneCount,
    rootBones: skeletonInfo.rootBones,
    hierarchy: skeletonInfo.hierarchy,
    limbBones: limbBones.map(b => b.name),
    spineBones: spineBones.map(b => b.name),
    headBones: headBones.map(b => b.name),
  })
}
