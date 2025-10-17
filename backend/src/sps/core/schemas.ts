import { z } from 'zod';

// MINIMAL SCHEMA - Ready for replacement with new structure
// Supporting schemas preserved for registry compatibility

export const zScreeningChallenge = z.object({
  id: z.string(),
  flag: z.enum(["red","yellow"]),
  cue_intent: z.string(),
  semantic_tags: z.string().array().optional(),
  delivery_guidelines: z.string().array().optional(),
  example_phrases: z.string().array().optional(),
  reveal_triggers: z.string().array(),
  learning_objectives: z.string().array()
});

export const zSpecialQuestion = z.object({
  id: z.string(),
  region: z.enum(["ankle_foot","knee","cervical_spine","shoulder","sports_trauma_general","hip","lumbar_spine","thoracic_spine","elbow","wrist_hand"]),
  student_prompt_patterns: z.string().array(),
  patient_cue_intent: z.string(),
  delivery_guidelines: z.string().array().optional(),
  example_phrases: z.string().array().optional(),
  instructor_imaging_note: z.string(),
  refs: z.string().array().optional()
});

export const zDOBChallenge = z.object({
  style: z.enum(["straightforward","clarification","humor","privacy","misstatement","partial","deflection","annoyance","roleplay","delayed"]),
  example_response: z.string(),
  learning_objectives: z.string().array().optional()
});

export const zMediaAsset = z.object({
  id: z.string(),
  type: z.enum(["image", "video", "youtube"]),
  url: z.string(),
  thumbnail: z.string().optional(),
  caption: z.string(),
  clinical_context: z.string().array(),
  trigger_patterns: z.string().array().optional()
});

export const zPersona = z.object({
  patient_id: z.string(),
  display_name: z.string().optional(),
  headline: z.string().nullable().optional(),
  voice_id: z.string().nullable().optional(),
  tags: z.string().array().optional(),
  demographics: z.object({
    name: z.string(), preferred_name: z.string().optional(), pronouns: z.string().optional(),
    age: z.number().int(), sex: z.string(), occupation: z.string(), sport_activity: z.string().optional(),
    education_health_literacy: z.enum(["low","moderate","high"]),
    primary_language: z.string().optional(), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  social_context: z.any().optional(),
  function_context: z.any().optional(),
  beliefs_affect: z.any().optional(),
  medical_baseline: z.any().optional(),
  dialogue_style: z.any(),
  hidden_agenda: z.any().optional(),
  closure_style: z.any().optional(),
  dob_challenges: zDOBChallenge.array().optional()
});

// PLACEHOLDER: Clinical scenario schema - replace with new structure
export const zClinicalScenario = z.object({
  // Core identity
  scenario_id: z.string().min(3, 'scenario_id must be at least 3 characters'),
  title: z.string().min(3, 'title must be at least 3 characters'),
  region: z.enum([
    "ankle_foot",
    "knee",
    "cervical_spine",
    "shoulder",
    "sports_trauma_general",
    "hip",
    "lumbar_spine",
    "thoracic_spine",
    "elbow",
    "wrist_hand",
  ]),

  // Soft validations for common metadata (optional to avoid breaking existing content)
  difficulty: z.enum(["easy", "moderate", "advanced"]).optional(),
  // Keep setting broad (string) to avoid rejecting legacy values; can be tightened later
  setting: z.string().min(2).optional(),
  tags: z.array(z.string()).optional(),

  // Versioning/status (optional)
  schema_version: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  status: z.string().optional(),

  // Known sections (kept permissive during transition)
  meta: z.any().optional(),
  pedagogy: z.any().optional(),
  presenting_problem: z.any().optional(),
  icf: z.any().optional(),
  instructions: z.any().optional(),
  media_library: zMediaAsset.array().optional(),
  soap: z.any().optional(),
  provenance: z.any().optional(),
}).passthrough(); // Allow additional fields during transition
