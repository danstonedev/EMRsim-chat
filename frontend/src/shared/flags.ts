const coerceString = (value: unknown): string | undefined => {
  if (value == null) return undefined
  return typeof value === 'string' ? value : String(value)
}

const toBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) return false
  return defaultValue
}

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue
}

type EnvSource = Record<string, unknown>

const getEnvSnapshot = (): EnvSource => {
  const metaEnv = ((import.meta as any)?.env ?? {}) as EnvSource
  const nodeEnv = (typeof globalThis !== 'undefined' && (globalThis as any)?.process?.env) || undefined
  if (nodeEnv) {
    return { ...nodeEnv, ...metaEnv }
  }
  return { ...metaEnv }
}

const getRuntimeOverrides = (): Partial<FeatureFlagConfig> => {
  if (typeof window === 'undefined') return {}
  const win = window as any

  const overrides = win.__SPS_RUNTIME_FEATURE_OVERRIDES__
  if (overrides && typeof overrides === 'object') {
    return { ...overrides } as Partial<FeatureFlagConfig>
  }

  if (import.meta.env?.DEV && win.__APP_FEATURE_FLAGS__ && typeof win.__APP_FEATURE_FLAGS__ === 'object') {
    console.warn('[flags] Ignoring legacy __APP_FEATURE_FLAGS__ override. Prefer __SPS_RUNTIME_FEATURE_OVERRIDES__ to avoid collisions.', win.__APP_FEATURE_FLAGS__)
  }

  return {}
}

const sanitizeOverrides = (
  overrides: Partial<FeatureFlagConfig> = {},
  base: FeatureFlagConfig
): Partial<FeatureFlagConfig> => {
  const clean: Partial<FeatureFlagConfig> = {}
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue
    switch (key as keyof FeatureFlagConfig) {
      case 'sttFallbackMs': {
        const numeric = typeof value === 'number' ? value : Number(coerceString(value))
        if (Number.isFinite(numeric) && numeric >= 0) clean.sttFallbackMs = numeric
        break
      }
      case 'sttExtendedMs': {
        const numeric = typeof value === 'number' ? value : Number(coerceString(value))
        if (Number.isFinite(numeric) && numeric >= 0) clean.sttExtendedMs = numeric
        break
      }
      case 'voiceEnabled': {
        const boolValue = typeof value === 'boolean' ? value : toBool(coerceString(value), base.voiceEnabled)
        clean.voiceEnabled = boolValue
        break
      }
      case 'spsEnabled': {
        const boolValue = typeof value === 'boolean' ? value : toBool(coerceString(value), base.spsEnabled)
        clean.spsEnabled = boolValue
        break
      }
      case 'voiceDebug': {
        const boolValue = typeof value === 'boolean' ? value : toBool(coerceString(value), base.voiceDebug)
        clean.voiceDebug = boolValue
        break
      }
      case 'voiceAutostart': {
        const boolValue = typeof value === 'boolean' ? value : toBool(coerceString(value), base.voiceAutostart)
        clean.voiceAutostart = boolValue
        break
      }
      case 'bannersEnabled': {
        const boolValue = typeof value === 'boolean' ? value : toBool(coerceString(value), base.bannersEnabled)
        clean.bannersEnabled = boolValue
        break
      }
      default:
        break
    }
  }
  return clean
}

type FeatureFlagConfig = {
  voiceEnabled: boolean
  spsEnabled: boolean
  sttFallbackMs: number
  sttExtendedMs: number
  voiceDebug: boolean
  voiceAutostart: boolean
  bannersEnabled: boolean
}

export type FeatureFlags = Readonly<FeatureFlagConfig>

export const buildFeatureFlags = (
  overrides: Partial<FeatureFlagConfig> = {},
  env: EnvSource = getEnvSnapshot()
): FeatureFlags => {
  const read = (key: string): string | undefined => coerceString(env[key])

  const voiceEnabled = toBool(read('VITE_VOICE_ENABLED'), false)
  const spsEnabled = toBool(read('VITE_SPS_ENABLED'), true)
  const sttFallbackMs = toNumber(read('VITE_STT_FALLBACK_MS'), 800)
  const sttExtendedMs = toNumber(read('VITE_STT_EXTENDED_MS'), Math.max(sttFallbackMs + 700, 1800))
  const voiceDebug = toBool(read('VITE_VOICE_DEBUG'), false)
  const voiceAutostart = toBool(read('VITE_VOICE_AUTOSTART'), false)
  const bannersEnabled = toBool(read('VITE_BANNERS_ENABLED'), true)

  const base: FeatureFlags = {
    voiceEnabled,
    spsEnabled,
    sttFallbackMs,
    sttExtendedMs,
    voiceDebug,
    voiceAutostart,
    bannersEnabled,
  }

  const merged = { ...base, ...sanitizeOverrides(overrides, base) }
  return Object.freeze(merged) as FeatureFlags
}

const runtimeEnv = getEnvSnapshot()
const runtimeOverrides = getRuntimeOverrides()
export const featureFlags: FeatureFlags = buildFeatureFlags(runtimeOverrides, runtimeEnv)

// Backwards-compatible export for call sites that still rely on FLAGS.*
export const FLAGS = {
  VOICE_ENABLED: featureFlags.voiceEnabled,
  VOICE_AUTOSTART: featureFlags.voiceAutostart,
  BANNERS_ENABLED: featureFlags.bannersEnabled,
} as const
