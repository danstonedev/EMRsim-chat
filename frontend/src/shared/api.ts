import type { MediaReference } from './types';
import type { ClinicalScenarioV3, ScenarioSourceLite } from './types/scenario';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
export const API_BASE_URL = BASE;

function toMs(v: unknown, def: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

const DEFAULT_TIMEOUT_MS = toMs((import.meta as any)?.env?.VITE_API_TIMEOUT_MS, 15000);

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const r = await fetch(input, { ...init, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(timeout);
  }
}

type HealthResponse = {
  ok: boolean;
  uptime_s: number;
  db: string;
  openai: 'ok' | 'err';
  storage?: 'sqlite' | 'memory';
  warnings?: string[];
  features?: {
    voiceEnabled?: boolean;
    spsEnabled?: boolean;
    voiceDebug?: boolean;
  };
};

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const r = await fetchWithTimeout(`${BASE}/api/health`);
    if (!r.ok) throw new Error(`health_http_${r.status}`);
  return (await r.json()) as HealthResponse;
  },
  async getVoiceInstructions(
    sessionId: string,
    options?: { phase?: string | null; gate?: Record<string, unknown> | null }
  ): Promise<{ instructions: string; phase?: string; outstanding_gate?: string[] }> {
    const body: any = { session_id: sessionId };
    if (options && Object.prototype.hasOwnProperty.call(options, 'phase')) body.phase = options.phase;
    if (options && Object.prototype.hasOwnProperty.call(options, 'gate')) body.gate = options.gate;
    const r = await fetchWithTimeout(`${BASE}/api/voice/instructions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`voice_instructions_http_${r.status}_${txt}`);
    }
  return (await r.json()) as { instructions: string; phase?: string; outstanding_gate?: string[] };
  },
  async saveSpsTurns(
    sessionId: string,
    turns: Array<{
      role: 'user' | 'assistant';
      text: string;
      channel?: 'text' | 'audio';
      timestamp_ms?: number;
      started_at_ms?: number;
      emitted_at_ms?: number;
      finalized_at_ms?: number;
    }>
  ): Promise<{ ok: boolean; saved: number; received?: number; duplicates?: number }> {
    const r = await fetchWithTimeout(`${BASE}/api/sessions/${encodeURIComponent(sessionId)}/sps/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`sps_turns_http_${r.status}_${txt}`);
    }
  const data = (await r.json()) as { ok?: boolean; saved?: number; received?: number; duplicates?: number };
    const saved = typeof data?.saved === 'number' ? data.saved : 0;
    const received = typeof data?.received === 'number' ? data.received : undefined;
    const duplicates = typeof data?.duplicates === 'number' ? data.duplicates : undefined;
    return { ok: Boolean(data?.ok), saved, received, duplicates };
  },
  async createSession(
    persona_id: string,
    scenario_id: string
  ): Promise<{ session_id: string; sps_session_id?: string; phase?: string; gate?: any; gate_state?: string }> {
    const r = await fetchWithTimeout(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id, scenario_id, mode: 'sps' }),
    });
    if (!r.ok) {
      let bodyTxt = '';
      try {
        bodyTxt = await r.text();
      } catch { }
      // Try to extract an error code from JSON if present
      try {
        const obj = JSON.parse(bodyTxt);
        if (obj && obj.error) throw new Error(String(obj.error));
      } catch { }
      throw new Error(`http_${r.status}_${bodyTxt || 'create_session_failed'}`);
    }
  return (await r.json()) as { session_id: string; sps_session_id?: string; phase?: string; gate?: any; gate_state?: string };
  },
  async endSession(sessionId: string): Promise<{ summary?: string; metrics?: unknown }> {
    const r = await fetchWithTimeout(`${BASE}/api/sessions/${encodeURIComponent(sessionId)}/end`, { method: 'POST' });
    if (!r.ok) {
      let bodyTxt = '';
      try {
        bodyTxt = await r.text();
      } catch { }
      throw new Error(`end_http_${r.status}_${bodyTxt}`);
    }
  return (await r.json()) as { summary?: string; metrics?: unknown };
  },
  async getVoiceToken(
    sessionId: string,
    overrides?: {
      voice?: string;
      input_language?: string;
      model?: string;
      transcription_model?: string;
      reply_language?: string;
    }
  ): Promise<{
    rtc_token: string;
    model: string;
    tts_voice: string;
    opts?: { expires_at?: string };
    persona?: { id: string; display_name: string | null; speaking_rate: string | null; voice_id: string | null };
  }> {
    const r = await fetchWithTimeout(`${BASE}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, ...overrides }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      let code = 'voice_token_failed';
      try {
        const obj = JSON.parse(txt);
        if (obj && obj.error) code = String(obj.error);
      } catch { }
      throw new Error(`${code} (${r.status}) ${txt}`.trim());
    }
    return (await r.json()) as {
      rtc_token: string;
      model: string;
      tts_voice: string;
      opts?: { expires_at?: string };
      persona?: { id: string; display_name: string | null; speaking_rate: string | null; voice_id: string | null };
    };
  },
  async getSessionTurns(sessionId: string): Promise<Array<{
    id: string;
    role: string;
    text: string;
    created_at: string;
    timestamp: number;
  }>> {
    const r = await fetchWithTimeout(`${BASE}/api/sessions/${sessionId}/turns`);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`get_turns_http_${r.status}_${txt}`);
    }
  const data = (await r.json()) as { turns?: Array<{ id: string; role: string; text: string; created_at: string; timestamp: number }>; };
    return Array.isArray(data?.turns) ? data.turns : [];
  },
  async getVoiceVoices(): Promise<string[]> {
    const r = await fetchWithTimeout(`${BASE}/api/voice/voices`);
    if (!r.ok) throw new Error('voice_voices_http_' + r.status);
  const data = (await r.json().catch(() => ({}))) as Partial<{ voices: string[] }>;
  return Array.isArray(data.voices) ? data.voices : [];
  },
  async postVoiceSdp(sessionId: string, sdp: string): Promise<string> {
    const r = await fetchWithTimeout(`${BASE}/api/voice/sdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, sdp }),
      timeoutMs: 30000, // WebRTC negotiation can take time
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`voice_sdp_http_${r.status}_${txt}`);
    }
    // Backend returns plain text SDP answer
  return (await r.text()) as string;
  },
  async relayTranscript(
    sessionId: string,
    transcript: {
      role: 'user' | 'assistant';
      text: string;
      isFinal: boolean;
      timestamp: number;
      itemId?: string;
      startedAt?: number | null;
      finalizedAt?: number | null;
      emittedAt?: number | null;
      media?: MediaReference | null;
      source?: string;
    }
  ): Promise<{ ok: boolean }> {
    const url = `${BASE}/api/transcript/relay/${encodeURIComponent(sessionId)}`;
    if (import.meta.env.DEV) {
      console.debug('[API] 🚀 relayTranscript called:', {
        url,
        role: transcript.role,
        isFinal: transcript.isFinal,
        textLength: transcript.text.length,
        sessionId: sessionId.slice(-6),
        timings: {
          startedAt: transcript.startedAt,
          emittedAt: transcript.emittedAt,
          finalizedAt: transcript.finalizedAt,
        },
        hasMedia: Boolean(transcript.media),
        source: transcript.source,
      });
    }

    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcript),
    });

    if (import.meta.env.DEV) {
      console.debug('[API] 📡 relayTranscript response:', {
        status: r.status,
        ok: r.ok,
        statusText: r.statusText,
      });
    }

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`transcript_relay_http_${r.status}_${txt}`);
    }
    // Backend returns 204 (no content), so return success object
    return { ok: true };
  },
  // SPS Scenario Management
  async generateSpsScenario(
    prompt: string,
    options?: { region?: string; difficulty?: string; setting?: string; research?: boolean; save?: boolean }
  ): Promise<{ ok: boolean; scenario: ClinicalScenarioV3; sources?: ScenarioSourceLite[] }> {
    // AI generation can take 30-60s, especially with web research enabled
    const r = await fetchWithTimeout(`${BASE}/api/sps/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, options, save: options?.save }),
      timeoutMs: 90000,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`sps_generate_http_${r.status}_${txt}`);
    }
  const data = (await r.json()) as { ok?: boolean; scenario?: ClinicalScenarioV3; sources?: ScenarioSourceLite[] };
    if (!data?.scenario) {
      throw new Error('sps_generate_missing_scenario');
    }
    const sourcesRaw = Array.isArray(data?.sources) ? data.sources : undefined;
    return {
      ok: Boolean(data?.ok),
      scenario: data.scenario as ClinicalScenarioV3,
      sources: sourcesRaw as ScenarioSourceLite[] | undefined,
    };
  },
  async saveSpsScenario(scenario: ClinicalScenarioV3): Promise<{ ok: boolean; scenario_id: string }> {
    const r = await fetchWithTimeout(`${BASE}/api/sps/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`sps_save_http_${r.status}_${txt}`);
    }
  const data = (await r.json()) as { ok: boolean; scenario_id: string };
    return data;
  },
  async listSpsScenarios(): Promise<
    Array<{
      scenario_id: string;
      title: string;
      region: string;
      difficulty?: string | null;
      setting?: string | null;
      tags?: string[];
      persona_id?: string | null;
      persona_name?: string | null;
      persona_headline?: string | null;
    }>
  > {
    const r = await fetchWithTimeout(`${BASE}/api/sps/scenarios`);
    if (!r.ok) throw new Error(`sps_list_http_${r.status}`);
  const data = (await r.json()) as { scenarios?: Array<{ scenario_id: string; title: string; region: string; difficulty?: string | null; setting?: string | null; tags?: string[]; persona_id?: string | null; persona_name?: string | null; persona_headline?: string | null }>; };
    return Array.isArray(data?.scenarios) ? data.scenarios : [];
  },
  async getSpsScenarios(): Promise<
    Array<{
      scenario_id: string;
      title: string;
      region: string;
      difficulty?: string | null;
      setting?: string | null;
      tags?: string[];
      persona_id?: string | null;
      persona_name?: string | null;
      persona_headline?: string | null;
    }>
  > {
    // Alias for listSpsScenarios for backward compatibility
    return this.listSpsScenarios();
  },
  async getSpsPersonas(): Promise<
    Array<{
      id: string;
      display_name: string | null;
      headline: string | null;
      age?: number | null;
      sex?: string | null;
      voice?: string | null;
      tags?: string[];
    }>
  > {
    const r = await fetchWithTimeout(`${BASE}/api/sps/personas`);
    if (!r.ok) throw new Error(`sps_personas_http_${r.status}`);
  const data = (await r.json()) as { personas?: Array<{ id: string; display_name: string | null; headline: string | null; age?: number | null; sex?: string | null; voice?: string | null; tags?: string[] }>; };
    return Array.isArray(data?.personas) ? data.personas : [];
  },
  async getSpsScenarioById(scenarioId: string): Promise<ClinicalScenarioV3 | null> {
    const r = await fetchWithTimeout(`${BASE}/api/sps/scenarios/${scenarioId}`);
    if (!r.ok) throw new Error(`sps_scenario_http_${r.status}`);
  const data = (await r.json()) as { scenario?: ClinicalScenarioV3 | null };
    return (data?.scenario as ClinicalScenarioV3 | null) || null;
  },
  async getSpsPersonaById(personaId: string): Promise<any> {
    const r = await fetchWithTimeout(`${BASE}/api/sps/personas/${personaId}`);
    if (!r.ok) throw new Error(`sps_persona_http_${r.status}`);
  const data = (await r.json()) as { persona?: any };
    return data?.persona || null;
  },
  openSpsExport(personaId: string | null, scenarioId: string | null): void {
    if (!personaId || !scenarioId) return;
    const url = `${BASE}/api/sps/export?persona_id=${encodeURIComponent(personaId)}&scenario_id=${encodeURIComponent(scenarioId)}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = url;
    }
  },
  openTranscriptExport(sessionId: string | null): void {
    if (!sessionId) return;
    const url = `${BASE}/api/sessions/${encodeURIComponent(sessionId)}/transcript`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = url;
    }
  },
};
