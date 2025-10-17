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

  try {
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/') // serve from public/draco
    loader.setDRACOLoader(draco)
  } catch {
    // DRACO not configured; proceed without it
  }

  try {
    const ktx2 = new KTX2Loader()
    ktx2.setTranscoderPath('/basis/') // serve from public/basis
    if (gl) {
      ktx2.detectSupport(gl)
    }
    loader.setKTX2Loader(ktx2)
  } catch {
    // KTX2 not configured; proceed without it
  }
}

export type { GLTFLoader }
