import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { MediaReference } from '../types'

interface ScenarioMediaAsset {
  id: string
  type: 'image' | 'video' | 'youtube'
  url: string
  thumbnail?: string
  caption?: string
  clinical_context?: string[]
}

interface UseScenarioMediaOptions {
  scenarioId: string | null
  closeMedia: () => void
}

/**
 * Custom hook to manage scenario media loading and state.
 * Fetches media library for a scenario and converts it to MediaReference format.
 * 
 * Responsibilities:
 * - Load scenario media from backend when scenarioId changes
 * - Convert ScenarioMediaAsset to MediaReference format
 * - Handle request cancellation for race conditions
 * - Cache loaded scenarios to prevent unnecessary reloads
 * - Provide loading state for UI feedback
 * 
 * Phase 2 Optimizations:
 * - Deferred state reset (only after confirming need to reload)
 * - Scenario caching (prevents reloading same scenario)
 * - Loading state tracking (prevents intermediate empty updates)
 */
export function useScenarioMedia({
  scenarioId,
  closeMedia,
}: UseScenarioMediaOptions) {
  const [scenarioMedia, setScenarioMedia] = useState<MediaReference[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const scenarioMediaRequestIdRef = useRef(0)
  const hasLoadedRef = useRef<string | null>(null)

  useEffect(() => {
    // Check if we already have this scenario loaded
    if (hasLoadedRef.current === scenarioId && scenarioMedia.length > 0) {
      if (import.meta.env.DEV) {
        console.debug('[useScenarioMedia] Using cached media for scenario:', scenarioId)
      }
      return
    }

    // Increment request ID for cancellation tracking
    const requestId = ++scenarioMediaRequestIdRef.current

    // Handle empty scenario case
    if (!scenarioId) {
      // Only reset if we had data before
      if (scenarioMedia.length > 0) {
        setScenarioMedia([])
        closeMedia()
      }
      hasLoadedRef.current = null
      setIsLoading(false)
      return
    }

    // Start loading
    setIsLoading(true)

    const loadScenarioMedia = async () => {
      try {
        const scenario = await api.getSpsScenarioById(scenarioId)
        
        // Check if request is still valid
        if (scenarioMediaRequestIdRef.current !== requestId) {
          if (import.meta.env.DEV) {
            console.debug('[useScenarioMedia] Request cancelled for scenario:', scenarioId)
          }
          return
        }

        const assets = Array.isArray(scenario?.media_library)
          ? (scenario.media_library as ScenarioMediaAsset[])
          : []

        const mapped: MediaReference[] = assets
          .filter((asset): asset is ScenarioMediaAsset => Boolean(asset && asset.id && asset.url))
          .map((asset) => {
            const normalizedType: MediaReference['type'] = 
              asset.type === 'video' ? 'video' : 
              asset.type === 'youtube' ? 'youtube' : 
              'image'
            return {
              id: asset.id,
              type: normalizedType,
              url: asset.url,
              thumbnail: asset.thumbnail || undefined,
              caption: asset.caption?.trim() || asset.clinical_context?.[0] || asset.id,
            }
          })

        // Only update state if still valid
        if (scenarioMediaRequestIdRef.current === requestId) {
          setScenarioMedia(mapped)
          hasLoadedRef.current = scenarioId
          setIsLoading(false)
          
          if (import.meta.env.DEV) {
            console.debug('[useScenarioMedia] Loaded media:', {
              scenarioId,
              count: mapped.length,
              ids: mapped.map(m => m.id)
            })
          }
        }
      } catch (error) {
        console.error('[useScenarioMedia] Failed to load scenario media', error)
        if (scenarioMediaRequestIdRef.current === requestId) {
          setScenarioMedia([])
          hasLoadedRef.current = null
          setIsLoading(false)
        }
      }
    }

    void loadScenarioMedia()
  }, [scenarioId, closeMedia, scenarioMedia.length])

  return {
    scenarioMedia,
    isLoading,
  }
}
