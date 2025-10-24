const coerceString = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
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
    return { ...(nodeEnv as Record<string, unknown>), ...(metaEnv as Record<string, unknown>) }
  }
  return { ...(metaEnv as Record<string, unknown>) }
}

const getRuntimeOverrides = (): Partial<FeatureFlagConfig> => {
  if (typeof window === 'undefined') return {}
  const win = window as any

  const overrides = win.__SPS_RUNTIME_FEATURE_OVERRIDES__
  if (overrides && typeof overrides === 'object') {
    return { ...overrides } as Partial<FeatureFlagConfig>
  }

  // Legacy support: allow __APP_FEATURE_FLAGS__ as a fallback for a minimal subset
  // This preserves older integrations that set window.__APP_FEATURE_FLAGS__.
  // Prefer __SPS_RUNTIME_FEATURE_OVERRIDES__ going forward.
  const legacy = win.__APP_FEATURE_FLAGS__
  if (legacy && typeof legacy === 'object') {
    // Map known legacy keys to the new config shape safely
    const mapped: Partial<FeatureFlagConfig> = {}

    try {
      // Common legacy flags
      if ('VOICE_ENABLED' in legacy) mapped.voiceEnabled = Boolean(legacy.VOICE_ENABLED)
      if ('VOICE_AUTOSTART' in legacy) mapped.voiceAutostart = Boolean(legacy.VOICE_AUTOSTART)
      if ('BANNERS_ENABLED' in legacy) mapped.bannersEnabled = Boolean(legacy.BANNERS_ENABLED)

      // Best-effort extras if present
      if ('SPS_ENABLED' in legacy) mapped.spsEnabled = Boolean(legacy.SPS_ENABLED)
      if ('VOICE_DEBUG' in legacy) mapped.voiceDebug = Boolean(legacy.VOICE_DEBUG)
      if ('CHAT_ANIMATIONS_ENABLED' in legacy) mapped.chatAnimationsEnabled = Boolean(legacy.CHAT_ANIMATIONS_ENABLED)
      if ('STT_FALLBACK_MS' in legacy) {
        const n = Number(legacy.STT_FALLBACK_MS)
        if (Number.isFinite(n) && n >= 0) mapped.sttFallbackMs = n
      }
      if ('STT_EXTENDED_MS' in legacy) {
        const n = Number(legacy.STT_EXTENDED_MS)
        if (Number.isFinite(n) && n >= 0) mapped.sttExtendedMs = n
      }
    } catch {
      // If mapping fails, fall back to empty to avoid breaking runtime
    }

    if (import.meta.env?.DEV) {
      console.warn('[flags] Using legacy __APP_FEATURE_FLAGS__ overrides. Prefer __SPS_RUNTIME_FEATURE_OVERRIDES__ going forward.', legacy)
    }

    return mapped
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
  chatAnimationsEnabled: boolean
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
  // Default ON in dev for easier QA unless explicitly disabled via env/override
  const chatAnimationsEnabled = toBool(
    read('VITE_CHAT_ANIMATIONS_ENABLED'),
    ((import.meta as any)?.env?.DEV ? true : false)
  )

  const base: FeatureFlags = {
    voiceEnabled,
    spsEnabled,
    sttFallbackMs,
    sttExtendedMs,
    voiceDebug,
    voiceAutostart,
    bannersEnabled,
    chatAnimationsEnabled,
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
