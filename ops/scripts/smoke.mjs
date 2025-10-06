#!/usr/bin/env node
// Simple end-to-end smoke test for the backend API
// Usage: node ops/scripts/smoke.mjs [baseUrl]
// Defaults to http://localhost:3001

const BASE = process.argv[2] || 'http://localhost:3001';

function log(step, obj) {
  const time = new Date().toISOString();
  console.log(`[${time}] ${step}:`, obj);
}

async function expectOk(r, label) {
  if (!r.ok) {
    const text = await r.text().catch(()=> '');
    throw new Error(`${label} http ${r.status} ${text}`);
  }
  return r;
}

async function* readSseStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = chunk.split('\n');
      const ev = lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
      const dataLine = lines.find(l=>l.startsWith('data:'));
      if (!ev || !dataLine) continue;
      const data = JSON.parse(dataLine.slice(5));
      yield { event: ev, data };
    }
  }
}

(async () => {
  const start = Date.now();
  log('START', { base: BASE });

  // Health
  const health = await expectOk(await fetch(`${BASE}/api/health`), 'health');
  const healthJson = await health.json();
  log('HEALTH', healthJson);

  // Personas
  const personas = await expectOk(await fetch(`${BASE}/api/personas`), 'personas');
  const personasJson = await personas.json();
  if (!Array.isArray(personasJson) || personasJson.length === 0) throw new Error('no personas');
  const personaId = personasJson[0].id;
  log('PERSONAS', { count: personasJson.length, chosen: personaId });

  // Session create (text)
  const sessionResp = await expectOk(await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, mode: 'text' })
  }), 'create_session');
  const { session_id } = await sessionResp.json();
  log('SESSION_CREATED', { session_id });

  // Stream a message
  const msgResp = await expectOk(await fetch(`${BASE}/api/sessions/${session_id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello, who are you?' })
  }), 'stream_message');
  const src = msgResp.headers.get('x-reply-source') || 'unknown';
  const openaiErr = msgResp.headers.get('x-openai-error') || null;

  let received = '';
  for await (const { event, data } of readSseStream(msgResp.body)) {
    if (event === 'delta') received += data.delta_text || '';
    if (event === 'done') break;
  }
  if (!received) throw new Error('no assistant output');
  log('STREAM_OK', { received_len: received.length, source: src, openai_error: openaiErr });

  // End session
  const endResp = await expectOk(await fetch(`${BASE}/api/sessions/${session_id}/end`, { method: 'POST' }), 'end_session');
  const endJson = await endResp.json();
  log('SESSION_ENDED', endJson);

  const durMs = Date.now() - start;
  log('PASS', { duration_ms: durMs });
  process.exit(0);
})().catch(err => {
  console.error('SMOKE_FAIL', err?.stack || String(err));
  process.exit(1);
});
