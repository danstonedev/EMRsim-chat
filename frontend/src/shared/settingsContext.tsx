import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type AdvancedSettings = {
  voice: string | null
  inputLanguage: 'auto' | string
  replyLanguage: 'default' | string
  autostart: boolean
}

type SettingsContextValue = {
  settings: AdvancedSettings
  update: (partial: Partial<AdvancedSettings>) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const STORAGE_KEY = 'app.advancedSettings.v1'

const defaultSettings: AdvancedSettings = {
  voice: null,
  inputLanguage: 'en-US',
  replyLanguage: 'en-US',
  autostart: false,
}

function load(): AdvancedSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    const merged: AdvancedSettings = { ...defaultSettings, ...parsed }
    // Migrate legacy defaults to English unless explicitly set by user
    if (!('inputLanguage' in parsed) || parsed.inputLanguage === 'auto') {
      merged.inputLanguage = 'en-US'
    }
    if (!('replyLanguage' in parsed) || parsed.replyLanguage === 'default') {
      merged.replyLanguage = 'en-US'
    }
    return merged
  } catch {
    return defaultSettings
  }
}

function persist(s: AdvancedSettings) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AdvancedSettings>(() => (typeof window === 'undefined' ? defaultSettings : load()))

  useEffect(() => { if (typeof window !== 'undefined') persist(settings) }, [settings])

  const update = useCallback((partial: Partial<AdvancedSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  const reset = useCallback(() => setSettings(defaultSettings), [])

  const value = useMemo<SettingsContextValue>(() => ({ settings, update, reset }), [settings, update, reset])

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useAdvancedSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useAdvancedSettings must be used inside SettingsProvider')
  return ctx
}
