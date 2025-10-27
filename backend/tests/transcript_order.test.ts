// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadSPSContent } from '../src/sps/runtime/session.js'
import { spsRegistry } from '../src/sps/core/registry.js'

let app
let scenarioId
let personaId

beforeAll(() => {
  loadSPSContent()
  app = createApp()
  personaId = Object.keys(spsRegistry.personas)[0]
  scenarioId = Object.keys(spsRegistry.scenarios)[0]
})

describe('SPS transcript ordering', () => {
  it('orders persisted turns by their timestamps regardless of insert order', async () => {
    const compose = await request(app)
      .post('/api/sessions')
      .send({ persona_id: personaId, scenario_id: scenarioId, mode: 'sps' })

    expect(compose.status).toBe(201)
    const sessionId = compose.body.session_id
    expect(sessionId).toBeTruthy()

    const base = Date.now()

    // Persist assistant turn first with a later timestamp
    const persistAssistant = await request(app)
      .post(`/api/sessions/${sessionId}/sps/turns`)
      .send({
        turns: [
          {
            role: 'assistant',
            text: 'Patient reply (should appear second)',
            channel: 'text',
            timestamp_ms: base + 2000,
          },
        ],
      })
    expect(persistAssistant.status).toBe(201)

    // Persist user turn afterwards but with an earlier timestamp
    const persistUser = await request(app)
      .post(`/api/sessions/${sessionId}/sps/turns`)
      .send({
        turns: [
          {
            role: 'user',
            text: 'Student question (should appear first)',
            channel: 'text',
            timestamp_ms: base + 200,
          },
        ],
      })
    expect(persistUser.status).toBe(201)

    // Add another pair of turns to ensure ordering holds across multiple entries
    const persistSecondPair = await request(app)
      .post(`/api/sessions/${sessionId}/sps/turns`)
      .send({
        turns: [
          {
            role: 'user',
            text: 'Student follow-up (third)',
            channel: 'text',
            timestamp_ms: base + 4000,
          },
          {
            role: 'assistant',
            text: 'Patient follow-up (fourth)',
            channel: 'text',
            timestamp_ms: base + 5000,
          },
        ],
      })
    expect(persistSecondPair.status).toBe(201)

    const transcript = await request(app).get(`/api/sessions/${sessionId}/transcript`)
    expect(transcript.status).toBe(200)

    const html = transcript.text
    const idxFirst = html.indexOf('Student question (should appear first)')
    const idxSecond = html.indexOf('Patient reply (should appear second)')
    const idxThird = html.indexOf('Student follow-up (third)')
    const idxFourth = html.indexOf('Patient follow-up (fourth)')

    expect(idxFirst).toBeGreaterThan(-1)
    expect(idxSecond).toBeGreaterThan(-1)
    expect(idxThird).toBeGreaterThan(-1)
    expect(idxFourth).toBeGreaterThan(-1)

    expect(idxFirst).toBeLessThan(idxSecond)
    expect(idxSecond).toBeLessThan(idxThird)
    expect(idxThird).toBeLessThan(idxFourth)
  })
})
