/*
Production smoke test for transcript flow and persona modal data.
Usage:
  node scripts/prod-smoke-test.mjs
Optional env:
  BACKEND_BASE=...   # test only this base
*/

const BACKENDS = process.env.BACKEND_BASE
  ? [process.env.BACKEND_BASE]
  : [
      // Stable production backend alias (preferred)
      'https://vspx-backend.vercel.app',
    ];

const personaId = 'echo-beatrice-king';
const scenarioId = 'sc_hip_tha_anterior_pod0_v1';

async function jfetch(url, opts = {}) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) {
      try { body = await res.json(); } catch {}
    } else {
      try { body = await res.text(); } catch {}
    }
    return { ok: res.ok, status: res.status, headers: Object.fromEntries(res.headers), body };
  } finally {
    clearTimeout(to);
  }
}

async function runOnce(base) {
  const out = { base };
  // health
  out.health = await jfetch(`${base}/api/health`);
  if (!out.health.ok) return out;

  // create session
  const sess = await jfetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, mode: 'sps', scenario_id: scenarioId }),
  });
  out.session = sess;
  const sessionId = sess?.body?.session_id;
  if (!sessionId) return out;

  // save turns
  const now = Date.now();
  out.save = await jfetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/sps/turns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      turns: [
        { role: 'user', text: 'Hi, I am having hip pain when walking.', timestamp_ms: now },
        { role: 'assistant', text: 'Thanks for sharing. Can you tell me where the pain is most intense?', timestamp_ms: now + 5000 },
      ],
    }),
  });

  // fetch turns
  out.turns = await jfetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/turns`);

  // fetch transcript (HTML)
  const tr = await jfetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/transcript`);
  out.transcript = { ok: tr.ok, status: tr.status, length: typeof tr.body === 'string' ? tr.body.length : null };

  // persona detail (powers chat modals)
  out.persona = await jfetch(`${base}/api/sessions/sps/personas/${encodeURIComponent(personaId)}`);

  return out;
}

(async () => {
  const results = [];
  for (const b of BACKENDS) {
    try {
      results.push(await runOnce(b));
    } catch (e) {
      results.push({ base: b, error: String(e && e.message ? e.message : e) });
    }
  }
  console.log(JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
})();
