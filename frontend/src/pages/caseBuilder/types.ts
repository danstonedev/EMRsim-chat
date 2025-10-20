import type { ClinicalScenarioV3, ScenarioRegion, ScenarioSourceLite } from '../../shared/types/scenario'

export type ScenarioLite = {
  scenario_id: string
  title: string
  region: string
  difficulty?: string | null
  setting?: string | null
  tags?: string[]
  persona_id?: string | null
  persona_name?: string | null
  persona_headline?: string | null
}

export type PersonaLite = {
  id: string
  display_name: string | null
  headline: string | null
  age?: number | null
  sex?: string | null
  voice?: string | null
  tags?: string[]
}

export type PersonaDetail = Record<string, unknown> & {
  id?: string
  display_name?: string | null
  patient_id?: string | null
  headline?: string | null
}

export type LoadingPreview = { loading: true }
export type ErrorPreview = { error: string }
export type PreviewMode = 'formatted' | 'json'

export type ScenarioPreview = ClinicalScenarioV3 | LoadingPreview | ErrorPreview | null
export type PersonaPreview = PersonaDetail | LoadingPreview | ErrorPreview | null

export const REGION_OPTIONS: Array<{ value: ScenarioRegion; label: string }> = [
  { value: 'hip', label: 'Hip' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle_foot', label: 'Ankle/Foot' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'cervical_spine', label: 'Cervical Spine' },
  { value: 'lumbar_spine', label: 'Lumbar Spine' },
  { value: 'thoracic_spine', label: 'Thoracic Spine' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist_hand', label: 'Wrist/Hand' },
  { value: 'sports_trauma_general', label: 'Sports/Trauma' },
]

export const isLoadingPreview = (preview: ScenarioPreview | PersonaPreview): preview is LoadingPreview => {
  return Boolean(preview && typeof preview === 'object' && 'loading' in preview)
}

export const isErrorPreview = (preview: ScenarioPreview | PersonaPreview): preview is ErrorPreview => {
  return Boolean(preview && typeof preview === 'object' && 'error' in preview && !('loading' in preview))
}

export const isScenarioData = (preview: ScenarioPreview): preview is ClinicalScenarioV3 => {
  return Boolean(preview && typeof preview === 'object' && 'scenario_id' in preview)
}

export const isPersonaData = (preview: PersonaPreview): preview is PersonaDetail => {
  if (!preview || typeof preview !== 'object') return false
  return 'display_name' in preview || 'patient_id' in preview || 'id' in preview
}

export type { ClinicalScenarioV3, ScenarioRegion, ScenarioSourceLite }
