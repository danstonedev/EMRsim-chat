// Lightweight persisted settings for viewer configuration
// Uses localStorage under a namespaced key. Safe no-throw helpers for SSR/tests.

export type ViewerSettings = {
  defaultSpeed: number
  baseModelPath: string
}

const KEY = 'viewer.settings.v1'

const defaultSettings: ViewerSettings = {
  defaultSpeed: 0.5,
  baseModelPath: 'models/Manny_Static.glb',
}

function readStorage(): Partial<ViewerSettings> | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return null
    return JSON.parse(raw) as Partial<ViewerSettings>
  } catch {
    return null
  }
}

function writeStorage(value: ViewerSettings) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch { /* noop */ }
}

export function getViewerSettings(): ViewerSettings {
  const stored = readStorage() || {}
  return { ...defaultSettings, ...stored }
}

export function setViewerSettings(partial: Partial<ViewerSettings>): ViewerSettings {
  const merged = { ...getViewerSettings(), ...partial }
  writeStorage(merged)
  return merged
}

// Simple React hook variant without introducing global state libs
import { useCallback, useMemo, useState } from 'react'
export function useViewerSettings() {
  const [settings, setSettings] = useState<ViewerSettings>(() => getViewerSettings())

  const update = useCallback((p: Partial<ViewerSettings>) => {
    const next = setViewerSettings(p)
    setSettings(next)
  }, [])

  return useMemo(() => ({ settings, update }), [settings, update])
}
