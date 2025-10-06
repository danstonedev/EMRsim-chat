import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createSession, getSessionById, insertTurn, getSessionTurns, endSession, updateSpsSessionData } from '../db.ts';
import { spsRegistry } from '../sps/core/registry.ts';
import crypto from 'node:crypto';
import { sessions as spsSessions } from '../sps/runtime/store.js';
// Added persona detail endpoint
import { touchPersistence } from '../sps/runtime/persistence.js';
import { logEvent } from '../sps/runtime/telemetry.js';
import type { GateFlags } from '../sps/core/types.js';

export const router = Router();

// Stricter rate limit for session creation
const sessionCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 sessions per 5 minutes per IP
  message: 'Too many sessions created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function newGateFlags(): GateFlags {
  return {
    greeting_done: false,
    intro_done: false,
    consent_done: false,
    identity_verified: false,
    locked_pressure_count: 0,
    supervisor_escalated: false
  };
}

// Naive gating heuristics – pattern detection to auto-set gate flags based on student text
const TURN_FINGERPRINT_VERSION = 'v1';

interface TurnFingerprintParams {
  sessionId: string;
  role: string;
  text: string;
  channel?: string;
  timestampMs?: number;
}

function createTurnFingerprint({ sessionId, role, text, channel, timestampMs }: TurnFingerprintParams): string {
  const normRole = role === 'assistant' ? 'assistant' : 'user';
  const normChannel = channel === 'audio' ? 'audio' : 'text';
  const tsBucket = Number.isFinite(timestampMs) ? Math.round(timestampMs!) : 0;
  const canonicalText = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return crypto
    .createHash('sha256')
    .update([TURN_FINGERPRINT_VERSION, sessionId, normRole, normChannel, tsBucket, canonicalText].join('|'))
    .digest('hex');
}

router.post('/', sessionCreationLimiter, async (req: Request, res: Response) => {
  try {
    const { persona_id, mode, scenario_id } = req.body || {};
    if (!persona_id) return res.status(400).json({ error: 'bad_request', detail: 'persona_id required' });

    // SPS-only enforcement: all new sessions must be SPS.
    if (mode && mode !== 'sps') {
      return res.status(400).json({ error: 'sps_only', detail: 'Only SPS sessions are supported.' });
    }

    // For SPS we require a scenario id.
    if (!scenario_id) return res.status(400).json({ error: 'scenario_id_required_for_sps' });

    if (mode === 'sps' || !mode) {
      // For SPS mode, we need scenario_id and the persona_id refers to SPS persona
      const spsPersona = spsRegistry.personas[persona_id];
      const spsScenario = spsRegistry.scenarios[scenario_id];
      if (!spsPersona) return res.status(404).json({ error: 'sps_persona_not_found' });
      if (!spsScenario) return res.status(404).json({ error: 'sps_scenario_not_found' });
      
      // Compose SPS encounter
      const activeCase = spsRegistry.composeActiveCase(persona_id, scenario_id);
      const sps_session_id = crypto.randomUUID();
      const gate = newGateFlags();
      const spsSessionData = {
        activeCase,
        phase: 'subjective' as const,
        gate,
        created_at: Date.now(),
        persona_id,
        scenario_id,
        turn_count: 0,
        recent_identity_requests: []
      };
      
      spsSessions.set(sps_session_id, spsSessionData);
      console.log('[sessions][sps] composed', sps_session_id, activeCase.id, 'spsSessions.size=', spsSessions.size);
      logEvent('compose', { sps_session_id, persona_id, scenario_id, case_id: activeCase.id });
      touchPersistence();
      
      // Create unified session with SPS data
      const sessionId = createSession(persona_id, mode as any, {
        sps_session_id,
        scenario_id,
        phase: 'subjective',
        gate
      } as any);
      
      return res.status(201).json({ 
        session_id: sessionId,
        sps_session_id,
        phase: 'subjective',
        gate,
        gate_state: 'UNLOCKED'
      });
    }
    // Should not reach here under SPS-only
    return res.status(400).json({ error: 'sps_only' });
  } catch (e) {
    console.error('[sessions][create][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// SPS personas endpoint (for unified persona selection)
router.get('/sps/personas', (req: Request, res: Response) => {
  try {
    const personas = Object.values(spsRegistry.personas).map(p => ({
      id: p.patient_id,
      display_name: p.display_name || p.demographics?.preferred_name || p.demographics?.name || p.patient_id,
      headline: (() => {
        if (p.headline) return p.headline;
        const goals = Array.isArray(p.function_context?.goals) ? p.function_context.goals : [];
        return goals && goals.length ? goals[0] : null;
      })(),
      age: p.demographics?.age,
      sex: p.demographics?.sex,
      voice: p.voice_id || p.dialogue_style?.voice_id || null,
      tags: Array.isArray(p.tags) ? p.tags : undefined,
      type: 'sps'
    }));
    res.json({ personas });
  } catch (e) {
    console.error('[sessions][sps-personas][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// SPS scenarios endpoint
router.get('/sps/scenarios', (req: Request, res: Response) => {
  try {
    const scenarios = Object.values(spsRegistry.scenarios).map(s => ({
      scenario_id: s.scenario_id,
      title: s.title,
      region: s.region,
      difficulty: s.difficulty,
      setting: s.setting,
      tags: s.tags || [],
      persona_id: s.linked_persona_id || s.persona_snapshot?.id || null,
      persona_name: s.persona_snapshot?.display_name || null,
      persona_headline: s.persona_snapshot?.headline || null,
    }));
    res.json({ scenarios });
  } catch (e) {
    console.error('[sessions][sps-scenarios][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get single persona by ID
router.get('/sps/personas/:id', (req: Request, res: Response) => {
  try {
    const personaId = req.params.id;
    const persona = spsRegistry.personas[personaId];
    
    if (!persona) {
      return res.status(404).json({ error: 'persona_not_found' });
    }
    
    res.json({ persona });
  } catch (e) {
    console.error('[sessions][sps-persona-detail][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Advance SPS phase
router.post('/:id/sps/phase', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const { signal } = req.body || {};
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.mode !== 'sps') return res.status(400).json({ error: 'not_sps_session' });
    if (!session.sps_session_id) return res.status(400).json({ error: 'missing_sps_session_id' });
    
    const spsSession = spsSessions.get(session.sps_session_id);
    if (!spsSession) return res.status(404).json({ error: 'sps_session_not_found' });
    
    // Import nextPhase function
    const { nextPhase } = await import('../sps/runtime/sps.service.ts');
    const next = nextPhase(spsSession.phase, signal);
    spsSession.phase = next;
    
    console.log('[sessions][sps][phase]', session.sps_session_id, '->', next, 'signal=', signal);
    logEvent('phase', { sps_session_id: session.sps_session_id, to: next, signal });
    updateSpsSessionData(sessionId, { 
      sps_session_id: session.sps_session_id || '', 
      scenario_id: session.sps_scenario_id || '', 
      phase: next, 
      gate: spsSession.gate 
    });
    touchPersistence();
    
    res.json({ phase: next });
  } catch (e) {
    console.error('[sessions][sps-phase][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// End session
router.post('/:id/end', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  const session = getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  
  // Clean up SPS session if it exists
  if (session.mode === 'sps' && session.sps_session_id) {
    spsSessions.delete(session.sps_session_id);
    console.log('[sessions][sps][cleanup]', session.sps_session_id, 'spsSessions.size=', spsSessions.size);
  }
  
  endSession(sessionId);
  res.json({ summary: 'ended', metrics: {} });
});

// Persist finalized SPS turns for a session (lightweight persistence API for unified Realtime flows)
// POST /api/sessions/:id/sps/turns
// Body: { turns: Array<{ role: 'user'|'assistant'; text: string; channel?: 'text'|'audio'; timestamp_ms?: number }> }
router.post('/:id/sps/turns', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!sessionId) return res.status(400).json({ error: 'bad_request' });
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.mode !== 'sps') return res.status(400).json({ error: 'not_sps_session' });
    const body = req.body || {};
    const turns = Array.isArray(body.turns) ? body.turns : [];
    if (!turns.length) return res.status(400).json({ error: 'no_turns' });

    let saved = 0;
    let duplicates = 0;
    const seen = new Set<string>();

    for (const t of turns) {
      const role = t?.role === 'assistant' ? 'assistant' : 'user';
      const originalText = typeof t?.text === 'string' ? t.text : '';
      const trimmedText = originalText.trim();
      if (!trimmedText) continue;
      const channel = t?.channel === 'audio' ? 'audio' : 'text';

      const normalizeMs = (value: unknown): number | undefined => {
        const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
        return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
      };

      const finalizedMs = normalizeMs(t?.finalized_at_ms ?? t?.timestamp_ms);
      const startedMs = normalizeMs(t?.started_at_ms);
      const emittedMs = normalizeMs(t?.emitted_at_ms ?? t?.timestamp_ms);

      const fingerprintTimestamp = startedMs ?? finalizedMs ?? emittedMs;
      const fingerprint = createTurnFingerprint({ sessionId, role, text: trimmedText, channel, timestampMs: fingerprintTimestamp });

      if (seen.has(fingerprint)) {
        duplicates++;
        console.log('[sessions][sps][turns] Duplicate detected in request batch:', {
          role,
          channel,
          textPreview: trimmedText.slice(0, 50),
          startedMs,
          finalizedMs,
          emittedMs,
        });
        continue;
      }
      seen.add(fingerprint);

      try {
        const result = insertTurn(sessionId, role, trimmedText, {
          fingerprint,
          channel,
          timestamp_ms: finalizedMs ?? emittedMs,
          started_timestamp_ms: startedMs,
          finalized_timestamp_ms: finalizedMs,
          emitted_timestamp_ms: emittedMs,
        });
        if (result?.created) {
          saved++;
          console.log('[sessions][sps][turns] Saved turn:', {
            role,
            channel,
            textLength: trimmedText.length,
            startedMs,
            finalizedMs,
            emittedMs,
          });
        } else {
          duplicates++;
          console.log('[sessions][sps][turns] Duplicate detected in DB:', {
            role,
            channel,
            textPreview: trimmedText.slice(0, 50),
            startedMs,
            finalizedMs,
            emittedMs,
          });
        }
      } catch (e) {
        console.error('[sessions][sps][turns][persist][error]', e);
        return res.status(500).json({ error: 'internal_error' });
      }
    }

    return res.status(201).json({ ok: true, received: turns.length, saved, duplicates });
  } catch (e) {
    console.error('[sessions][sps][turns][error]', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Get transcript for a session (printable HTML format)
// GET /api/sessions/:id/transcript
router.get('/:id/transcript', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!sessionId) return res.status(400).json({ error: 'bad_request' });
    
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    
    const turns = getSessionTurns(sessionId);
    const escapeHtml = (s: string) => String(s || '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c as '&' | '<' | '>'] || c));
    
    // Get persona and scenario info for the header (SPS sessions only)
    const persona = session.mode === 'sps' ? spsRegistry.personas[session.persona_id] : null;
    const scenario = session.sps_scenario_id ? spsRegistry.scenarios[session.sps_scenario_id] : null;
    
    const personaName = persona?.display_name || persona?.demographics?.preferred_name || session.persona_id;
    const scenarioTitle = scenario?.title || 'Unknown Scenario';
    const sessionDate = new Date(session.started_at || Date.now()).toLocaleDateString();
    
    // Build compact, script-style HTML: Role label + text in a single line/grid
    const turnsHtml = turns.map((turn: any, index: number) => {
      const roleLabel = turn.role === 'user' ? 'Student' : 'Patient';
      const text = escapeHtml(turn.text || '');
      const timestamp = turn.created_at ? new Date(turn.created_at).toLocaleTimeString() : '';
      
      // Debug: log the order and timestamps
      console.log(`[transcript] Turn ${index + 1}: ${turn.role} at ${turn.created_at} - "${text.slice(0, 30)}"`);
      
      return `
        <div class="line" role="listitem">
          <div class="who who--${turn.role}">${escapeHtml(roleLabel)}:</div>
          <div class="txt">${text}</div>
        </div>
      `;
    }).join('');
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Encounter Transcript: ${escapeHtml(scenarioTitle)} · ${escapeHtml(personaName)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    /* Base */
    :root { --und-green: #009A44; --student-blue: #0b5fff; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; color: #111; line-height: 1.35; font-size: 13px; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    .meta { color: #555; margin-bottom: 16px; font-size: 12px; }
    .no-print { margin-bottom: 12px; }
    .btn { display: inline-block; padding: 6px 12px; background: #0d6efd; color: #fff; border-radius: 6px; text-decoration: none; font-size: 13px; }
    .btn:hover { background: #0b5ed7; }

    /* Script layout */
    .transcript { display: block; }
    .line { display: grid; grid-template-columns: 76px 1fr; column-gap: 10px; align-items: start; margin: 0 0 6px; padding: 0; break-inside: avoid; }
    .who { font-weight: 700; text-align: right; white-space: nowrap; }
    .who--assistant { color: var(--und-green); }
    .who--user { color: var(--student-blue); }
    .txt { white-space: pre-wrap; }

    /* Print tweaks */
    @media print {
      .no-print { display: none; }
      body { margin: 10mm 12mm; font-size: 11.5px; line-height: 1.35; }
      .line { margin-bottom: 5px; }
    }
  </style>
  <script>function doPrint(){ window.print(); }</script>
</head>
<body>
  <div class="no-print">
    <a class="btn" href="#" onclick="doPrint();return false;">Print Transcript</a>
  </div>
  <h1>Encounter Transcript</h1>
  <div class="meta">Patient: ${escapeHtml(personaName)} · Scenario: ${escapeHtml(scenarioTitle)} · Date: ${sessionDate} · Session ID: ${escapeHtml(sessionId)}</div>

  <div class="transcript" role="list">
    ${turnsHtml || '<p><em>No conversation recorded yet.</em></p>'}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('[sessions][transcript][error]', e);
    res.status(500).json({ error: 'internal_error' });
  }
});
