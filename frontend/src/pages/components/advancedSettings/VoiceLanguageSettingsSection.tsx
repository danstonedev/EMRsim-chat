import { LANG_OPTIONS } from './constants'
import type { VoiceOption } from './constants'

export type VoiceLanguageSettingsSectionProps = {
  voices: VoiceOption[]
  selectedVoice: string | null
  onSelectVoice: (voiceId: string | null) => void
  fetchFailed: boolean
  inputLanguage: string
  replyLanguage: string
  onInputLanguageChange: (value: string) => void
  onReplyLanguageChange: (value: string) => void
  helperText: string
}

const DEFAULT_REPLY_ID = 'en-US'

export function VoiceLanguageSettingsSection({
  voices,
  selectedVoice,
  onSelectVoice,
  fetchFailed,
  inputLanguage,
  replyLanguage,
  onInputLanguageChange,
  onReplyLanguageChange,
  helperText,
}: VoiceLanguageSettingsSectionProps) {
  const replyOptions = LANG_OPTIONS.filter((option) => option.id !== 'auto')
  const defaultReplyLabel = replyOptions.find((option) => option.id === DEFAULT_REPLY_ID)?.label ?? 'English (US)'

  return (
    <section className="advanced-settings-card">
      <header className="advanced-settings-card__heading">
        <h3>Voice &amp; language</h3>
        <p>Fine-tune the realtime voice and transcript localization used for this session.</p>
      </header>

      {fetchFailed && <div className="banner banner--warn">Using default voice list</div>}

      <div className="advanced-settings-card__grid">
        <label className="form-field">
          <span className="form-field__label">Realtime voice</span>
          <select value={selectedVoice || ''} onChange={(event) => onSelectVoice(event.target.value || null)}>
            <option value="">Default (server/persona)</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label || voice.id}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field__label">Input (transcription) language</span>
          <select value={inputLanguage} onChange={(event) => onInputLanguageChange(event.target.value)}>
            {LANG_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field__label">Reply language</span>
          <select value={replyLanguage} onChange={(event) => onReplyLanguageChange(event.target.value)}>
            <option value={DEFAULT_REPLY_ID}>{`${defaultReplyLabel} (default)`}</option>
            {replyOptions
              .filter((option) => option.id !== DEFAULT_REPLY_ID)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <p className="helper-text">{helperText}</p>
    </section>
  )
}
