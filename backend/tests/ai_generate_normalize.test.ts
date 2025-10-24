import { describe, it, expect } from 'vitest'
import { normalizeScenario } from '../src/services/ai_generate.ts'

describe('normalizeScenario', () => {
  it('promotes meta fields when top-level values are missing', () => {
    const scenario = {
      scenario_id: 'sc_test_meta_promote',
      meta: {
        title: 'Meta Title',
        region: 'hip',
        difficulty: 'easy',
        setting: 'outpatient_pt',
        tags: ['tag1', 'tag2']
      }
    }

  const result = normalizeScenario(scenario)

    expect(result).not.toBe(scenario)
    expect(result.title).toBe('Meta Title')
    expect(result.region).toBe('hip')
    expect(result.difficulty).toBe('easy')
    expect(result.setting).toBe('outpatient_pt')
    expect(result.tags).toEqual(['tag1', 'tag2'])
  })

  it('preserves existing top-level values', () => {
    const scenario = {
      scenario_id: 'sc_test_existing',
      title: 'Root Title',
      region: 'knee',
      difficulty: 'advanced',
      setting: 'sports_rehab',
      tags: ['existing'],
      meta: {
        title: 'Meta Title',
        region: 'hip',
        difficulty: 'easy',
        setting: 'outpatient_pt',
        tags: ['meta-tag']
      }
    }

  const result = normalizeScenario(scenario)

    expect(result.title).toBe('Root Title')
    expect(result.region).toBe('knee')
    expect(result.difficulty).toBe('advanced')
    expect(result.setting).toBe('sports_rehab')
    expect(result.tags).toEqual(['existing'])
  })

  it('returns non-object input untouched', () => {
    expect(normalizeScenario(null)).toBeNull()
    expect(normalizeScenario(undefined)).toBeUndefined()
    expect(normalizeScenario('scenario' as any)).toBe('scenario')
  })

  it('removes persona-related payloads when present', () => {
    const scenario = {
      scenario_id: 'sc_persona_link',
      meta: { title: 'With Persona', region: 'hip' },
      persona: { name: 'Should remove' },
    } as any

    const result = normalizeScenario(scenario)

    expect(result.persona).toBeUndefined()
    expect(result.linked_persona_id).toBeUndefined()
    expect(result.persona_snapshot).toBeUndefined()
  })
})
