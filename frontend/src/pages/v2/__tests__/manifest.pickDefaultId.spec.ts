import { describe, it, expect } from 'vitest'
import { pickDefaultId } from '../manifest'
import { DEFAULT_ANIMATION_ID } from '../../components/viewer/animations/manifest'

describe('pickDefaultId', () => {
  it('prefers DEFAULT_ANIMATION_ID (Stand.glb) when present', () => {
    const ids = ['Walk.glb', DEFAULT_ANIMATION_ID, 'Sit.glb']
    const chosen = pickDefaultId(ids)
    expect(chosen).toBe(DEFAULT_ANIMATION_ID)
  })

  it('falls back to first provided id when none are in manifest', () => {
    const ids = ['NotInManifestA.glb', 'NotInManifestB.glb']
    const chosen = pickDefaultId(ids as any)
    expect(chosen).toBe(ids[0])
  })
})
