import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';

// Default BASE in api.ts falls back to http://localhost:3002 when VITE_API_BASE_URL is not set.
const BASE = 'http://localhost:3002';

function mockFetchOnce(status = 200, body: any = {}) {
  (globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

describe('api routes', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).fetch = origFetch as any;
  });

  it('calls /api/sps/personas for getSpsPersonas', async () => {
    mockFetchOnce(200, { personas: [] });
    await api.getSpsPersonas();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const url = (globalThis.fetch as any).mock.calls[0][0];
    expect(String(url)).toBe(`${BASE}/api/sps/personas`);
  });

  it('calls /api/sps/scenarios for getSpsScenarios', async () => {
    mockFetchOnce(200, { scenarios: [] });
    await api.getSpsScenarios();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const url = (globalThis.fetch as any).mock.calls[0][0];
    expect(String(url)).toBe(`${BASE}/api/sps/scenarios`);
  });
});
