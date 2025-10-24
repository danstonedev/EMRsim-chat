import { useState, useEffect } from 'react'
import { api } from '../api'
import { featureFlags } from '../flags'
import { PersonaLite, ScenarioLite } from '../../pages/chatShared'

export interface RuntimeFeatures {
  voiceEnabled: boolean
  spsEnabled: boolean
  voiceDebug: boolean
}

export interface BackendHealth {
  ok: boolean
  uptime_s: number
  db: string
  openai: 'ok' | 'err'
  features?: {
    voiceEnabled?: boolean
    spsEnabled?: boolean
    voiceDebug?: boolean
  }
}

/**
 * Fetches and manages backend data including personas, scenarios, health status,
 * and runtime feature flags from the server.
 */
export function useBackendData() {
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [scenarios, setScenarios] = useState<ScenarioLite[]>([])
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [runtimeFeatures, setRuntimeFeatures] = useState<RuntimeFeatures>(() => ({
    voiceEnabled: featureFlags.voiceEnabled,
    spsEnabled: featureFlags.spsEnabled,
    voiceDebug: featureFlags.voiceDebug,
  }))

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      api.getSpsPersonas(),
      api.getSpsScenarios(),
      api.getHealth()
    ])
      .then(results => {
        if (cancelled) return
        const [personasRes, scenariosRes, healthRes] = results

        // Process personas
        if (personasRes.status === 'fulfilled') {
          setPersonas(personasRes.value.map(p => ({
            id: p.id,
            display_name: p.display_name ?? p.id,
            headline: p.headline ?? null,
            age: typeof p.age === 'number' ? p.age : null,
            sex: typeof p.sex === 'string' ? p.sex : null,
            voice: typeof p.voice === 'string' && p.voice.trim() ? p.voice.trim() : null,
            tags: Array.isArray(p.tags)
              ? p.tags
                  .filter((tag: unknown): tag is string =>
                    typeof tag === 'string' && tag.trim().length > 0
                  )
                  .map(tag => tag.trim())
              : [],
          })))
        } else {
          setPersonas([])
        }

        // Process scenarios
        if (scenariosRes.status === 'fulfilled') {
          const raw = Array.isArray(scenariosRes.value) ? scenariosRes.value : []
          setScenarios(raw.map((s: any) => ({
            scenario_id: s.scenario_id,
            student_case_id: typeof s.student_case_id === 'string' ? s.student_case_id : null,
            title: s.title,
            region: s.region ?? null,
            difficulty: s.difficulty ?? null,
            setting: s.setting ?? null,
            tags: Array.isArray(s.tags) ? s.tags : [],
            persona_id: s.persona_id ?? null,
            persona_name: s.persona_name ?? null,
            persona_headline: s.persona_headline ?? null,
            suggested_personas: Array.isArray(s.suggested_personas) ? s.suggested_personas : undefined,
          })))
        } else {
          setScenarios([])
        }

        // Process health and feature flags
        if (healthRes.status === 'fulfilled') {
          const healthPayload = healthRes.value
          setHealth(healthPayload)
          setBackendOk(true)
          const features = healthPayload.features ?? {}
          setRuntimeFeatures(() => ({
            voiceEnabled: features.voiceEnabled ?? featureFlags.voiceEnabled,
            spsEnabled: features.spsEnabled ?? featureFlags.spsEnabled,
            voiceDebug: features.voiceDebug ?? featureFlags.voiceDebug,
          }))
        } else {
          setBackendOk(false)
          setRuntimeFeatures(prev => ({
            voiceEnabled: false,
            spsEnabled: false,
            voiceDebug: prev.voiceDebug,
          }))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendOk(false)
          setPersonas([])
          setScenarios([])
          setRuntimeFeatures(prev => ({
            voiceEnabled: false,
            spsEnabled: false,
            voiceDebug: prev.voiceDebug,
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    personas,
    scenarios,
    backendOk,
    health,
    runtimeFeatures,
  }
}
