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
  languageLock?: boolean
  onLanguageLockChange?: (value: boolean) => void
}

const DEFAULT_REPLY_ID = 'default'

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
  languageLock = false,
  onLanguageLockChange,
}: VoiceLanguageSettingsSectionProps) {
  const replyOptions = LANG_OPTIONS.filter((option) => option.id !== 'auto')
  // For the default reply language, we present a helpful label explaining behavior
  const defaultReplyLabel = 'Match input language (default)'

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
            <option value={DEFAULT_REPLY_ID}>{defaultReplyLabel}</option>
            {replyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field__label">Language lock</span>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!languageLock}
              onChange={(e) => onLanguageLockChange?.(e.target.checked)}
            />
            <span className="text-sm opacity-80">Force explicit input/reply languages; disable auto-detect</span>
          </div>
        </label>
      </div>

      <p className="helper-text">{helperText}</p>
    </section>
  )
}
