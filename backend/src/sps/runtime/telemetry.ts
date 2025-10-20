import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = process.env.SPS_TELEMETRY_DIR || path.join(process.cwd(), 'backend', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'sps-events.ndjson');
const ENABLED = process.env.SPS_TELEMETRY === '1' || process.env.SPS_TELEMETRY === 'true';

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

export interface TelemetryEvent {
  ts: number;
  type: string;
  [key: string]: unknown;
}

export function logEvent(type: string, payload: Record<string, unknown>): void {
  if (!ENABLED) return;
  try {
    ensureLogDir();
    const record: TelemetryEvent = { ts: Date.now(), type, ...payload };
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
  } catch {
    // silent; avoid crashing runtime due to logging issues
  }
}

export function telemetryStatus(): { enabled: boolean; file: string } {
  return { enabled: ENABLED, file: LOG_FILE };
}
