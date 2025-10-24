import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type KitChunk = {
  id: string;
  text: string;
  tags?: string[];
  roles?: string[];
  phases?: string[];
  weight?: number;
  media_ids?: string[];
  audiences?: string[];
};

type ScenarioKit = {
  case_id: string;
  version?: number;
  provenance?: Record<string, unknown>;
  chunks: KitChunk[];
};

// Resolve base sps directory similar to content loader
function resolveSpsBaseDir(): string {
  try {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    // candidates: src/sps, dist/sps, cwd/sps
    const candidates = [
      path.resolve(dirname, '..'), // runtime -> sps
      path.resolve(dirname, '..', '..'),
      path.resolve(process.cwd(), 'dist', 'sps'),
      path.resolve(process.cwd(), 'src', 'sps'),
      path.resolve(process.cwd(), 'sps'),
    ];
    for (const base of candidates) {
      if (fs.existsSync(base)) return base;
    }
    return path.resolve(dirname, '..');
  } catch {
    return path.resolve(process.cwd(), 'sps');
  }
}

const SPS_BASE = resolveSpsBaseDir();

function tryPaths(caseId: string): string[] {
  // Prefer content/kits/<caseId>/kit.json; fallback to kits/<caseId>/kit.json
  return [
    path.resolve(SPS_BASE, 'content', 'kits', caseId, 'kit.json'),
    path.resolve(SPS_BASE, 'kits', caseId, 'kit.json'),
  ];
}

export function loadScenarioKit(caseId?: string | null): ScenarioKit | null {
  if (!caseId) return null;
  for (const p of tryPaths(caseId)) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const kit = JSON.parse(raw) as ScenarioKit;
        if (kit && Array.isArray(kit.chunks)) return kit;
      }
    } catch (e) {
      if (process.env.DEBUG) console.warn('[kits] failed loading', p, e);
    }
  }
  return null;
}

// Map scenario_id to kit case_id, and optionally suggested personas for that scenario
type KitMappingEntry =
  | string
  | {
      case_id: string;
      personas?: Array<string | { id: string; weight?: number }>;
    };

let KIT_MAPPING_CACHE: Record<string, KitMappingEntry> | null = null;
function loadKitMapping(): Record<string, KitMappingEntry> {
  if (KIT_MAPPING_CACHE) return KIT_MAPPING_CACHE;
  const candidates = [
    path.resolve(SPS_BASE, 'content', 'config', 'kit-mapping.json'),
    path.resolve(SPS_BASE, 'config', 'kit-mapping.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          KIT_MAPPING_CACHE = parsed as Record<string, KitMappingEntry>;
          if (process.env.DEBUG) console.warn('[kits] loaded kit-mapping from', p);
          return KIT_MAPPING_CACHE;
        }
      }
    } catch (e) {
      if (process.env.DEBUG) console.warn('[kits] failed to load kit-mapping', p, e);
    }
  }
  // Default built-in mapping as last resort
  KIT_MAPPING_CACHE = {
    sc_knee_anterior_knee_pain_entry_v1: {
      case_id: 'patellofemoral_pain_v1',
      personas: [],
    },
  } as Record<string, KitMappingEntry>;
  return KIT_MAPPING_CACHE;
}

export function mapScenarioToCaseId(scenarioId?: string | null): string | null {
  if (!scenarioId) return null;
  const map = loadKitMapping();
  const entry = map[scenarioId];
  if (!entry) return scenarioId;
  if (typeof entry === 'string') return entry;
  return entry.case_id || scenarioId;
}

type PersonaRef = string | { id: string; weight?: number };

export function getSuggestedPersonas(scenarioId?: string | null): Array<{ id: string; weight: number }> {
  if (!scenarioId) return [];
  const map = loadKitMapping();
  const entry = map[scenarioId];
  if (!entry || typeof entry === 'string') return [];
  const arr: PersonaRef[] = Array.isArray(entry.personas) ? (entry.personas as PersonaRef[]) : [];
  const out: Array<{ id: string; weight: number }> = [];
  for (const p of arr) {
    if (typeof p === 'string') {
      out.push({ id: p, weight: 1 });
    } else if (p && typeof p === 'object' && typeof p.id === 'string') {
      const wRaw = (p as { id: string; weight?: number }).weight;
      const w = Number(wRaw);
      out.push({ id: p.id, weight: Number.isFinite(w) && w > 0 ? Math.floor(w) : 1 });
    }
  }
  return out;
}

export function pickRandomSuggestedPersona(scenarioId?: string | null): string | null {
  const list = getSuggestedPersonas(scenarioId);
  if (!list.length) return null;
  // Weighted random selection
  const total = list.reduce((sum, p) => sum + (p.weight > 0 ? p.weight : 0), 0);
  const r = Math.random() * (total || 1);
  let acc = 0;
  for (const p of list) {
    acc += p.weight > 0 ? p.weight : 0;
    if (r <= acc) return p.id;
  }
  return list[0].id;
}

export function retrieveFacts(
  kit: ScenarioKit,
  opts: {
    roleId?: string | null;
    phase?: string | null;
    topK?: number;
    maxLen?: number;
    query?: string | null;
    audience?: 'student' | 'faculty' | null;
  }
): { texts: string[]; ids: string[] } {
  const role = opts.roleId?.toLowerCase() || null;
  const phase = opts.phase?.toLowerCase() || null;
  const topK = typeof opts.topK === 'number' ? Math.max(1, Math.min(8, opts.topK)) : 3;
  const maxLen = typeof opts.maxLen === 'number' ? Math.max(100, Math.min(1200, opts.maxLen)) : 600;
  const q = (opts.query || '').toLowerCase();
  const audience = (opts.audience || 'student') as 'student' | 'faculty';

  // Basic scoring: base = weight, + role/phase bonus, + query term hits
  const scored = kit.chunks
    .filter(ch => {
      if (!Array.isArray(ch.audiences) || ch.audiences.length === 0) return true; // default: visible to all
      return ch.audiences.map(a => String(a).toLowerCase()).includes(audience);
    })
    .map(ch => {
      let score = (typeof ch.weight === 'number' ? ch.weight : 0.5) * 10;
      if (role && Array.isArray(ch.roles) && ch.roles.map(r => r.toLowerCase()).includes(role)) score += 3;
      if (phase && Array.isArray(ch.phases) && ch.phases.map(p => p.toLowerCase()).includes(phase)) score += 3;
      if (q && typeof ch.text === 'string') {
        const words = q.split(/\s+/).filter(Boolean);
        for (const w of words) if (ch.text.toLowerCase().includes(w)) score += 1;
      }
      return { id: ch.id, text: ch.text, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Shape length budget
  const outTexts: string[] = [];
  const outIds: string[] = [];
  let remaining = maxLen;
  for (const s of scored) {
    const t = String(s.text || '').trim();
    if (!t) continue;
    // Keep short facts; skip if would exceed budget by > 25%
    if (t.length > remaining * 1.25) continue;
    outTexts.push(t);
    outIds.push(s.id);
    remaining -= t.length;
    if (remaining <= 50) break;
  }

  return { texts: outTexts, ids: outIds };
}

export function formatRetrievedFacts(facts: string[]): string {
  if (!facts.length) return '';
  const lines = ['Retrieved case facts (for grounding):'];
  for (const f of facts) lines.push(`- ${f}`);
  return lines.join('\n');
}
