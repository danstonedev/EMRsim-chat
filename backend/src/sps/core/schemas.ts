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
  type: z.enum(["image", "video"]),
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
  scenario_id: z.string(),
  title: z.string(),
  region: z.enum(["ankle_foot","knee","cervical_spine","shoulder","sports_trauma_general","hip","lumbar_spine","thoracic_spine","elbow","wrist_hand"]),
  media_library: zMediaAsset.array().optional(),
  // Add new schema fields here
}).passthrough(); // Allow additional fields during transition
