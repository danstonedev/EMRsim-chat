import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { GLTFLoader, KTX2Loader } from 'three-stdlib'
import * as THREE from 'three'
import { extendGLTFLoader } from '../loaderConfig'

// Smoke test: calling extender should not throw in node/jsdom

describe('extendGLTFLoader', () => {
  beforeEach(() => {
    vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw without decoders present', () => {
    const loader = new GLTFLoader()
    const canvas = globalThis.document?.createElement('canvas') as HTMLCanvasElement
    const fakeRenderer = {
      domElement: canvas,
    } as unknown as THREE.WebGLRenderer
    expect(() => extendGLTFLoader(loader, fakeRenderer)).not.toThrow()
  })
})
