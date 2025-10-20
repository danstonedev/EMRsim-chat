import type { PersonaLite } from '../types'

export type PersonaTableProps = {
  personas: PersonaLite[]
  onPreview: (id: string) => void
}

export function PersonaTable({ personas, onPreview }: PersonaTableProps) {
  if (personas.length === 0) {
    return (
      <div className="cb-card">
        <div className="cb-card-body">
          <p>No personas found.</p>
        </div>
      </div>
    )
  }

  return (
    <table className="cb-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Age</th>
          <th>Sex</th>
          <th>Voice</th>
          <th>Headline</th>
          <th>Tags</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {personas.map(persona => (
          <tr key={persona.id}>
            <td className="cb-table-title">{persona.display_name || persona.id}</td>
            <td>{persona.age || '—'}</td>
            <td>{persona.sex || '—'}</td>
            <td>{persona.voice || '—'}</td>
            <td className="cb-table-headline">{persona.headline || '—'}</td>
            <td>
              {persona.tags && persona.tags.length > 0 ? (
                <div className="cb-tags-inline">
                  {persona.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="cb-tag-sm">
                      {tag}
                    </span>
                  ))}
                  {persona.tags.length > 3 && (
                    <span className="cb-tag-sm cb-tag-more">+{persona.tags.length - 3}</span>
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
                  onPreview(persona.id)
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
