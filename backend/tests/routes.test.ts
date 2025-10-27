// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadSPSContent } from '../src/sps/runtime/session.js';

let app;

beforeAll(() => {
  loadSPSContent();
  app = createApp();
});

describe('SPS API routes', () => {
  it('lists scenarios', async () => {
    const r = await request(app).get('/api/sps/scenarios');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.scenarios)).toBe(true);
    expect(r.body.scenarios.length).toBeGreaterThan(0);
  });

  it('gets instructions', async () => {
    const r = await request(app).get('/api/sps/instructions');
    expect(r.status).toBe(200);
    expect(typeof r.body.instructions).toBe('string');
  });

  it('includes voice metadata on personas', async () => {
    const r = await request(app).get('/api/sps/personas');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.personas)).toBe(true);
    const persona = r.body.personas.find((p) => typeof p.voice === 'string' && p.voice.length > 0);
    expect(persona).toBeTruthy();
    expect(typeof persona.voice).toBe('string');
    if (persona.tags !== undefined) {
      expect(Array.isArray(persona.tags)).toBe(true);
    }
  });

  it('fetches persona by id', async () => {
    const list = await request(app).get('/api/sps/personas');
    expect(list.status).toBe(200);
    const first = list.body.personas[0];
    expect(first?.id).toBeTruthy();

    const detail = await request(app).get(`/api/sps/personas/${first.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body?.persona?.patient_id).toBe(first.id);
  });
});
