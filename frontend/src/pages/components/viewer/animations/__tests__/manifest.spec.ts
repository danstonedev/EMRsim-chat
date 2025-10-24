import { describe, it, expect } from 'vitest'
import { ANIMATIONS, DEFAULT_ANIMATION_ID } from '../manifest'

// Basic contract tests for generated animation manifest
// Ensures scan-animations.mjs writes a valid list and our manifest wiring is sane.

describe('animations manifest', () => {
  it('contains unique ids and valid paths', () => {
    const ids = ANIMATIONS.map(a => a.id)
    const set = new Set(ids)
    expect(set.size).toBe(ids.length)

    for (const a of ANIMATIONS) {
      expect(a.id).toMatch(/\.glb$/i)
      expect(a.path).toMatch(/\/models\/animations\//)
      // Speed is optional, but if provided, it should be > 0
      if (a.speed !== undefined) expect(a.speed).toBeGreaterThan(0)
    }
  })

  it('includes DEFAULT_ANIMATION_ID when available in files list or gracefully allows empty catalogs', () => {
    // If there are files, DEFAULT should be present; if none, allow absence.
    if (ANIMATIONS.length > 0) {
      const hasDefault = ANIMATIONS.some(a => a.id === DEFAULT_ANIMATION_ID)
      expect(hasDefault).toBe(true)
    } else {
      // When no animations exist, ensure DEFAULT is still defined as a string
      expect(typeof DEFAULT_ANIMATION_ID).toBe('string')
    }
  })
})
