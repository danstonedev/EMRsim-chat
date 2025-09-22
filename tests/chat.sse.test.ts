import { describe, it, expect } from 'vitest'

// This test expects the dev server running on 3001.
// It verifies that the /api/chat endpoint returns multiple SSE chunks for a simple prompt.
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001'

describe.skip('SSE streaming from /api/chat (manual)', () => {
  it('emits multiple data chunks', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pt-scenario': 'lowBackPain' },
      body: JSON.stringify({ message: 'Say hello in two sentences', history: [] })
    })
    expect(res.ok).toBe(true)
    expect(res.headers.get('content-type') || '').toContain('text/event-stream')
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let chunkCount = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        const txt = decoder.decode(value)
        const lines = txt.split(/\r?\n/) as string[]
        for (const line of lines) {
          if (line.startsWith('data: ') && line.slice(6).trim().length > 0) chunkCount++
        }
      }
    }
    expect(chunkCount).toBeGreaterThan(1)
  }, 15000)
})
