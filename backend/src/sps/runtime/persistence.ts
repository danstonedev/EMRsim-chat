import fs from 'node:fs';
import path from 'node:path';
import { serializeSessions, hydrateSession, sessions, type HydratedSessionRecord } from './store.ts';
import type { SPSRegistry } from '../core/registry.ts';

function sessionFilePath(): string {
  const p = process.env.SPS_SESSION_FILE || path.join(process.cwd(), 'backend', 'data', 'sps-sessions.json');
  return p;
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface RestoreResult {
  restored: number;
  error?: string;
}

export function restorePersistedSessions(registry: SPSRegistry): RestoreResult {
  if (!isPersistenceEnabled()) return { restored: 0 };
  const file = sessionFilePath();
  if (!fs.existsSync(file)) return { restored: 0 };
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const arr: unknown = JSON.parse(raw);
    let restored = 0;
    if (Array.isArray(arr)) {
      for (const rec of arr) {
        if (hydrateSession(registry, rec as HydratedSessionRecord)) restored++;
      }
    }
    return { restored };
  } catch (e) {
    console.warn('[sps][persistence] failed to restore sessions', e);
    return { restored: 0, error: String(e) };
  }
}

export function persistSessionsSync(): void {
  if (!isPersistenceEnabled()) return;
  try {
    const file = sessionFilePath();
    ensureDir(file);
    fs.writeFileSync(file, JSON.stringify(serializeSessions(), null, 2));
  } catch (e) {
    console.warn('[sps][persistence] write failed', e);
  }
}

let writeTimer: NodeJS.Timeout | null = null;
export function schedulePersist(): void {
  if (!isPersistenceEnabled()) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    persistSessionsSync();
  }, 250); // debounce writes
}

export function isPersistenceEnabled(): boolean {
  return process.env.SPS_PERSIST === '1' || process.env.SPS_PERSIST === 'true';
}

// Convenience helper for routes to call after any session mutation
export function touchPersistence(): void {
  schedulePersist();
}

// Expose a manual flush (e.g. during shutdown)
export function flushPersistence(): void {
  persistSessionsSync();
}

// Attempt to flush on process exit when enabled
if (isPersistenceEnabled()) {
  process.on('beforeExit', () => {
    try {
      persistSessionsSync();
    } catch {
      /* ignore */
    }
  });
}

export { sessions };
