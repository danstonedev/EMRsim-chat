import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { buildFeatureFlags } from './flags'

type EnvKey = 'VITE_VOICE_ENABLED' | 'VITE_SPS_ENABLED' | 'VITE_VOICE_DEBUG'

const keys: EnvKey[] = ['VITE_VOICE_ENABLED', 'VITE_SPS_ENABLED', 'VITE_VOICE_DEBUG']
const processEnv = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined
const originalProcessEnv: Partial<Record<EnvKey, string | undefined>> = {}
const originalImportMetaEnv: Partial<Record<EnvKey, string | undefined>> = {}
let originalRuntimeOverrides: any

beforeEach(() => {
  originalRuntimeOverrides = (globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__
  keys.forEach(key => {
    originalProcessEnv[key] = processEnv?.[key]
    if (processEnv) delete processEnv[key]

    originalImportMetaEnv[key] = (import.meta as any)?.env?.[key]
    if ((import.meta as any)?.env) delete (import.meta as any).env[key]
  })
  delete (globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__
})

afterEach(() => {
  keys.forEach(key => {
    if (processEnv) {
      const prevProc = originalProcessEnv[key]
      if (typeof prevProc === 'string') processEnv[key] = prevProc
      else delete processEnv[key]
    }

    if ((import.meta as any)?.env) {
      const prevImport = originalImportMetaEnv[key]
      if (typeof prevImport === 'string') (import.meta as any).env[key] = prevImport
      else delete (import.meta as any).env[key]
    }
  })

  if (originalRuntimeOverrides === undefined) {
    delete (globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__
  } else {
    (globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__ = originalRuntimeOverrides
  }
})

describe('buildFeatureFlags', () => {
  it('coerces environment values into booleans', () => {
    if (processEnv) {
      processEnv.VITE_VOICE_ENABLED = 'false'
      processEnv.VITE_SPS_ENABLED = '1'
      processEnv.VITE_VOICE_DEBUG = ''
    }
    if ((import.meta as any)?.env) {
      Object.assign((import.meta as any).env, {
        VITE_VOICE_ENABLED: 'false',
        VITE_SPS_ENABLED: '1',
        VITE_VOICE_DEBUG: '0',
      })
    }

    const flags = buildFeatureFlags()
    expect(flags.voiceEnabled).toBe(false)
    expect(flags.spsEnabled).toBe(true)
    expect(flags.voiceDebug).toBe(false)
    expect(Object.isFrozen(flags)).toBe(true)
  })

  it('applies runtime overrides from window when present', () => {
    if (processEnv) {
      processEnv.VITE_VOICE_ENABLED = '0'
      processEnv.VITE_VOICE_DEBUG = '0'
    }
    if ((import.meta as any)?.env) {
      Object.assign((import.meta as any).env, {
        VITE_VOICE_ENABLED: '0',
        VITE_VOICE_DEBUG: '0',
      })
    }

    ;(globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__ = {
      voiceEnabled: 'true',
      voiceDebug: 'not-valid',
      notValid: true,
    }

    const overrides = (globalThis as any).__SPS_RUNTIME_FEATURE_OVERRIDES__ as Record<string, unknown>
    const flags = buildFeatureFlags(overrides as any)
    expect(flags.voiceEnabled).toBe(true)
    expect(flags.voiceDebug).toBe(false)
    expect((flags as Record<string, unknown>).notValid).toBeUndefined()
  })

  it('honors explicit overrides passed to builder', () => {
    if (processEnv) {
      processEnv.VITE_VOICE_ENABLED = '0'
      processEnv.VITE_SPS_ENABLED = 'false'
    }
    if ((import.meta as any)?.env) {
      Object.assign((import.meta as any).env, {
        VITE_VOICE_ENABLED: '0',
        VITE_SPS_ENABLED: '0',
      })
    }

    const flags = buildFeatureFlags({ voiceEnabled: true, spsEnabled: 'yes' as any })
    expect(flags.voiceEnabled).toBe(true)
    expect(flags.spsEnabled).toBe(true)
  })
})
