import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { SettingsProvider, useAdvancedSettings } from './settingsContext'
import { installLocalStorageMock } from './__mocks__/localStorage'

describe('settingsContext', () => {
  beforeEach(() => {
    installLocalStorageMock()
  })

  it('provides defaults and persists updates', () => {
    const wrapper: React.FC<{children: React.ReactNode}> = ({ children }) => (
      <SettingsProvider>{children}</SettingsProvider>
    )

    const { result } = renderHook(() => useAdvancedSettings(), { wrapper })

    // Defaults
    expect(result.current.settings.voice).toBeNull()
    expect(result.current.settings.inputLanguage).toBe('en-US')
    expect(result.current.settings.replyLanguage).toBe('en-US')
    expect(result.current.settings.autostart).toBe(false)

    // Update
    act(() => {
      result.current.update({ voice: 'alloy', inputLanguage: 'en-US', replyLanguage: 'es', autostart: true })
    })

    expect(result.current.settings.voice).toBe('alloy')
    expect(result.current.settings.inputLanguage).toBe('en-US')
    expect(result.current.settings.replyLanguage).toBe('es')
    expect(result.current.settings.autostart).toBe(true)

    // Should persist to localStorage
    const raw = window.localStorage.getItem('app.advancedSettings.v1')
    expect(raw).toBeTruthy()

    // Reset
    act(() => { result.current.reset() })
    expect(result.current.settings.voice).toBeNull()
    expect(result.current.settings.inputLanguage).toBe('en-US')
    expect(result.current.settings.replyLanguage).toBe('en-US')
    expect(result.current.settings.autostart).toBe(false)
  })
})
