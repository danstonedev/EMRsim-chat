// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.ts';
import { loadSPSContent } from '../../sps/runtime/session.ts';

/** @type {import('express').Express} */
/** @type {import('express').Express | undefined} */
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
});
