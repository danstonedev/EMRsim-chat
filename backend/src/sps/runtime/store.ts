import type { ActiveCase, GateFlags, EncounterPhase } from '../core/types.ts';
import type { SPSRegistry } from '../core/registry.ts';

export interface SPSSession {
  activeCase: ActiveCase;
  phase: EncounterPhase;
  gate: GateFlags;
  created_at: number;
  persona_id: string;
  scenario_id: string;
  turn_count?: number;
  recent_identity_requests?: unknown[];
}

export interface SerializedSession {
  sps_session_id: string;
  persona_id: string;
  scenario_id: string;
  phase: EncounterPhase;
  gate: GateFlags;
  created_at: number;
}

export interface HydratedSessionRecord {
  sps_session_id: string;
  persona_id: string;
  scenario_id: string;
  phase?: EncounterPhase;
  gate?: GateFlags;
  created_at?: number;
}

// Shared in-memory SPS session store.
// Shape per entry: { activeCase, phase, gate, created_at, persona_id, scenario_id }
export const sessions = new Map<string, SPSSession>();

export function serializeSessions(): SerializedSession[] {
  return [...sessions.entries()].map(([id, v]) => ({
    sps_session_id: id,
    persona_id: v.persona_id,
    scenario_id: v.scenario_id,
    phase: v.phase,
    gate: v.gate,
    created_at: v.created_at,
  }));
}

export function hydrateSession(registry: SPSRegistry, record: HydratedSessionRecord): boolean {
  const { persona_id, scenario_id } = record;
  const persona = registry.personas[persona_id];
  const scenario = registry.scenarios[scenario_id];
  if (!persona || !scenario) return false;
  const activeCase = registry.composeActiveCase(persona_id, scenario_id);
  const gate: GateFlags = record.gate || {
    greeting_done: false,
    intro_done: false,
    consent_done: false,
    identity_verified: false,
  };
  if (typeof gate.locked_pressure_count !== 'number') gate.locked_pressure_count = 0;
  if (typeof gate.supervisor_escalated !== 'boolean') gate.supervisor_escalated = false;
  sessions.set(record.sps_session_id, {
    activeCase,
    phase: record.phase || 'subjective',
    gate,
    created_at: record.created_at || Date.now(),
    persona_id,
    scenario_id,
  });
  return true;
}
