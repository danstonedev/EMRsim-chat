import type { VoiceOption } from './constants'

type VoiceSettingsSectionProps = {
  voices: VoiceOption[]
  selectedVoice: string | null
  onSelectVoice: (voiceId: string | null) => void
  fetchFailed: boolean
}

export function VoiceSettingsSection({ voices, selectedVoice, onSelectVoice, fetchFailed }: VoiceSettingsSectionProps) {
  return (
    <section>
      <h3>Voice</h3>
      {fetchFailed && <div className="banner banner--warn">Using default voice list</div>}
      <label className="form-row">
        <span>Realtime voice</span>
        <select value={selectedVoice || ''} onChange={(event) => onSelectVoice(event.target.value || null)}>
          <option value="">Default (server/persona)</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.label || voice.id}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
