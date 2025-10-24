/*
Quick smoke test targeting a single backend base without requiring env var.
Usage:
  node scripts/prod-smoke-test-single.mjs <BACKEND_BASE_URL>
*/

const base = process.argv[2];
if (!base) {
  console.error('Usage: node scripts/prod-smoke-test-single.mjs <BACKEND_BASE_URL>');
  process.exit(1);
}

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

async function run() {
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

  // persona detail
  out.persona = await jfetch(`${base}/api/sessions/sps/personas/${encodeURIComponent(personaId)}`);

  console.log(JSON.stringify({ when: new Date().toISOString(), result: out }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
