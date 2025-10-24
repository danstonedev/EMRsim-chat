#!/usr/bin/env node
// Simple local smoke script to exercise /api/sessions and /api/voice/instructions
// Usage (PowerShell):
//   node scripts/local-instructions-smoke.mjs --scenario sc_knee_anterior_knee_pain_entry_v1 --aud student

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.startsWith('--') ? a.slice(2).split('=') : [a, 'true']
    return [k, v ?? 'true']
  })
)

const BASE = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3002'
const SCENARIO = args.scenario || 'sc_knee_anterior_knee_pain_entry_v1'
const AUDIENCE = args.aud || 'student' // 'student' | 'faculty'

async function fetchJson(url, init = {}) {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} ${url}`)
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return r.text()
  return r.json()
}

async function main() {
  console.log('[smoke] BASE =', BASE)
  // 1) Pick a persona (first available)
  const personas = await fetchJson(`${BASE}/api/sps/personas`)
  const list = Array.isArray(personas?.personas) ? personas.personas : personas
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No personas available at /api/sps/personas')
  }
  const persona = list[0]
  console.log('[smoke] Using persona:', persona.id, '-', persona.display_name || '(no name)')

  // 2) Create a session
  const create = await fetchJson(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: persona.id, scenario_id: SCENARIO, mode: 'sps' }),
  })
  const sessionId = create?.session_id
  if (!sessionId) throw new Error('Failed to create session (missing session_id)')
  console.log('[smoke] Created session:', sessionId)

  // 3) Request voice instructions for both audiences if not forced
  const audiences = args.aud ? [AUDIENCE] : ['student', 'faculty']
  for (const aud of audiences) {
    const res = await fetchJson(`${BASE}/api/voice/instructions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, audience: aud })
    })
    const snippet = String(res?.instructions || '').slice(0, 240).replace(/\s+/g, ' ')
    const retrieved = Array.isArray(res?.retrieved_ids) ? res.retrieved_ids : []
    console.log(`\n[smoke] Audience=${aud}`)
    console.log('Phase:', res?.phase || '(n/a)')
    console.log('Retrieved IDs:', retrieved.join(', ') || '(none)')
    console.log('Instructions snippet:', snippet || '(empty)')
  }

  console.log('\n[smoke] Done.')
}

// Node 18+ has global fetch
if (typeof fetch !== 'function') {
  globalThis.fetch = (await import('node-fetch')).default
}

main().catch((err) => {
  console.error('[smoke] ERROR:', err?.message || err)
  process.exit(1)
})
