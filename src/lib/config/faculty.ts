// Simple in-memory faculty-configured settings for PT scenarios.
// In production, replace with a database or durable store.

export type FacultySettings = {
  // Active PT scenario id (matches keys in ptCases)
  scenarioId: string
  // Allow client-specified scenario (for student testing) when true
  enableClientScenario: boolean
  // Allow client systemPrompt override (not recommended)
  enableClientSystemPrompt: boolean
}

const DEFAULTS: FacultySettings = {
  scenarioId: process.env.DEFAULT_PT_SCENARIO || 'lowBackPain',
  enableClientScenario: process.env.ENABLE_CLIENT_SCENARIO
    ? (process.env.ENABLE_CLIENT_SCENARIO || '').toLowerCase() === 'true'
    : true,
  enableClientSystemPrompt: (process.env.ENABLE_CLIENT_SYSTEM_PROMPT || '').toLowerCase() === 'true',
}

let current: FacultySettings = { ...DEFAULTS }

export function getFacultySettings(): FacultySettings {
  return { ...current }
}

export function updateFacultySettings(patch: Partial<FacultySettings>): FacultySettings {
  current = { ...current, ...patch }
  return getFacultySettings()
}
