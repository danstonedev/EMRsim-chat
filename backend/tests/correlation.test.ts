// @ts-nocheck
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'

describe('correlation middleware', () => {
  const app = createApp()

  it('preserves provided X-Request-Id on response', async () => {
    const reqId = 'test-req-123'
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', reqId)
      .expect(200)

    expect(res.headers['x-request-id']).toBe(reqId)
  })

  it('generates X-Request-Id when not provided', async () => {
    const res = await request(app).get('/api/health').expect(200)
    const hdr = res.headers['x-request-id']
    expect(typeof hdr).toBe('string')
    expect((hdr as string).length).toBeGreaterThan(10)
  })
})
