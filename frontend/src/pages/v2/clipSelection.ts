import * as THREE from 'three'

export type ClipPickSpec = {
  id: string
  clipName?: string
  clipIndex?: number
}

export function pickSourceClip(spec: ClipPickSpec, clips: THREE.AnimationClip[] | undefined): THREE.AnimationClip | null {
  if (!clips || clips.length === 0) return null
  // Prefer explicit name
  if (spec.clipName) {
    const c = clips.find(c => c.name === spec.clipName || c.name.toLowerCase().includes(spec.clipName!.toLowerCase()))
    if (c) return c
  }
  // Prefer explicit index
  if (typeof spec.clipIndex === 'number' && spec.clipIndex >= 0 && spec.clipIndex < clips.length) {
    return clips[spec.clipIndex]
  }
  // Heuristic: prefer a clip whose name includes the file/id stem (e.g., "Kick", "Swim")
  const stem = (spec.id || '').replace(/\.[^/.]+$/, '')
  const byStem = clips.find(c => c.name.toLowerCase().includes(stem.toLowerCase()))
  if (byStem) return byStem
  // Fallback: first clip
  return clips[0]
}

export function applyRestPoseFromSource(
  targetScene: THREE.Object3D,
  sourceRoot: THREE.Object3D | null,
  SkeletonUtilsLike: { retarget?: (target: THREE.Object3D, source: THREE.Object3D, opts?: any) => void }
): boolean {
  if (!sourceRoot) return false
  let hasBones = false
  sourceRoot.traverse((o) => { if ((o as any).isBone) hasBones = true })
  if (!hasBones) return false
  let targetSkinned: THREE.SkinnedMesh | null = null
  targetScene.traverse((o) => { if (!targetSkinned && (o as any).isSkinnedMesh) targetSkinned = o as THREE.SkinnedMesh })
  if (!targetSkinned) return false
  try {
    SkeletonUtilsLike.retarget?.(targetSkinned, sourceRoot, { preservePosition: true })
    return true
  } catch { return false }
}
