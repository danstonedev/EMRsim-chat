// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadSPSContent } from '../src/sps/runtime/session.ts'
import { spsRegistry } from '../src/sps/core/registry.ts'

let app
let personaId
let scenarioId
let scenarioTitle

beforeAll(() => {
  loadSPSContent()
  app = createApp()
  const scenarioEntry = Object.values(spsRegistry.scenarios).find((sc) => sc && sc.linked_persona_id)
  if (!scenarioEntry) {
    throw new Error('No scenario with linked persona available for export test')
  }
  personaId = scenarioEntry.linked_persona_id
  scenarioId = scenarioEntry.scenario_id
  scenarioTitle = scenarioEntry.title
})

describe('SPS scenario export page', () => {
  it('renders HTML with new schema sections', async () => {
    const res = await request(app).get(`/api/sps/export?persona_id=${personaId}&scenario_id=${scenarioId}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('Scenario Snapshot')
    expect(res.text).toContain('Region:')
    expect(res.text).toContain('Pedagogy &amp; Learning Objectives')
    expect(res.text).toContain('ICF Summary')
    expect(res.text).toContain('Objective Catalog')
    expect(res.text).toContain('Special Questions (')
    expect(res.text).toContain('Screening Challenges (')
    expect(res.text).toContain('Gold-standard Instructions')
    expect(res.text).toContain('SOAP Payload')
    expect(res.text).toContain(scenarioTitle)
  })

  it('gracefully renders when optional scenario sections are missing', async () => {
    const fallbackPersona = Object.values(spsRegistry.personas)[0]
    if (!fallbackPersona) throw new Error('No personas loaded for minimal export test')

    const minimalScenarioId = `sc_test_minimal_${Date.now()}`
    const minimalScenario = {
      scenario_id: minimalScenarioId,
      title: 'Minimal export scenario',
      region: 'knee',
      linked_persona_id: fallbackPersona.patient_id,
      objective_catalog: [],
    }

    spsRegistry.addScenarios([minimalScenario])

    const res = await request(app).get(`/api/sps/export?persona_id=${fallbackPersona.patient_id}&scenario_id=${minimalScenarioId}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('Minimal export scenario')
    expect(res.text).toContain('Objective Catalog (0)')
    expect(res.text).toContain('Special Questions (0)')
    expect(res.text).toContain('Screening Challenges (0)')

    delete spsRegistry.scenarios[minimalScenarioId]
  })
})
