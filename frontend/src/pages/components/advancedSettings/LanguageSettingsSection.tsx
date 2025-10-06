import { LANG_OPTIONS } from './constants'

type LanguageSettingsSectionProps = {
  inputLanguage: string
  replyLanguage: string
  onInputLanguageChange: (value: string) => void
  onReplyLanguageChange: (value: string) => void
  helperText: string
}

export function LanguageSettingsSection({
  inputLanguage,
  replyLanguage,
  onInputLanguageChange,
  onReplyLanguageChange,
  helperText,
}: LanguageSettingsSectionProps) {
  return (
    <section>
      <h3>Language</h3>
      <label className="form-row">
        <span>Input (transcription) language</span>
        <select value={inputLanguage} onChange={(event) => onInputLanguageChange(event.target.value)}>
          {LANG_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row">
        <span>Reply language</span>
        <select value={replyLanguage} onChange={(event) => onReplyLanguageChange(event.target.value)}>
          <option value="en-US">English (default)</option>
          {LANG_OPTIONS.filter((option) => option.id !== 'auto').map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="helper-text">{helperText}</div>
    </section>
  )
}
