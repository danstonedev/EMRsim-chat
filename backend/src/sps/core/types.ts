// Standardized Patient Simulator Types
export type Flag = "red" | "yellow";
export type Literacy = "low" | "moderate" | "high";
export type Tone = "friendly" | "guarded" | "disinterested" | "worried" | "irritable" | "stoic" | "optimistic";
export type Verbosity = "brief" | "balanced" | "talkative";
export type SleepQuality = "good" | "fair" | "poor";
export type Onset = "acute" | "gradual" | "insidious";
export type Region =
  | "ankle_foot"
  | "knee"
  | "cervical_spine"
  | "shoulder"
  | "sports_trauma_general"
  | "hip"
  | "lumbar_spine"
  | "thoracic_spine"
  | "elbow"
  | "wrist_hand";

export interface ScreeningChallenge {
  id: string; flag: Flag; cue_intent: string;
  semantic_tags?: string[]; delivery_guidelines?: string[];
  example_phrases?: string[]; reveal_triggers: string[];
  learning_objectives: string[];
}
export interface SpecialQuestion {
  id: string; region: Region; student_prompt_patterns: string[];
  patient_cue_intent: string; delivery_guidelines?: string[];
  example_phrases?: string[]; instructor_imaging_note: string; refs?: string[];
}
export interface DOBChallenge {
  style: "straightforward"|"clarification"|"humor"|"privacy"|"misstatement"|"partial"|"deflection"|"annoyance"|"roleplay"|"delayed";
  example_response: string; learning_objectives?: string[];
}

export interface PatientPersona {
  patient_id: string;
  display_name?: string;
  headline?: string | null;
  voice_id?: string | null;
  tags?: string[];
  demographics: {
    name: string; preferred_name?: string; pronouns?: string;
    age: number; sex: string; occupation: string; sport_activity?: string;
    education_health_literacy: Literacy; primary_language?: string; dob: string;
  };
  social_context?: { family_roles?: string[]; support_system?: string[]; financial_stressors?: string[]; transportation?: string; cultural_values?: string[]; };
  function_context?: { adl_limitations?: string[]; sport_limitations?: string[]; work_demands?: string; sleep_quality?: SleepQuality; goals?: string[]; };
  beliefs_affect?: { fears?: string[]; beliefs?: string[]; mood?: Tone; coping_style?: string; };
  medical_baseline?: { comorbidities?: string[]; medications?: string[]; };
  dialogue_style: { verbosity: Verbosity; tone: Tone; quirks?: string[]; privacy_hesitations?: string[]; misunderstanding_patterns?: string[]; voice_id?: string | null; speaking_rate?: string | null; };
  hidden_agenda?: { concerns?: string[]; reveal_triggers?: string[]; };
  closure_style?: { preferred_questions?: string[]; cost_concerns?: boolean; role_focus?: ("work"|"sport"|"caregiving"|"school")[]; };
  dob_challenges?: DOBChallenge[];
}

export interface PresentingProblem {
  primary_dx?: string;
  onset?: Onset | string;
  onset_detail?: string;
  duration_weeks?: number;
  dominant_symptoms?: string[];
  pain_nrs_rest?: number;
  pain_nrs_activity?: number;
  aggravators?: string[];
  easers?: string[];
  pattern_24h?: string;
  red_flags_ruled_out?: boolean;
}

export interface ICF {
  health_condition?: string;
  body_functions_structures?: string[];
  activities?: string[];
  participation?: string[];
  environmental_factors?: string[];
  personal_factors?: string[];
}

export interface ScenarioContext {
  goals?: string[];
  role_impacts?: string[];
  environment?: string;
  instructor_notes?: string;
}

export interface SymptomFluctuation {
  with_time?: string;
  with_activity?: string;
  during_session_examples?: string[];
}

export interface ScenarioGuardrails {
  min_age?: number;
  max_age?: number;
  sex_required?: "male" | "female";
  disallow_medications?: string[];
  impact_testing_unsafe?: boolean;
}

export interface ObjectiveGuardrails {
  never_volunteer_data?: boolean;
  require_explicit_physical_consent?: boolean;
  fatigue_prompt_threshold?: number;
  deflection_lines?: string[];
}

export interface ScenarioInstructions {
  sp_instructions?: {
    affect?: string;
    pain_behavior?: string;
    cueing_rules?: string[];
  };
  llm_prompt_hooks?: {
    coaching_cues?: string[];
    deflection_lines?: string[];
  };
  authoring_notes?: string;
}

export interface ScenarioProvenance {
  sources?: string[];
  reviewers?: string[];
  last_reviewed?: string | Date;
  notes?: string;
}

export type ScenarioSOAPKey = "subjective" | "objective" | "assessment" | "plan";
export type ScenarioSOAP = Partial<Record<ScenarioSOAPKey, unknown>> & Record<string, unknown>;

export interface ObjectiveFinding {
  test_id: string; label: string; region: Region;
  preconditions?: string[]; contraindications?: string[];
  instructions_brief?: string;
  patient_output_script: {
    numeric?: Record<string, number | string>;
    qualitative?: string[];
    binary_flags?: Record<string, boolean | string>;
  };
  guardrails?: { data_only?: boolean; deflection_lines?: string[]; refuse_if_contraindicated?: boolean; };
}

// Optional, structured Subjective catalog entries to make authoring easier.
// Backward compatible: scenarios need not include this; matcher only uses if present.
export interface SubjectiveItem {
  id: string; // stable identifier for the item (e.g., "pain_location")
  label: string; // human-friendly title
  patterns: string[]; // simple tokens/phrases to match from student prompts
  patient_response_script: {
    qualitative?: string[]; // primary text responses
    numeric?: Record<string, number | string>; // optional structured tidbits
    binary_flags?: Record<string, boolean | string>;
  };
  notes?: string; // optional authoring note
}

export interface MediaAsset {
  id: string; // stable identifier (e.g., "knee_flexion_active")
  type: "image" | "video" | "youtube";
  url: string; // path or URL to media file (for youtube: full YouTube URL)
  thumbnail?: string; // optional thumbnail (auto-generated for YouTube if not provided)
  caption: string; // clinical description shown with media
  clinical_context: string[]; // semantic tags (e.g., ["rom_assessment", "knee_flexion"])
  trigger_patterns?: string[]; // optional phrases that should trigger display
}

export interface ClinicalScenario {
  scenario_id: string; title: string; region: Region;
  setting?: "primary_care_pt"|"sports_rehab"|"post_op"|"acute"|"telehealth"|"outpatient_pt"|"sports_pt_outpatient"|"sports_medicine_outpatient"|"sports_rehab_clinic";
  difficulty?: "easy"|"moderate"|"advanced";
  tags?: string[];
  schema_version?: string;
  version?: number;
  status?: string;
  meta?: Record<string, unknown>;
  pedagogy?: Record<string, unknown>;
  presenting_problem?: PresentingProblem;
  icf?: ICF;
  scenario_context?: ScenarioContext;
  symptom_fluctuation?: SymptomFluctuation;
  screening_challenge_ids?: string[]; special_question_ids?: string[];
  subjective_catalog?: SubjectiveItem[]; // optional, structured subjective items
  objective_catalog?: ObjectiveFinding[];
  objective_guardrails?: ObjectiveGuardrails;
  media_library?: MediaAsset[]; // optional, visual media assets for demonstration
  guardrails?: ScenarioGuardrails;
  instructions?: ScenarioInstructions;
  soap?: ScenarioSOAP;
  provenance?: ScenarioProvenance;
  linked_persona_id?: string;
  persona_snapshot?: {
    id: string;
    display_name?: string | null;
    age?: number | null;
    sex?: string | null;
    headline?: string | null;
  };
}

export type GateState = "LOCKED" | "UNLOCKED";
export interface GateFlags {
  greeting_done: boolean;
  intro_done: boolean;
  consent_done: boolean;
  identity_verified: boolean;
  locked_pressure_count?: number;
  supervisor_escalated?: boolean;
}
export type EncounterPhase = "subjective" | "objective" | "treatment_plan";

export interface ActiveCase { id: string; persona: PatientPersona; scenario: ClinicalScenario; }
