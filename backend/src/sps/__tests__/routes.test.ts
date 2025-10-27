import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../app.js';
import { loadSPSContent } from '../../sps/runtime/session.js';

let app: Application;

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
});
