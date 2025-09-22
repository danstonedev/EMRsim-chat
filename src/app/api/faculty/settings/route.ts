import { NextResponse } from 'next/server'
import { getFacultySettings, updateFacultySettings } from '@/lib/config/faculty'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const cfg = getFacultySettings()
    return NextResponse.json(cfg)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const allowed: any = {}
    if (typeof body.scenarioId === 'string') allowed.scenarioId = body.scenarioId
    if (typeof body.enableClientScenario === 'boolean') allowed.enableClientScenario = body.enableClientScenario
    if (typeof body.enableClientSystemPrompt === 'boolean') allowed.enableClientSystemPrompt = body.enableClientSystemPrompt
    const updated = updateFacultySettings(allowed)
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
