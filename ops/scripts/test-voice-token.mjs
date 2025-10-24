#!/usr/bin/env node

const base = process.env.EMRSIM_API_BASE || 'http://127.0.0.1:3001'

async function main() {
  try {
    const personasRes = await fetch(`${base}/api/personas`)
    if (!personasRes.ok) {
      throw new Error(`personas request failed: ${personasRes.status}`)
    }
    const personas = await personasRes.json()
    if (!Array.isArray(personas) || personas.length === 0) {
      throw new Error('no personas available')
    }
    const personaId = personas[0].id

    const sessionRes = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId, mode: 'voice' }),
    })
    const sessionBody = await sessionRes.text()
    if (!sessionRes.ok) {
      throw new Error(`create session failed: ${sessionRes.status} ${sessionBody}`)
    }
    const { session_id: sessionId } = JSON.parse(sessionBody)
    if (!sessionId) {
      throw new Error('missing session_id in response')
    }

    const tokenRes = await fetch(`${base}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
    const tokenBody = await tokenRes.text()
    console.log('[voice-token] status', tokenRes.status)
    console.log('[voice-token] body', tokenBody)
    if (!tokenRes.ok) {
      process.exitCode = 1
    }
  } catch (err) {
    console.error('[voice-token] error', err)
    process.exitCode = 1
  }
}

main()
