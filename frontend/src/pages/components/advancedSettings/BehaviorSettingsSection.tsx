type BehaviorSettingsSectionProps = {
  autostart: boolean
  onToggleAutostart: (value: boolean) => void
}

export function BehaviorSettingsSection({ autostart, onToggleAutostart }: BehaviorSettingsSectionProps) {
  return (
    <section>
      <h3>Behavior</h3>
      <label className="form-row checkbox-row">
        <span className="checkbox-line">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(event) => onToggleAutostart(event.target.checked)}
          />
          <span className="ml8">Autostart voice on session ready</span>
        </span>
      </label>
    </section>
  )
}
