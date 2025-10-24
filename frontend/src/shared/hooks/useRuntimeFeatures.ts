import { useEffect, useState } from 'react'
import { api } from '../api'
import { featureFlags } from '../flags'
import type { RuntimeFeatures } from './useBackendData'

const buildInitialState = (): RuntimeFeatures => ({
  voiceEnabled: featureFlags.voiceEnabled,
  spsEnabled: featureFlags.spsEnabled,
  voiceDebug: featureFlags.voiceDebug,
})

/**
 * Lightweight helper for components that only need runtime feature flags.
 * Falls back to build-time featureFlags until the backend health endpoint responds.
 */
export function useRuntimeFeatures(): RuntimeFeatures {
  const [features, setFeatures] = useState<RuntimeFeatures>(() => buildInitialState())

  useEffect(() => {
    let cancelled = false

  const load = async () => {
      try {
        const health = await api.getHealth()
        if (cancelled) return
        const runtime = health.features ?? {}
        setFeatures(prev => ({
          voiceEnabled: runtime.voiceEnabled ?? prev.voiceEnabled,
          spsEnabled: runtime.spsEnabled ?? prev.spsEnabled,
          voiceDebug: runtime.voiceDebug ?? prev.voiceDebug,
        }))
      } catch {
        if (cancelled) return
        // Disable voice/SPS features when health endpoint is unreachable.
        setFeatures(prev => ({
          voiceEnabled: false,
          spsEnabled: false,
          voiceDebug: prev.voiceDebug,
        }))
      }
    }

  void load()

    return () => {
      cancelled = true
    }
  }, [])

  return features
}
