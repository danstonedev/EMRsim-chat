import type { ScenarioRegion } from '../types'

export type CaseBuilderFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  region: string
  onRegionChange: (value: string) => void
  difficulty: string
  onDifficultyChange: (value: string) => void
  setting: string
  onSettingChange: (value: string) => void
  onClearFilters: () => void
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
  regionOptions: Array<{ value: ScenarioRegion; label: string }>
}

export function CaseBuilderFilters({
  search,
  onSearchChange,
  region,
  onRegionChange,
  difficulty,
  onDifficultyChange,
  setting,
  onSettingChange,
  onClearFilters,
  filteredCount,
  totalCount,
  hasActiveFilters,
  regionOptions,
}: CaseBuilderFiltersProps) {
  return (
    <div className="cb-card cb-card--spaced">
      <div className="cb-card-body cb-card-body--stack">
        <div className="cb-grid">
          <label className="cb-field cb-field--full">
            <span>Search</span>
            <input
              type="text"
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Search title, tags, persona, region…"
            />
          </label>
          <label className="cb-field">
            <span>Region</span>
            <select value={region} onChange={event => onRegionChange(event.target.value)}>
              <option value="">All</option>
              {regionOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cb-field">
            <span>Difficulty</span>
            <select value={difficulty} onChange={event => onDifficultyChange(event.target.value)}>
              <option value="">All</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="cb-field">
            <span>Setting</span>
            <select value={setting} onChange={event => onSettingChange(event.target.value)}>
              <option value="">All</option>
              <option value="outpatient">Outpatient</option>
              <option value="inpatient">Inpatient</option>
              <option value="acute_care">Acute Care</option>
              <option value="home_health">Home Health</option>
              <option value="sports_medicine">Sports Medicine</option>
            </select>
          </label>
        </div>
        <div className="cb-btn-group">
          <span className="cb-muted">
            Showing {filteredCount} of {totalCount}
          </span>
          <button
            type="button"
            className="cb-btn cb-btn-ghost"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  )
}
