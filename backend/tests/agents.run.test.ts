import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'

let app: ReturnType<typeof createApp>

describe('Agents API', () => {
  beforeAll(() => {
    app = createApp()
  })

  it('lists registered agents', async () => {
    const res = await request(app).get('/api/agents').expect(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(res.body.agents).toContain('case-summary')
  })

  it('runs case-summary agent with mock output', async () => {
    const res = await request(app)
      .post('/api/agents/run')
      .send({ agent: 'case-summary', params: { sessionId: 'nonexistent-session' } })
      .expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.agent).toBe('case-summary')
    expect(typeof res.body.output.summary === 'string').toBe(true)
  })
})
