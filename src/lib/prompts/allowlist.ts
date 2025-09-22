import { getPTPrompt } from './ptCases'

// Server-side strict allowlist of valid scenario IDs.
// Only these IDs can be requested by clients; unknown IDs fall back to default.
export const ALLOWED_SCENARIOS = [
  'lowBackPain',
  'aclRehab',
  'rotatorCuff',
  'strokeGait',
  'ankleSprain',
] as const

export type AllowedScenarioId = typeof ALLOWED_SCENARIOS[number]

export function isAllowedScenario(id: string | undefined | null): id is AllowedScenarioId {
  return !!id && (ALLOWED_SCENARIOS as readonly string[]).includes(id)
}

// Resolve the patient persona (system) prompt by scenario ID with allowlist enforcement.
export function resolvePersonaPromptByScenarioId(id?: string): string {
  const safeId = isAllowedScenario(id || undefined) ? id : undefined
  return getPTPrompt(safeId)
}
