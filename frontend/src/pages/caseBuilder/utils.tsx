import type { ReactNode } from 'react'
import { HeadingLevel, Paragraph, TextRun } from 'docx'
import type { ScenarioPreview, PersonaPreview } from './types'
import { isLoadingPreview, isErrorPreview, isScenarioData, isPersonaData } from './types'

// Shared outline rendering helpers
const isPrimitive = (value: unknown): value is string | number | boolean => {
  return value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

const isSimpleObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(isPrimitive)
}

function renderValue(value: unknown, depth = 0): ReactNode {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="cb-doc-value">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null

    if (value.length === 1 && isPrimitive(value[0])) {
      return <span className="cb-doc-value">{String(value[0])}</span>
    }

    if (value.every(isPrimitive)) {
      return <span className="cb-doc-value">{value.join(', ')}</span>
    }

    return (
      <div className="cb-doc-list">
        {value.map((item, idx) => (
          <div key={idx} className="cb-doc-list-item">
            <span className="cb-doc-bullet">•</span>
            <div className="cb-doc-content">{renderValue(item, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, val]) => val !== null && val !== undefined)
    if (entries.length === 0) return null

    if (isSimpleObject(value)) {
      const parts = entries.map(([key, val]) => `${key.replace(/_/g, ' ')}: ${String(val)}`)
      return <span className="cb-doc-value">{parts.join(', ')}</span>
    }

    const sectionClass = depth > 0 ? 'cb-doc-section cb-doc-nested' : 'cb-doc-section'
    return (
      <div className={sectionClass}>
        {entries.map(([key, val]) => {
          const rendered = renderValue(val, depth + 1)
          if (rendered === null) return null
          const simple = isPrimitive(val) || (Array.isArray(val) && val.every(isPrimitive))
          return (
            <div key={key} className={simple ? 'cb-doc-row' : 'cb-doc-field'}>
              <div className="cb-doc-label">{key.replace(/_/g, ' ')}</div>
              {simple ? <div className="cb-doc-inline-value">{rendered}</div> : <div className="cb-doc-value-block">{rendered}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="cb-doc-value">{String(value)}</span>
}

export const renderOutline = (data: ScenarioPreview | PersonaPreview): ReactNode => {
  if (!data || isLoadingPreview(data) || isErrorPreview(data)) return null
  return renderValue(data, 0)
}

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${toText(val)}`)
      .filter(Boolean)
      .join(', ')
    return entries || '[object]'
  }
  return String(value)
}

const isSimpleDocxValue = (value: unknown): value is string | number | boolean => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

const isSimpleDocxObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(val => val === null || val === undefined || isSimpleDocxValue(val))
}

export const generateDocxParagraphs = (data: unknown, heading?: string): Paragraph[] => {
  const paragraphs: Paragraph[] = []

  const addParagraphs = (value: unknown, label = '', depth = 0): void => {
    if (value === null || value === undefined) return

    if (Array.isArray(value)) {
      if (value.length === 0) return

      if (value.length === 1 && isSimpleDocxValue(value[0])) {
        if (!label) return
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
            new TextRun({ text: String(value[0]) }),
          ],
          spacing: { after: 120 },
          indent: { left: depth * 360 },
        }))
        return
      }

      if (value.every(isSimpleDocxValue)) {
        if (!label) return
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
            new TextRun({ text: value.join(', ') }),
          ],
          spacing: { after: 120 },
          indent: { left: depth * 360 },
        }))
        return
      }

      if (label) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `${label}:`, bold: true, color: '0b5c2d' })],
          spacing: { after: 80 },
          indent: { left: depth * 360 },
        }))
      }

      value.forEach(item => {
        if (isSimpleDocxValue(item)) {
          paragraphs.push(new Paragraph({
            text: `• ${String(item)}`,
            spacing: { after: 80 },
            indent: { left: (depth + 1) * 360 },
          }))
        } else if (typeof item === 'object' && item) {
          Object.entries(item as Record<string, unknown>).forEach(([key, val]) => {
            addParagraphs(val, key.replace(/_/g, ' '), depth + 1)
          })
        }
      })
      return
    }

    if (typeof value === 'object' && value) {
      if (isSimpleDocxObject(value)) {
        if (!label) return
        const parts: string[] = []
        Object.entries(value).forEach(([key, val]) => {
          if (val === null || val === undefined) return
          const textVal = toText(val)
          if (textVal) parts.push(`${key.replace(/_/g, ' ')}: ${textVal}`)
        })

        if (parts.length > 0) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
              new TextRun({ text: parts.join(', ') }),
            ],
            spacing: { after: 120 },
            indent: { left: depth * 360 },
          }))
        }
        return
      }

      if (label) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: label, bold: true, color: '0b5c2d' })],
          spacing: { after: 80 },
          indent: { left: depth * 360 },
        }))
      }

      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        addParagraphs(val, key.replace(/_/g, ' '), depth + 1)
      })
      return
    }

    if (!label) return
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, color: '0b5c2d' }),
        new TextRun({ text: String(value) }),
      ],
      spacing: { after: 120 },
      indent: { left: depth * 360 },
    }))
  }

  if (heading) {
    paragraphs.push(new Paragraph({
      text: heading,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    }))
  }

  const entries = typeof data === 'object' && data !== null ? Object.entries(data as Record<string, unknown>) : []

  entries.forEach(([key, value]) => {
    if (key === 'title') return
    addParagraphs(value, key.replace(/_/g, ' '), 0)
  })

  return paragraphs
}

export const getScenarioDisplayName = (preview: ScenarioPreview): string => {
  if (!preview || isLoadingPreview(preview) || isErrorPreview(preview) || !isScenarioData(preview)) {
    return 'Scenario'
  }
  return preview.meta?.title || preview.scenario_id || 'Scenario'
}

export const getPersonaDisplayName = (preview: PersonaPreview): string => {
  if (!preview || isLoadingPreview(preview) || isErrorPreview(preview) || !isPersonaData(preview)) {
    return 'Persona'
  }
  return String(preview.display_name || preview.patient_id || preview.id || 'Persona')
}
