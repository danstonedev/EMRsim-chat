import type { ScenarioLite } from '../types'

export type ScenarioTableProps = {
  scenarios: ScenarioLite[]
  filteredScenarios: ScenarioLite[]
  onPreview: (id: string) => void
  onClearFilters: () => void
}

export function ScenarioTable({
  scenarios,
  filteredScenarios,
  onPreview,
  onClearFilters,
}: ScenarioTableProps) {
  if (scenarios.length === 0) {
    return (
      <div className="cb-card">
        <div className="cb-card-body">
          <p>No scenarios found. Generate one to get started!</p>
        </div>
      </div>
    )
  }

  if (filteredScenarios.length === 0) {
    return (
      <div className="cb-card">
        <div className="cb-card-body">
          <p>No scenarios match your filters.</p>
          <div className="cb-btn-group cb-mt-2">
            <button type="button" className="cb-btn cb-btn-ghost" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <table className="cb-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Difficulty</th>
          <th>Region</th>
          <th>Setting</th>
          <th>Persona</th>
          <th>Tags</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredScenarios.map(scenario => (
          <tr key={scenario.scenario_id}>
            <td className="cb-table-title">{scenario.title}</td>
            <td>{scenario.difficulty ? <span className="cb-badge">{scenario.difficulty}</span> : null}</td>
            <td className="cb-table-region">{scenario.region}</td>
            <td>{scenario.setting || '—'}</td>
            <td>{scenario.persona_name || '—'}</td>
            <td>
              {scenario.tags && scenario.tags.length > 0 ? (
                <div className="cb-tags-inline">
                  {scenario.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="cb-tag-sm">
                      {tag}
                    </span>
                  ))}
                  {scenario.tags.length > 3 && (
                    <span className="cb-tag-sm cb-tag-more">+{scenario.tags.length - 3}</span>
                  )}
                </div>
              ) : (
                '—'
              )}
            </td>
            <td>
              <button
                className="cb-btn cb-btn-sm cb-btn-ghost"
                onClick={() => {
                  onPreview(scenario.scenario_id)
                }}
              >
                👁 Preview
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
