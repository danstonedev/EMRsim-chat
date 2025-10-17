import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { playAction, setPaused } from '../../../v2/mixer'
import { ANIMATIONS } from '../../../v2/manifest'

// Minimal action stub implementing used API
function makeAction() {
  const a: any = {
    _running: false,
    _time: 1.234,
    enabled: true,
    paused: false,
    weight: 1,
    timeScale: 0.5,
    clampWhenFinished: false,
    time: 0,
    reset: vi.fn(function(this: any){ this._time = 0; this.time = 0 }),
    play: vi.fn(function(this: any){ this._running = true }),
    stop: vi.fn(function(this: any){ this._running = false }),
    isRunning: vi.fn(function(this: any){ return this._running }),
    setEffectiveWeight: vi.fn(function(this: any, w: number){ this.weight = w }),
    setEffectiveTimeScale: vi.fn(function(this: any, s: number){ this.timeScale = s }),
    getEffectiveWeight: vi.fn(function(this: any){ return this.weight }),
    setLoop: vi.fn(function(this: any, _loopMode: number, _repetitions: number){ /* noop */ }),
    crossFadeTo: vi.fn(),
    getClip: vi.fn(() => new THREE.AnimationClip('X', 1, [])),
  }
  return a
}

function makeMixer() { return { update: vi.fn() } as unknown as THREE.AnimationMixer }

// Build fake actions map keyed by id
function makeActions(id: string) {
  const a = makeAction()
  const actions: Record<string, any> = { [id]: a }
  return { actions, a }
}

// Ensure manifest contains a default entry
const fallbackId = ANIMATIONS[0]?.id || 'Stand.glb'

describe('mixerController resume behavior', () => {
  beforeEach(() => {
    // nothing for now
  })

  it('correctly handles pause and resume cycle', () => {
    const { actions, a } = makeActions(fallbackId)
    const mixer = makeMixer()

    // Start once
    playAction(actions as any, mixer, fallbackId)
    expect(a.play).toHaveBeenCalled()
    expect(a.reset).toHaveBeenCalled()

    // Pause
    setPaused(a as any, true)
    expect(a.paused).toBe(true)

    // Resume via setPaused (not playAction which resets)
    setPaused(a as any, false)
    expect(a.paused).toBe(false)
    // timeScale should be restored when unpaused
    expect(a.setEffectiveTimeScale).toHaveBeenCalledWith(expect.any(Number))
  })

  it('applies animation speed from manifest on playAction', () => {
    const { actions, a } = makeActions(fallbackId)
    const mixer = makeMixer()

    // Start with default timescale from manifest
    playAction(actions as any, mixer, fallbackId)
    
    // The mixer should apply speed settings via applyLoopPolicy
    expect(a.setEffectiveTimeScale).toHaveBeenCalled()
    // Speed should be at least 0.25 (minimum enforced by mixer)
    const calls = a.setEffectiveTimeScale.mock.calls
    const lastSpeed = calls[calls.length - 1]?.[0]
    expect(lastSpeed).toBeGreaterThanOrEqual(0.25)
  })
})
