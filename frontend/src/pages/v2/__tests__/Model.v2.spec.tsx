import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'

// Note: We do not mock 'three' here; a lightweight global mock is provided via Vite resolve.alias in vitest.config.ts

vi.mock('../manifest', () => ({
  MODEL: { baseModelPath: '/models/base.glb', scale: 1 },
  ANIMATIONS: [
    { id: 'Walk.glb', path: 'Walk.glb', loop: 'repeat', speed: 1 },
    { id: 'Jump.glb', path: 'Jump.glb', loop: 'once', speed: 1 },
  ],
  pickDefaultId: (ids: string[]) => (ids.includes('Walk.glb') ? 'Walk.glb' : ids[0]),
  DEFAULT_ANIMATION_ID: 'Walk.glb',
}))

// NOTE: Import the component AFTER all mocks to avoid loading real three/fiber/drei

// Mock @react-three/drei: useGLTF and useAnimations
vi.mock('@react-three/drei', () => {
  const createSceneStub = () => ({
    traverse: (fn: (o: any) => void) => {
      // no skinned meshes or bones in stub
      try { if (typeof fn === 'function') fn({}) } catch { /* noop */ }
    },
  })

  type FakeAction = {
    name: string
    paused: boolean
    time: number
    _running: boolean
    _playCalls: number
    _stopCalls: number
    _propertyBindings?: unknown[]
  weight?: number
  timeScale?: number
    reset: () => FakeAction
    play: () => FakeAction
    stop: () => FakeAction
    isRunning: () => boolean
    getEffectiveWeight: () => number
    setEffectiveWeight: (w: number) => FakeAction
    setEffectiveTimeScale: (s: number) => FakeAction
    setLoop: (mode: number, repetitions: number) => FakeAction
  }

  const makeAction = (name: string): FakeAction => ({
    name,
    paused: false,
    time: 0,
    _running: false,
    _playCalls: 0,
    _stopCalls: 0,
    _propertyBindings: [{}],
    reset() { this.time = 0; return this },
    play() { this._running = true; this._playCalls++; return this },
    stop() { this._running = false; this._stopCalls++; return this },
    isRunning() { return this._running },
    getEffectiveWeight() { return 1 },
    setEffectiveWeight(w: number) { this.weight = w; return this },
    setEffectiveTimeScale(s: number) { this.timeScale = s; return this },
    setLoop() { return this },
  })

  const __mockState: any = {
    lastActions: {} as Record<string, FakeAction>,
    lastNames: [] as string[],
    listeners: { finished: [] as Array<(...args: any[]) => void> },
  }

  const __actionRegistry: Record<string, FakeAction> = {}
  const __actionsMap: Record<string, FakeAction> = {}
  const __resetRegistry = () => {
    for (const k of Object.keys(__actionRegistry)) delete __actionRegistry[k]
    for (const k of Object.keys(__actionsMap)) delete __actionsMap[k]
    __mockState.lastActions = {}
    __mockState.lastNames = []
    __mockState.listeners = { finished: [] as Array<(...args: any[]) => void> }
  }

  function useGLTF() {
    // Base model: no embedded animations (we test external orchestration)
    const scene = createSceneStub()
    return { scene, animations: [] as any[] }
  }

  function useAnimations(anims: any[]) {
    const actions: Record<string, any> = __actionsMap
    const names = (anims as Array<{ name: string }>).map(a => a.name)
    for (const n of names) {
      actions[n] = __actionRegistry[n] || (__actionRegistry[n] = makeAction(n))
    }
    __mockState.lastActions = actions
    __mockState.lastNames = names
    const mixer = {
      update: vi.fn(),
      addEventListener: vi.fn((evt: string, cb: (...args: any[]) => void) => {
        if (!__mockState.listeners[evt]) __mockState.listeners[evt] = []
        __mockState.listeners[evt].push(cb)
      }),
      removeEventListener: vi.fn((evt: string, cb: (...args: any[]) => void) => {
        if (!__mockState.listeners[evt]) return
        __mockState.listeners[evt] = __mockState.listeners[evt].filter((f: (...args: any[]) => void) => f !== cb)
      }),
    }
    return { actions, names, mixer }
  }

  function Html() { return React.createElement('div', null) }

  ;(useGLTF as any).preload = vi.fn()

  return { useGLTF, useAnimations, Html, __mockState, __resetRegistry }
})

// Mock @react-three/fiber: provide minimal APIs without importing the real module to avoid pulling in Three.js
vi.mock('@react-three/fiber', () => {
  const createSceneStub = () => ({
    traverse: (fn: (o: any) => void) => { try { if (typeof fn === 'function') fn({}) } catch { /* noop */ } },
  })
  function useLoader(_Loader: any, input: string | string[]) {
    const makeClip = (name: string) => ({ name }) as any
    const mk = (url: string) => {
      const scene = createSceneStub()
      let animations: any[] = []
      if (url.includes('Walk.glb')) animations = [makeClip('clip0')]
      else if (url.includes('Jump.glb')) animations = [makeClip('clip0')]
      return { scene, animations }
    }
    if (Array.isArray(input)) return (input as string[]).map(mk)
    return mk(input as string)
  }
  const useFrame = () => { /* no-op */ }
  // Export a minimal subset used by the component/tests
  return { useLoader, useFrame }
})

// Stub useModelClips to avoid relying on useThree()/Canvas in tests
vi.mock('../useModelClips', () => {
  const makeClip = (name: string) => ({ name })
  const createSceneStub = () => ({
    traverse: (fn: (o: any) => void) => { try { if (typeof fn === 'function') fn({}) } catch { /* noop */ } },
  })
  return {
    useRetargetedClips: (_scene: any, animations: any[]) => {
      const clips = animations.map((a: any) => makeClip(a.id))
      return { clips, gltfs: animations.map(() => ({ scene: createSceneStub(), animations: [] })) }
    },
  }
})

import * as DreiMock from '@react-three/drei'
import Model from '../Model'

async function flush() {
  await act(async () => { await Promise.resolve() })
}

describe('v2 Model animation orchestration', () => {
  beforeEach(() => {
    ;(DreiMock as any).__resetRegistry?.()
  })

  it('selects default repeat clip (Walk.glb), supports pause/resume without extra play, and falls back after Jump finishes', async () => {
    const onActiveChange = vi.fn()
    const { rerender } = render(<Model isAnimating={true} onActiveChange={onActiveChange} />)
    await flush()

  const actions1 = (DreiMock as any).__mockState.lastActions
  // With lazy binding, only the default ('Walk.glb') is bound initially
  expect(Object.keys(actions1)).toContain('Walk.glb')
  expect(Object.keys(actions1)).not.toContain('Jump.glb')
    const walk = actions1['Walk.glb']
    expect(walk._playCalls).toBe(1)
    expect(walk.paused).toBe(false)
    expect(onActiveChange).toHaveBeenCalledWith('Walk.glb')

    // pause
    rerender(<Model isAnimating={false} onActiveChange={onActiveChange} />)
    await flush()
    const walkPaused = (DreiMock as any).__mockState.lastActions['Walk.glb']
    expect(walkPaused.paused).toBe(true)

    // resume: no extra play if still running
    rerender(<Model isAnimating={true} onActiveChange={onActiveChange} />)
    await flush()
    const walkResumed = (DreiMock as any).__mockState.lastActions['Walk.glb']
    expect(walkResumed.paused).toBe(false)
    expect(walkResumed._playCalls).toBe(1)

    // switch to Jump
    rerender(<Model isAnimating={true} requestedId="Jump.glb" onActiveChange={onActiveChange} />)
    await flush()
    const st = (DreiMock as any).__mockState
    const jump = st.lastActions['Jump.glb']
    expect(jump._playCalls).toBe(1)

    // simulate finished event → should fall back to Walk
  ;(st.listeners.finished as Array<(...args: any[]) => void>).forEach((cb) => cb())
    await flush()
    const actionsAfter = (DreiMock as any).__mockState.lastActions
    expect(actionsAfter['Walk.glb']._playCalls).toBeGreaterThanOrEqual(2)
  })
})
