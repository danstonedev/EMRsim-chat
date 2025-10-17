import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { pickSourceClip } from '../clipSelection'

function clip(name: string) { return new THREE.AnimationClip(name, 1, []) }

describe('pickSourceClip', () => {
  it('prefers explicit name', () => {
    const chosen = pickSourceClip({ id: 'Kick.glb', clipName: 'Run' }, [clip('Idle'), clip('Run')])
    expect(chosen?.name).toBe('Run')
  })
  it('falls back to explicit index', () => {
    const chosen = pickSourceClip({ id: 'Kick.glb', clipIndex: 1 }, [clip('A'), clip('B')])
    expect(chosen?.name).toBe('B')
  })
  it('then uses stem contains', () => {
    const chosen = pickSourceClip({ id: 'Kick.glb' }, [clip('SomeKickMotion'), clip('Idle')])
    expect(chosen?.name).toBe('SomeKickMotion')
  })
  it('finally falls back to first', () => {
    const chosen = pickSourceClip({ id: 'Foo.glb' }, [clip('A'), clip('B')])
    expect(chosen?.name).toBe('A')
  })
})
