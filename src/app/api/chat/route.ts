import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

type HistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase()

  // Clone first so we can optionally read as JSON if needed
  const reqClone = req.clone()
  // Read raw text once to avoid body-stream reuse issues
  const raw = await req.text().catch(() => '')

    if (process.env.NODE_ENV !== 'production') {
      console.log('POST /api/chat incoming:', { ct, rawPreview: raw.slice(0, 200) })
    }

    let message: string | null = null
    let systemPrompt: string | null = null
    let history: HistoryMessage[] = []

    if (ct.includes('application/json') || (raw.trim().startsWith('{') && raw.trim().endsWith('}'))) {
      let body: any = null
      // Try parse from raw first
      if (raw) {
        try {
          body = JSON.parse(raw)
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Failed to parse raw JSON body:', e)
          }
        }
      }
      // Fallback to reading JSON from the cloned request (helps in quirky clients)
      if (!body) {
        try {
          body = await reqClone.json()
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Failed to parse cloned JSON body:', e)
          }
        }
      }
      if (body && typeof body === 'object') {
        if (typeof body.message === 'string') message = body.message
        if (typeof body.systemPrompt === 'string') systemPrompt = body.systemPrompt
        if (Array.isArray(body.history)) {
          history = body.history.filter(
            (m: any) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant' || m.role === 'system')
          )
        }
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw)
      const msg = params.get('message')
      if (msg) message = msg
      const sp = params.get('systemPrompt')
      if (sp) systemPrompt = sp
    } else if (raw) {
      // Treat plain text as the message
      message = raw
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('POST /api/chat parsed:', { message, hasHistory: history.length > 0 })
    }

    if (!message && history.length === 0) {
      return NextResponse.json({ error: 'No message provided. Include {"message":"..."} in JSON body.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY on server. Add it to .env.local' }, { status: 500 })
    }

    const client = new OpenAI({ apiKey })

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    if (history.length) messages.push(...history)
    if (message) messages.push({ role: 'user', content: message })

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
    })

    const reply = completion.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('API /api/chat error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

