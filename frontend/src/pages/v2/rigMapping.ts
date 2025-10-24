import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

export function findFirstSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null
  root.traverse((o) => { if (!found && (o as any).isSkinnedMesh) found = o as THREE.SkinnedMesh })
  return found
}

export function collectTargetNames(root: THREE.Object3D): Set<string> {
  const set = new Set<string>()
  root.traverse((o) => { if (o.name) set.add(o.name) })
  return set
}

export function splitHead(trackName: string): string {
  const dot = trackName.indexOf('.')
  return dot >= 0 ? trackName.slice(0, dot) : trackName
}

function norm(s: string) { return s.replace(/[|:/]/g, '').toLowerCase() }

export function findBestTarget(sourceNode: string, targetNames: Set<string>): string | null {
  const s = norm(sourceNode)
  let best: string | null = null
  let bestScore = -1
  targetNames.forEach((t) => {
    const tn = norm(t)
    const maxLen = Math.min(s.length, tn.length)
    let k = 0
    while (k < maxLen && s[s.length - 1 - k] === tn[tn.length - 1 - k]) k++
    if (k > bestScore) { bestScore = k; best = t }
  })
  return best
}

export function retargetClipToTarget(
  targetRoot: THREE.Object3D,
  sourceRoot: THREE.Object3D | null,
  srcClip: THREE.AnimationClip,
): THREE.AnimationClip | null {
  const targetSkinned = findFirstSkinnedMesh(targetRoot)
  const sourceSkinned = sourceRoot ? findFirstSkinnedMesh(sourceRoot) : null
  // Only attempt retargeting when both sides have a skeleton
  if (targetSkinned && sourceSkinned) {
    const fn = (SkeletonUtils as any).retargetClip as
      | ((target: THREE.Object3D, source: THREE.Object3D, clip: THREE.AnimationClip) => THREE.AnimationClip)
      | undefined
    if (typeof fn === 'function') {
      const out = fn(targetRoot, sourceSkinned as unknown as THREE.Object3D, srcClip)
      return (out ?? null) as THREE.AnimationClip | null
    }
  }
  return null
}

export function remapTracksByName(
  scene: THREE.Object3D,
  srcClip: THREE.AnimationClip,
): THREE.AnimationClip {
  // Compute target name set once for this scene; traversal can be expensive on large rigs
  const targetNames = collectTargetNames(scene)
  const remappedTracks = new Array(srcClip.tracks.length)
  for (let i = 0; i < srcClip.tracks.length; i++) {
    const t = srcClip.tracks[i]
    const head = splitHead(t.name)
    const suffix = t.name.slice(head.length)
    const mapped = findBestTarget(head, targetNames)
    if (mapped && mapped !== head) {
      const nt = t.clone()
      ;(nt as any).name = `${mapped}${suffix}`
      remappedTracks[i] = nt
    } else {
      remappedTracks[i] = t
    }
  }
  const remapClip = srcClip.clone()
  ;(remapClip as any).tracks = remappedTracks
  return remapClip
}
