import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data with field "audio"' }, { status: 400 })
    }

    const form = await req.formData()
    const audio = form.get('audio') as File | null
    if (!audio) {
      return NextResponse.json({ error: 'Missing audio file in field "audio"' }, { status: 400 })
    }

    const client = new OpenAI({ apiKey })

    // OpenAI Whisper transcription
    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: await fileFromBlob(audio),
      response_format: 'json',
      temperature: 0
    } as any)

    const text = (transcription as any).text || ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('POST /api/transcribe error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}

async function fileFromBlob(blob: Blob): Promise<File> {
  // Some runtimes provide a File already; if so, return it
  if (typeof (globalThis as any).File !== 'undefined' && blob instanceof File) {
    return blob
  }
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  // Create a File-like object compatible with OpenAI SDK node fetch
  return new File([bytes], 'audio.webm', { type: blob.type || 'audio/webm' })
}
