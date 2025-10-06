import { http, HttpResponse } from 'msw';

// Basic in-memory state to simulate SPS session progression
let sessionId = 'sess-msw-1';
let phase = 'subjective';
let greeted = false;
let gate = { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false };

export const handlers = [
  http.get('*/api/sps/personas', () => {
    return HttpResponse.json({ personas: [{ id: 'p1', display_name: 'Persona One', headline: 'Curious and engaged', voice: 'alloy', tags: ['student', 'outpatient'] }] });
  }),
  // Voices list for Advanced Settings drawer
  http.get('*/api/voice/voices', () => {
    return HttpResponse.json({ voices: ['alloy', 'ash', 'ballad'] });
  }),
  http.get('*/api/sps/scenarios', () => {
    return HttpResponse.json({ scenarios: [{ scenario_id: 'sc1', title: 'Case One', region: 'hip', difficulty: 'easy', setting: 'outpatient', tags: [] }] });
  }),
  http.get('*/api/sps/instructions', () => {
    return HttpResponse.json({ instructions: 'Gold standard instructions' });
  }),
  http.post('*/api/sessions', async ({ request }: any) => {
    const payload = await request.json();
    sessionId = payload?.persona_id ? `sess-${payload.persona_id}` : 'sess-msw-1';
    phase = 'subjective';
    greeted = false;
    gate = { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false };
    return HttpResponse.json({ session_id: sessionId, sps_session_id: sessionId, phase, gate, gate_state: 'UNLOCKED' }, { status: 201 });
  }),
  http.post('*/api/sessions/:id/sps/turns', async ({ request, params }: any) => {
    const body = await request.json();
    const turns = Array.isArray(body.turns) ? body.turns : [];
    const session = params?.id || sessionId;
    let saved = 0;
    for (const turn of turns) {
      if (turn?.role === 'assistant') {
        if (/name/i.test(turn.text || '')) gate.identity_verified = true;
      } else if (turn?.role === 'user') {
        const text = String(turn.text || '').toLowerCase();
        if (!greeted && /hi|hello/.test(text)) {
          greeted = true;
          gate.greeting_done = true;
        }
      }
      saved += 1;
    }
    return HttpResponse.json({ ok: true, received: turns.length, saved, duplicates: 0, session }, { status: 201 });
  }),
];
