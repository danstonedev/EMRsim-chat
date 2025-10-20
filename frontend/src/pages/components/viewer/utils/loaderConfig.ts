import * as THREE from 'three'
import { GLTFLoader, DRACOLoader, KTX2Loader } from 'three-stdlib'

/**
 * Configure a GLTFLoader with optional DRACO, Meshopt, and KTX2 decoders.
 * - Expects decoder assets under public paths:
 *   - /draco/ for DRACO (draco_decoder.js/wasm)
 *   - /basis/ for KTX2 (basis_transcoder.js/wasm)
 * If those assets are absent, configuration is harmless and runtime will fall back
 * unless models actually require them.
 */
export function extendGLTFLoader(loader: GLTFLoader, gl?: THREE.WebGLRenderer | null) {
  // Meshopt optional support intentionally skipped here to avoid extra dependency.
  // If needed later, install `meshopt_decoder` and call loader.setMeshoptDecoder(MeshoptDecoder)

  // Cache decoders across calls to minimize setup overhead
  const g: any = globalThis as any
  try {
    const draco: DRACOLoader = g.__DRACO_LOADER__ || new DRACOLoader()
    if (!g.__DRACO_LOADER__) {
      draco.setDecoderPath('/draco/') // serve from public/draco
      g.__DRACO_LOADER__ = draco
    }
    loader.setDRACOLoader(draco)
  } catch {
    // DRACO not configured; proceed without it
  }

  try {
    const ktx2: KTX2Loader = g.__KTX2_LOADER__ || new KTX2Loader()
    if (!g.__KTX2_LOADER__) {
      ktx2.setTranscoderPath('/basis/') // serve from public/basis
      g.__KTX2_LOADER__ = ktx2
    }
    if (gl) {
      ktx2.detectSupport(gl)
    }
    loader.setKTX2Loader(ktx2)
  } catch {
    // KTX2 not configured; proceed without it
  }
}

export type { GLTFLoader }
