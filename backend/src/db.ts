import { nanoid } from 'nanoid';

// Types for better-sqlite3 (optional dependency)
interface Database {
  prepare(sql: string): Statement;
  pragma(pragma: string): unknown;
}

interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

// Database table types
export interface SessionRow {
  id: string;
  persona_id: string;
  mode: string;
  started_at?: string;
  ended_at?: string | null;
  sps_session_id?: string | null;
  sps_scenario_id?: string | null;
  sps_phase?: string | null;
  sps_gate_json?: string | null;
}

export interface TurnRow {
  id: string;
  session_id: string;
  role: string;
  text: string;
  created_at: string;
  audio_ms?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  timings_json?: string | null;
  fingerprint?: string | null;
}

export interface TurnResult {
  id: string;
  created: boolean;
}

export interface ScenarioRow {
  scenario_id: string;
  title: string;
  region: string;
  difficulty?: string | null;
  setting?: string | null;
  tags_json?: string;
  scenario_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioLite {
  scenario_id: string;
  title: string;
  region: string;
  difficulty?: string | null;
  setting?: string | null;
  tags: string[];
  persona_id?: string | null;
  persona_name?: string | null;
  persona_headline?: string | null;
}

export interface ClinicalScenario {
  scenario_id: string;
  title: string;
  region: string;
  difficulty?: string;
  setting?: string;
  tags?: string[];
  linked_persona_id?: string;
  persona_snapshot?: {
    id?: string;
    display_name?: string;
    headline?: string;
  };
  [key: string]: unknown;
}

export interface SpsSessionData {
  sps_session_id: string;
  scenario_id: string;
  phase: string;
  gate: Record<string, unknown> | import('./sps/core/types.ts').GateFlags;
}

// In-memory storage
interface InMemoryStore {
  sessions: SessionRow[];
  turns: TurnRow[];
  scenarios: Array<ScenarioLite & { scenario_json: ClinicalScenario }>;
}

let sqliteDb: Database | null = null;
let usingSqlite = false;

const mem: InMemoryStore = {
  sessions: [],
  turns: [],
  scenarios: [],
};

export async function migrate(pathOrDb?: string | Database): Promise<void> {
  if (!pathOrDb) {
    console.warn('[DB] No database path provided. Using in-memory storage.');
    return;
  }

  try {
    // @ts-ignore - better-sqlite3 is an optional dependency
    const Database = (await import('better-sqlite3')).default;
    
    if (typeof pathOrDb === 'string') {
      sqliteDb = new Database(pathOrDb) as Database;
    } else {
      sqliteDb = pathOrDb;
    }
    
    usingSqlite = true;
    sqliteDb.pragma('journal_mode = WAL');

    sqliteDb.prepare(`
      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        headline TEXT,
        age INTEGER,
        gender TEXT,
        backstory TEXT,
        tone TEXT,
        response_template TEXT
      )
    `).run();

    sqliteDb.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        persona_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        ended_at TEXT,
        sps_session_id TEXT,
        sps_scenario_id TEXT,
        sps_phase TEXT,
        sps_gate_json TEXT
      )
    `).run();

    sqliteDb.prepare(`
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        audio_ms INTEGER,
        tokens_in INTEGER,
        tokens_out INTEGER,
        timings_json TEXT,
        fingerprint TEXT
      )
    `).run();

    sqliteDb.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_fingerprint ON turns(fingerprint)`).run();

    sqliteDb.prepare(`
      CREATE TABLE IF NOT EXISTS scenarios (
        scenario_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        region TEXT NOT NULL,
        difficulty TEXT,
        setting TEXT,
        tags_json TEXT DEFAULT '[]',
        scenario_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    console.log('[DB] SQLite schema ready.');
  } catch (e) {
    console.warn('[DB] better-sqlite3 not available, using in-memory fallback:', (e as Error).message);
    usingSqlite = false;
  }

  // Legacy personas table cleanup removed - using SPS registry now
}

export function healthCheck(): 'ok' | 'err' {
  try {
    if (usingSqlite && sqliteDb) {
      sqliteDb.prepare('SELECT 1').get();
    }
    return 'ok';
  } catch (e) {
    return 'err';
  }
}

export function getStorageMode(): 'sqlite' | 'memory' {
  return usingSqlite && sqliteDb ? 'sqlite' : 'memory';
}

export function createSession(persona_id: string, mode: string, spsData: SpsSessionData | null = null): string {
  const id = nanoid();
  if (usingSqlite && sqliteDb) {
    if (spsData) {
      sqliteDb.prepare('INSERT INTO sessions (id, persona_id, mode, sps_session_id, sps_scenario_id, sps_phase, sps_gate_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, persona_id, mode, spsData.sps_session_id, spsData.scenario_id, spsData.phase, JSON.stringify(spsData.gate));
    } else {
      sqliteDb.prepare('INSERT INTO sessions (id, persona_id, mode) VALUES (?, ?, ?)').run(id, persona_id, mode);
    }
  } else {
    const session: SessionRow = { id, persona_id, mode, started_at: new Date().toISOString() };
    if (spsData) {
      session.sps_session_id = spsData.sps_session_id;
      session.sps_scenario_id = spsData.scenario_id;
      session.sps_phase = spsData.phase;
      session.sps_gate_json = JSON.stringify(spsData.gate);
    }
    mem.sessions.push(session);
  }
  return id;
}

export function getSessionById(id: string): SessionRow | null {
  if (usingSqlite && sqliteDb) {
    return sqliteDb.prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null;
  }
  return mem.sessions.find(s => s.id === id) || null;
}

export function insertTurn(session_id: string, role: string, text: string, extras: Record<string, unknown> = {}): TurnResult {
  const id = nanoid();
  const fingerprint = (extras.fingerprint as string | undefined) || null;
  const payload = { ...extras };
  delete payload.fingerprint;

  const audio_ms = (payload.audio_ms as number | undefined) ?? null;
  const tokens_in = (payload.tokens_in as number | undefined) ?? null;
  const tokens_out = (payload.tokens_out as number | undefined) ?? null;
  const rawTimings = payload.timings_json;
  delete payload.audio_ms;
  delete payload.tokens_in;
  delete payload.tokens_out;
  delete payload.timings_json;

  const coerceMs = (value: unknown): number | null => {
    const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
  };

  const startedMs = coerceMs((payload as any).started_timestamp_ms);
  delete (payload as any).started_timestamp_ms;

  const finalizedMs = coerceMs((payload as any).finalized_timestamp_ms);
  delete (payload as any).finalized_timestamp_ms;

  const emittedMs = coerceMs((payload as any).emitted_timestamp_ms);
  delete (payload as any).emitted_timestamp_ms;

  const legacyTimestampMs = coerceMs((payload as any).timestamp_ms);
  delete payload.timestamp_ms;

  const finalTimestampMs = finalizedMs ?? legacyTimestampMs ?? emittedMs;

  let createdAt: string | null = null;
  if (finalTimestampMs != null) {
    try {
      createdAt = new Date(finalTimestampMs).toISOString();
    } catch {
      createdAt = null;
    }
  }

  let timingsData: Record<string, unknown> = {};
  if (rawTimings) {
    if (typeof rawTimings === 'string') {
      try {
        timingsData = JSON.parse(rawTimings);
      } catch {
        timingsData = {};
      }
    } else if (typeof rawTimings === 'object') {
      timingsData = { ...(rawTimings as Record<string, unknown>) };
    }
  }

  if (startedMs != null) timingsData.started_at_ms = startedMs;
  if (finalTimestampMs != null) timingsData.finalized_at_ms = finalTimestampMs;
  if (emittedMs != null) timingsData.emitted_at_ms = emittedMs;

  const timings_json = Object.keys(timingsData).length ? JSON.stringify(timingsData) : null;

  if (usingSqlite && sqliteDb) {
    try {
      const columns = ['id', 'session_id', 'role', 'text', 'audio_ms', 'tokens_in', 'tokens_out', 'timings_json', 'fingerprint'];
      const values: (string | number | null)[] = [id, session_id, role, text, audio_ms, tokens_in, tokens_out, timings_json, fingerprint];
      if (createdAt) {
        columns.push('created_at');
        values.push(createdAt);
      }
      const placeholders = columns.map(() => '?').join(', ');
      sqliteDb.prepare(`INSERT INTO turns (${columns.join(', ')}) VALUES (${placeholders})`)
        .run(...values);
      return { id, created: true };
    } catch (e: any) {
      if (fingerprint && e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const existing = sqliteDb.prepare('SELECT id FROM turns WHERE fingerprint = ? LIMIT 1').get(fingerprint) as { id: string } | undefined;
        return { id: existing?.id || '', created: false };
      }
      throw e;
    }
  }

  if (fingerprint) {
    const existing = mem.turns.find((t) => t.fingerprint === fingerprint);
    if (existing) return { id: existing.id, created: false };
  }

  mem.turns.push({
    id,
    session_id,
    role,
    text,
    created_at: createdAt || new Date().toISOString(),
    audio_ms,
    tokens_in,
    tokens_out,
    timings_json,
    fingerprint,
    ...payload,
  } as TurnRow);

  return { id, created: true };
}

export function getSessionTurns(sessionId: string): Array<{ id: string; role: string; text: string; created_at: string }> {
  if (usingSqlite && sqliteDb) {
    const rows = sqliteDb.prepare(`
      SELECT id, role, text, created_at 
      FROM turns 
      WHERE session_id = ? 
      ORDER BY 
        CAST(COALESCE(strftime('%s', created_at), '0') AS INTEGER) ASC,
        rowid ASC
    `).all(sessionId);
    return rows;
  }
  
  return mem.turns
    .filter(t => t.session_id === sessionId)
    .sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTs !== bTs) {
        return aTs - bTs;
      }
      return (a.id || '').localeCompare(b.id || '');
    })
    .map(t => ({ id: t.id, role: t.role, text: t.text, created_at: t.created_at }));
}

export function updateSpsSessionData(sessionId: string, spsData: SpsSessionData): void {
  if (usingSqlite && sqliteDb) {
    sqliteDb.prepare('UPDATE sessions SET sps_phase = ?, sps_gate_json = ? WHERE id = ?')
      .run(spsData.phase, JSON.stringify(spsData.gate), sessionId);
  } else {
    const s = mem.sessions.find(x => x.id === sessionId);
    if (s) {
      s.sps_phase = spsData.phase;
      s.sps_gate_json = JSON.stringify(spsData.gate);
    }
  }
}

export function endSession(id: string): void {
  if (usingSqlite && sqliteDb) {
    sqliteDb.prepare("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?").run(id);
  } else {
    const s = mem.sessions.find(x => x.id === id);
    if (s) s.ended_at = new Date().toISOString();
  }
}

export function upsertScenario(scenario: ClinicalScenario): string {
  const lite: ScenarioLite = {
    scenario_id: scenario.scenario_id,
    title: scenario.title,
    region: scenario.region,
    difficulty: scenario.difficulty || null,
    setting: scenario.setting || null,
    tags: Array.isArray(scenario.tags) ? scenario.tags : [],
  };
  
  if (usingSqlite && sqliteDb) {
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(lite.tags || []);
    const scenJson = JSON.stringify(scenario);
    const old = sqliteDb.prepare('SELECT scenario_id FROM scenarios WHERE scenario_id = ?').get(lite.scenario_id);
    if (old) {
      sqliteDb.prepare('UPDATE scenarios SET title = ?, region = ?, difficulty = ?, setting = ?, tags_json = ?, scenario_json = ?, updated_at = ? WHERE scenario_id = ?')
        .run(lite.title, lite.region, lite.difficulty, lite.setting, tagsJson, scenJson, now, lite.scenario_id);
    } else {
      sqliteDb.prepare('INSERT INTO scenarios (scenario_id, title, region, difficulty, setting, tags_json, scenario_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(lite.scenario_id, lite.title, lite.region, lite.difficulty, lite.setting, tagsJson, scenJson, now, now);
    }
  } else {
    const idx = mem.scenarios.findIndex(s => s.scenario_id === lite.scenario_id);
    if (idx >= 0) mem.scenarios[idx] = { ...lite, scenario_json: scenario };
    else mem.scenarios.push({ ...lite, scenario_json: scenario });
  }
  return lite.scenario_id;
}

export function getScenarioByIdFull(scenarioId: string): ClinicalScenario | null {
  if (usingSqlite && sqliteDb) {
    const row = sqliteDb.prepare('SELECT scenario_json FROM scenarios WHERE scenario_id = ?').get(scenarioId) as { scenario_json: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.scenario_json); } catch { return null; }
  }
  const row = mem.scenarios.find(s => s.scenario_id === scenarioId);
  return row ? row.scenario_json : null;
}

export function listScenariosLite(): ScenarioLite[] {
  const transform = (row: ScenarioRow, scenarioJson: ClinicalScenario | null): ScenarioLite => {
    let personaMeta: Partial<ScenarioLite> = {};
    if (scenarioJson && typeof scenarioJson === 'object') {
      personaMeta = {
        persona_id: scenarioJson.linked_persona_id || scenarioJson?.persona_snapshot?.id || null,
        persona_name: scenarioJson?.persona_snapshot?.display_name || null,
        persona_headline: scenarioJson?.persona_snapshot?.headline || null,
      };
    }
    return {
      scenario_id: row.scenario_id,
      title: row.title,
      region: row.region,
      difficulty: row.difficulty,
      setting: row.setting,
      tags: (() => { 
        try { 
          return Array.isArray(row.tags_json) ? row.tags_json as string[] : JSON.parse(row.tags_json || '[]'); 
        } catch { 
          return []; 
        } 
      })(),
      ...personaMeta,
    };
  };

  if (usingSqlite && sqliteDb) {
    const rows = sqliteDb.prepare('SELECT scenario_id, title, region, difficulty, setting, tags_json, scenario_json FROM scenarios ORDER BY title').all() as ScenarioRow[];
    return rows.map(r => {
      let scenarioJson: ClinicalScenario | null = null;
      try { scenarioJson = JSON.parse(r.scenario_json || '{}'); } catch { scenarioJson = null; }
      return transform(r, scenarioJson);
    });
  }

  return mem.scenarios.map(s => transform(
    {
      scenario_id: s.scenario_id,
      title: s.title,
      region: s.region,
      difficulty: s.difficulty,
      setting: s.setting,
      tags_json: JSON.stringify(s.tags),
    },
    s.scenario_json,
  ));
}

export function getAllScenariosFull(): ClinicalScenario[] {
  if (usingSqlite && sqliteDb) {
    const rows = sqliteDb.prepare('SELECT scenario_json FROM scenarios').all() as Array<{ scenario_json: string }>;
    return rows.map(r => { try { return JSON.parse(r.scenario_json); } catch { return null; } }).filter((s): s is ClinicalScenario => s !== null);
  }
  return mem.scenarios.map(s => s.scenario_json);
}

export default { 
  migrate, 
  healthCheck, 
  createSession, 
  getSessionById, 
  insertTurn, 
  getSessionTurns, 
  endSession, 
  updateSpsSessionData, 
  upsertScenario, 
  getScenarioByIdFull, 
  listScenariosLite, 
  getAllScenariosFull 
};
