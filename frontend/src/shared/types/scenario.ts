export type ScenarioRegion =
  | 'hip'
  | 'knee'
  | 'ankle_foot'
  | 'shoulder'
  | 'cervical_spine'
  | 'lumbar_spine'
  | 'thoracic_spine'
  | 'elbow'
  | 'wrist_hand'
  | 'sports_trauma_general'

export type ScenarioDifficulty = 'easy' | 'moderate' | 'advanced'

export type ScenarioSetting =
  | 'primary_care_pt'
  | 'sports_rehab'
  | 'post_op'
  | 'acute'
  | 'telehealth'
  | 'outpatient_pt'
  | 'sports_pt_outpatient'
  | 'sports_medicine_outpatient'
  | 'sports_rehab_clinic'

export type BloomLevel = 'apply' | 'analyze' | 'evaluate' | 'create'

export type AssessmentFocus = 'safety' | 'clinical_reasoning' | 'patient_education'

export type EvidenceLevel = 'CPG' | 'systematic_review' | 'RCT'

export interface ScenarioLearningObjective {
  id: string
  text: string
  bloom_level: BloomLevel
  capte_refs: string[]
  npte_map: {
    system: 'musculoskeletal' | 'neuromuscular' | 'cardiopulmonary' | 'integumentary' | 'other_systems'
    domain: 'examination' | 'foundations' | 'interventions'
    nonsystem: 'safety' | 'professional' | 'equipment_devices'
  }
  assessment_focus: AssessmentFocus[]
  evidence_req: 'CPG' | 'systematic_review' | 'RCT'
}

export interface ScenarioPedagogy {
  learning_objectives: ScenarioLearningObjective[]
  performance_rubric_ref: string
  feedback_bank_keys: string[]
  debrief_prompts: string[]
}

export interface ScenarioPresentingProblem {
  primary_dx: string
  onset: 'acute' | 'gradual' | 'insidious'
  duration_weeks: number
  dominant_symptoms: string[]
  pain_nrs_rest: number
  pain_nrs_activity: number
  aggravators: string[]
  easers: string[]
  pattern_24h: string
  red_flags_ruled_out: boolean
}

export interface ScenarioICF {
  health_condition: string
  body_functions_structures: string[]
  activities: string[]
  participation: string[]
  environmental_factors: string[]
  personal_factors: string[]
}

export interface ScenarioPersona {
  persona_id: string
  name: string
  age: number
  sex: 'female' | 'male' | 'other'
  preferred_pronouns: string
  occupation: string
  activity_level: 'sedentary' | 'light' | 'moderate' | 'vigorous'
  cultural_linguistic_notes: string[]
  goals_patient_voice: string[]
  communication_style: 'concise' | 'verbose' | 'anxious' | 'guarded' | 'frustrated' | 'stoic' | 'calm'
  health_literacy: 'low' | 'moderate' | 'high'
  support_system: string[]
}

export interface ScenarioInstructions {
  sp_instructions: {
    affect: 'calm' | 'anxious' | 'frustrated' | 'guarded'
    pain_behavior: string
    cueing_rules: string[]
  }
  llm_prompt_hooks: {
    coaching_cues: string[]
    deflection_lines?: string[]
  }
  authoring_notes?: string
}

export interface ScenarioSubjectiveHistory {
  mechanism: string
  first_onset: string
  course_since_onset: 'improving' | 'worsening' | 'fluctuating' | 'stable'
  prior_episodes: string
  prior_treatment_response: string[]
  red_flag_denials_affirmations: Record<string, boolean>
}

export interface ScenarioSubjectivePain {
  location: string[]
  quality: string[]
  irritability: 'low' | 'moderate' | 'high'
  nrs_rest: number
  nrs_activity: number
  nrs_best: number
  nrs_worst: number
  aggravators: string[]
  easers: string[]
  '24h_pattern': string
  sleep_disturbance: 'none' | 'difficulty_falling' | 'difficulty_staying' | 'both'
}

export interface ScenarioSubjective {
  chief_complaint: string
  history_present_illness: ScenarioSubjectiveHistory
  pain: ScenarioSubjectivePain
  past_medical_history: string[]
  surgical_history: string[]
  medications: string[]
  allergies: string[]
  imaging: {
    available: boolean
    modality: 'xray' | 'mri' | 'ct' | 'ultrasound' | 'other'
    date: string
    body_region: string
    summary_patient_facing: string
    clinical_interpretation: string
  }
  social_history: {
    tobacco: 'never' | 'former' | 'current'
    alcohol: 'none' | 'social' | 'regular'
    sleep_hours: number
    diet_notes: string
    work_demands: string
    sport_hobbies: string[]
  }
  sdoh: {
    home_environment: string
    transportation: 'reliable' | 'limited'
    financial_barriers: 'none' | 'some' | 'significant'
    caregiving_roles: string[]
  }
  goals: string[]
  systems_review: {
    cardiovascular_pulmonary: Record<'dyspnea' | 'chest_pain' | 'orthopnea' | 'edema', boolean>
    neuromuscular: Record<'dizziness' | 'falls_history' | 'headache_neck' | 'paresthesia', boolean>
    integumentary: Record<'wounds' | 'rash' | 'color_changes', boolean>
    other: string[]
  }
  special_questions_region_specific?: string[]
}

export interface ScenarioObjective {
  vitals: {
    bp_mmHg: { systolic: number; diastolic: number }
    hr_bpm: number
    rr_bpm: number
    spo2_percent: number
    temperature_c: number
    position: 'seated' | 'supine' | 'standing'
  }
  observation: {
    skin_incisions: string[]
    effusion: string
    ecchymosis: string
    other_findings: string[]
  }
  gait: {
    qualitative: string[]
    assistive_device: 'none' | 'cane' | 'crutch' | 'walker' | 'other'
    surface: 'clinic' | 'hallway' | 'uneven'
  }
  palpation: {
    structures_assessed: string[]
    tenderness_grading: 'none' | 'mild' | 'moderate' | 'severe'
    temperature_edema_skin: string[]
  }
  rom: {
    method: 'goniometry' | 'visual_estimate'
    active: Record<string, number>
    passive: Record<string, number>
    end_feel: Record<string, string>
    symptom_reproduction: Record<string, string>
  }
  mmt_strength: {
    method: 'manual_0_to_5'
    grades: Record<string, number>
    pain_inhibition: Record<string, boolean>
  }
  special_tests: Array<{
    test_template_id: string
    performed: boolean
    findings: {
      numeric?: Record<string, number>
      qualitative: string[]
      binary_flags?: Record<string, boolean>
    }
  }>
  functional_tests?: Array<{
    test_template_id: string
    performed: boolean
    findings: {
      numeric?: Record<string, number>
      qualitative: string[]
    }
  }>
  outcome_measures: Array<{
    measure_id: string
    score_raw: number
    score_interpretation: string
  }>
  contraindications_precautions: string[]
  test_session_notes: string
}

export interface ScenarioAssessment {
  problem_list: string[]
  working_diagnoses: string[]
  clinical_impression: string
  irritability_severity: 'low' | 'moderate' | 'high'
  staging_subgrouping?: string
  prognosis: 'good' | 'fair' | 'poor'
  icd10_codes: string[]
  differential_diagnoses_considered: string[]
  rationale_evidence_links: string[]
}

export interface ScenarioPlanIntervention {
  intervention_id: string
  dose: {
    sets: number
    reps: number
    frequency_per_week: number
  }
  progression_criteria: string[]
  expected_response: Record<string, string>
}

export interface ScenarioPlan {
  frequency_duration: {
    visits_per_week: number
    weeks: number
  }
  referrals_imaging_requests: string[]
  goals: {
    stg_2_4_weeks: string[]
    ltg_6_12_weeks: string[]
  }
  interventions_planned: ScenarioPlanIntervention[]
  patient_education: {
    topics: string[]
    teach_back_confirmed: boolean
  }
  safety_netting: string[]
}

export interface ScenarioMediaAsset {
  id: string
  type: 'image' | 'video' | 'youtube'
  url: string
  thumbnail?: string
  caption: string
  clinical_context: string[]
  trigger_patterns?: string[]
}

export interface ScenarioProvenanceSource {
  title: string
  identifier: string
  level_of_evidence: EvidenceLevel
}

export interface ScenarioProvenance {
  sources: ScenarioProvenanceSource[]
  reviewers: string[]
  last_reviewed: string
}

export interface ScenarioMeta {
  title: string
  region: ScenarioRegion
  difficulty: ScenarioDifficulty
  setting: ScenarioSetting
  tags: string[]
  profession: string
  created_at: string
  updated_at: string
}

export interface ClinicalScenarioV3 {
  schema_version: string
  scenario_id: string
  version: number
  status: string
  linked_persona_id?: string
  persona_snapshot?: {
    id: string
    display_name?: string | null
    headline?: string | null
    age?: number | null
    sex?: string | null
  }
  meta: ScenarioMeta
  pedagogy: ScenarioPedagogy
  presenting_problem: ScenarioPresentingProblem
  icf: ScenarioICF
  instructions: ScenarioInstructions
  media_library?: ScenarioMediaAsset[]
  soap: {
    subjective: ScenarioSubjective
    objective: ScenarioObjective
    assessment: ScenarioAssessment
    plan: ScenarioPlan
  }
  provenance: ScenarioProvenance
}

export interface ScenarioSourceLite {
  title: string
  url: string
}
