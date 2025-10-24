import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { remapTracksByName } from '../rigMapping'

describe('remapTracksByName', () => {
  it('remaps track heads to closest target names', () => {
    const scene = new THREE.Group()
    const a = new THREE.Object3D(); a.name = 'mixamorig:Hips'
    const b = new THREE.Object3D(); b.name = 'Spine'
    scene.add(a); scene.add(b)
    const clip = new THREE.AnimationClip('test', 1, [
      new THREE.NumberKeyframeTrack('Hips.position[x]', [0], [0]),
      new THREE.NumberKeyframeTrack('Spine.position[x]', [0], [0]),
    ])
    const remapped = remapTracksByName(scene, clip)
    // One track should be remapped to mixamorig:Hips, Spine stays
    const heads = new Set(remapped.tracks.map(t => t.name.split('.')[0]))
    expect(heads.has('mixamorig:Hips')).toBe(true)
    expect(heads.has('Spine')).toBe(true)
  })
})
