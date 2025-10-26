import { useEffect, useMemo, useState } from 'react'
import { useAdvancedSettings } from '../../shared/settingsContext'
import { api } from '../../shared/api'
import { AdvancedSettingsLayout } from './advancedSettings/AdvancedSettingsLayout'
import { VoiceLanguageSettingsSection } from './advancedSettings/VoiceLanguageSettingsSection'
import { DEFAULT_VOICES, type VoiceOption } from './advancedSettings/constants'

type AdvancedSettingsDrawerProps = {
  open: boolean
  onClose: () => void
  onReconnectRequest?: () => void
}

export function AdvancedSettingsDrawer({ open, onClose, onReconnectRequest }: AdvancedSettingsDrawerProps) {
  const { settings, update, reset } = useAdvancedSettings()
  const [voices, setVoices] = useState<VoiceOption[]>(DEFAULT_VOICES)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchVoices = async () => {
      setFetchFailed(false)
      try {
        const list = await api.getVoiceVoices()
        if (!cancelled && Array.isArray(list)) {
          setVoices(list.map((id: string) => ({ id })))
        }
      } catch {
        if (!cancelled) {
          setFetchFailed(true)
        }
      }
    }

  void fetchVoices()
    return () => {
      cancelled = true
    }
  }, [])

  const appliedNote = useMemo(
    () => 'Changes apply on next connect. Use Reconnect to apply now.',
    [],
  )

  const footerContent = (
    <>
      <button type="button" className="btn" onClick={reset}>
        Reset to defaults
      </button>
      {onReconnectRequest && (
        <button type="button" className="btn" onClick={onReconnectRequest}>
          Reconnect to apply
        </button>
      )}
    </>
  )

  if (!open) {
    return null
  }

  return (
    <AdvancedSettingsLayout open={open} onClose={onClose} footer={footerContent}>
      <header className="drawer-header">
        <strong>Advanced Settings</strong>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="drawer-body">
        <VoiceLanguageSettingsSection
          voices={voices}
          selectedVoice={settings.voice ?? null}
          onSelectVoice={(voiceId) => update({ voice: voiceId })}
          fetchFailed={fetchFailed}
          inputLanguage={settings.inputLanguage}
          replyLanguage={settings.replyLanguage}
          onInputLanguageChange={(value) => update({ inputLanguage: value as any })}
          onReplyLanguageChange={(value) => update({ replyLanguage: value })}
          helperText={appliedNote}
          languageLock={settings.languageLock}
          onLanguageLockChange={(value) => update({ languageLock: value })}
        />
      </div>
    </AdvancedSettingsLayout>
  )
}

export default AdvancedSettingsDrawer
