/**
 * SPS Content Normalization Module
 *
 * Handles conversion and normalization of raw SPS data formats
 * into canonical runtime formats.
 *
 * Extracted from session.ts as part of Phase 4 refactoring.
 */

import type { PatientPersona, ObjectiveFinding, Region } from '../types.js';

// ============================================================================
// Type Mapping Constants
// ============================================================================

export const TONE_MAP: Record<
  string,
  'friendly' | 'guarded' | 'disinterested' | 'worried' | 'irritable' | 'stoic' | 'optimistic'
> = {
  guarded: 'guarded',
  cautious: 'guarded',
  skeptical: 'guarded',
  firm: 'guarded',
  authoritative: 'guarded',
  anxious: 'worried',
  worried: 'worried',
  concerned: 'worried',
  uncertain: 'worried',
  apprehensive: 'worried',
  restless: 'worried',
  irritable: 'irritable',
  frustrated: 'irritable',
  impatient: 'irritable',
  tense: 'irritable',
  defensive: 'irritable',
  stoic: 'stoic',
  reserved: 'stoic',
  matter_of_fact: 'stoic',
  factual: 'stoic',
  pragmatic: 'stoic',
  subdued: 'stoic',
  resigned: 'stoic',
  quiet: 'guarded',
  quick: 'optimistic',
  energized: 'optimistic',
  energetic: 'optimistic',
  lively: 'optimistic',
  upbeat: 'optimistic',
  hopeful: 'optimistic',
  optimistic: 'optimistic',
  bright: 'optimistic',
  expressive: 'optimistic',
  animated: 'optimistic',
  friendly: 'friendly',
  warm: 'friendly',
  gentle: 'friendly',
  kind: 'friendly',
  polite: 'friendly',
  open: 'friendly',
  lyrical: 'friendly',
  reassuring: 'friendly',
  empathetic: 'friendly',
  compassionate: 'friendly',
  social: 'friendly',
  calmness: 'friendly',
  relaxed: 'friendly',
  dry: 'guarded',
  disinterested: 'disinterested',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep clone a value using JSON serialization
 */
export function cloneDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Merge multiple arrays of strings, filtering out invalid entries
 */
export function mergeStringArrays(...arrays: (unknown[] | undefined)[]): string[] | undefined {
  const merged: string[] = [];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const str = typeof entry === 'string' ? entry.trim() : typeof entry === 'number' ? String(entry) : '';
      if (str) merged.push(str);
    }
  }
  return merged.length ? merged : undefined;
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Coerce age to ISO date-of-birth string
 */
export function coerceDob(age: number): string {
  if (!Number.isFinite(age) || age < 0 || age > 120) age = 30;
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map affect/communication style to canonical tone
 */
export function mapTone(
  input: unknown
): 'friendly' | 'guarded' | 'disinterested' | 'worried' | 'irritable' | 'stoic' | 'optimistic' {
  if (typeof input !== 'string') return 'friendly';
  const lower = input.toLowerCase().trim().replace(/\s+/g, '_');
  return TONE_MAP[lower] || 'friendly';
}

/**
 * Map communication style to verbosity level
 */
export function mapVerbosity(input: unknown): 'brief' | 'balanced' | 'talkative' {
  if (typeof input !== 'string') return 'balanced';
  const lower = input.toLowerCase().trim();
  if (['concise', 'brief', 'short', 'terse', 'minimal'].includes(lower)) return 'brief';
  if (['verbose', 'detailed', 'elaborate', 'wordy', 'expressive', 'talkative'].includes(lower)) return 'talkative';
  return 'balanced';
}

/**
 * Map sleep disturbance to quality level
 */
export function mapSleepQuality(disturbance: unknown): 'poor' | 'fair' | 'good' | undefined {
  if (typeof disturbance === 'boolean') {
    return disturbance ? 'poor' : 'good';
  }
  if (typeof disturbance === 'string') {
    const lower = disturbance.toLowerCase();
    if (['poor', 'severe', 'significant', 'major'].includes(lower)) return 'poor';
    if (['fair', 'moderate', 'some', 'occasional'].includes(lower)) return 'fair';
    if (['good', 'none', 'minimal', 'no'].includes(lower)) return 'good';
  }
  return undefined;
}

// ============================================================================
// Persona Normalization
// ============================================================================

export interface PersonaNormalizationInput {
  raw: any;
  instructions?: any;
  subjective?: any;
  plan?: any;
}

/**
 * Normalize raw persona data to canonical PatientPersona format
 */
export function normalizePersona(input: PersonaNormalizationInput): PatientPersona | null {
  const { raw, instructions, subjective, plan: _plan } = input;

  if (!raw || typeof raw !== 'object') return null;

  // Extract ID (prefer patient_id, fall back to persona_id or id)
  const id = String(raw.patient_id || raw.persona_id || raw.id || `persona_${Math.random().toString(36).slice(2, 8)}`);

  // Extract demographics
  const age = typeof raw.age === 'number' && Number.isFinite(raw.age) ? raw.age : Number(raw.age) || 30;
  const name = String(raw.name || raw.display_name || id);
  const pronouns = raw.preferred_pronouns ? String(raw.preferred_pronouns) : undefined;
  const occupation = raw.occupation ? String(raw.occupation) : 'Not specified';
  const literacy = ['low', 'moderate', 'high'].includes(String(raw.health_literacy))
    ? String(raw.health_literacy)
    : 'moderate';

  // Map communication attributes
  const tone = mapTone(instructions?.sp_instructions?.affect || raw.communication_style);
  const verbosity = mapVerbosity(raw.communication_style);

  // Derive preferred name
  const preferredName = name.includes(' ') ? name.split(' ')[0] : name;

  const demographics: PatientPersona['demographics'] = {
    name,
    preferred_name: preferredName,
    pronouns,
    age,
    sex: String(raw.sex || 'unspecified'),
    occupation,
    sport_activity: raw.activity_level ? String(raw.activity_level) : undefined,
    education_health_literacy: literacy as 'low' | 'moderate' | 'high',
    primary_language:
      Array.isArray(raw.cultural_linguistic_notes) && raw.cultural_linguistic_notes.length
        ? String(raw.cultural_linguistic_notes[0])
        : undefined,
    dob: coerceDob(age),
  };

  // Build social context
  const social_context =
    Array.isArray(raw.support_system) && raw.support_system.length
      ? { support_system: raw.support_system.map((s: any) => String(s)).filter(Boolean) }
      : undefined;

  // Build function context
  const sportLimitations = Array.isArray(raw.goals_patient_voice)
    ? raw.goals_patient_voice.map((g: any) => String(g)).filter(Boolean)
    : [];
  const workDemands = subjective?.social_history?.work_demands
    ? String(subjective.social_history.work_demands)
    : undefined;
  const sleepQuality = subjective?.pain?.sleep_disturbance
    ? mapSleepQuality(subjective.pain.sleep_disturbance)
    : undefined;

  const function_context =
    workDemands || sleepQuality || sportLimitations.length
      ? {
          work_demands: workDemands,
          sleep_quality: sleepQuality,
          goals: sportLimitations.length ? sportLimitations : undefined,
        }
      : undefined;

  // Build beliefs and affect
  const healthBeliefs = Array.isArray(raw.health_beliefs_concerns)
    ? raw.health_beliefs_concerns.map((b: any) => String(b)).filter(Boolean)
    : undefined;
  const emotionalState = instructions?.sp_instructions?.emotional_state
    ? String(instructions.sp_instructions.emotional_state)
    : undefined;

  const beliefs_affect = {
    health_beliefs: healthBeliefs,
    emotional_state: emotionalState,
    affect: tone,
  };

  // Build history snapshot
  const medicalHistory = mergeStringArrays(
    raw.past_medical,
    raw.comorbidities,
    subjective?.medical_history?.past_medical
  );
  const surgicalHistory = mergeStringArrays(raw.past_surgical, subjective?.medical_history?.past_surgical);
  const medications = mergeStringArrays(raw.medications, subjective?.medical_history?.medications);
  const imagingHistory = subjective?.medical_history?.imaging_workup
    ? String(subjective.medical_history.imaging_workup)
    : undefined;

  const history_snapshot =
    medicalHistory || surgicalHistory || medications || imagingHistory
      ? {
          medical: medicalHistory,
          surgical: surgicalHistory,
          medications,
          imaging_workup: imagingHistory,
        }
      : undefined;

  // Build communication preferences
  const communication = {
    tone,
    verbosity,
    directness: instructions?.sp_instructions?.communication?.directness || 'moderate',
    language_complexity: instructions?.sp_instructions?.communication?.language_complexity || literacy,
  };

  // Build dialogue style
  const quirks = Array.isArray(raw.quirks) ? raw.quirks.map((q: any) => String(q)).filter(Boolean) : undefined;
  const privacyHesitations = Array.isArray(raw.privacy_hesitations)
    ? raw.privacy_hesitations.map((h: any) => String(h)).filter(Boolean)
    : undefined;
  const misunderstandingPatterns = Array.isArray(raw.misunderstanding_patterns)
    ? raw.misunderstanding_patterns.map((p: any) => String(p)).filter(Boolean)
    : undefined;

  const dialogue_style = {
    verbosity,
    tone,
    quirks,
    privacy_hesitations: privacyHesitations,
    misunderstanding_patterns: misunderstandingPatterns,
    voice_id: raw.voice_id ? String(raw.voice_id) : null,
    speaking_rate: raw.speaking_rate ? String(raw.speaking_rate) : null,
  };

  // Assemble final persona
  return {
    patient_id: id,
    display_name: name,
    demographics,
    social_context,
    function_context,
    beliefs_affect,
    history_snapshot,
    communication,
    dialogue_style,
  } as PatientPersona;
}

// ============================================================================
// Objective Finding Normalization
// ============================================================================

/**
 * Build a normalized objective finding
 */
export function normalizeObjectiveFinding(
  testId: string,
  label: string,
  region: string,
  findings: any
): ObjectiveFinding {
  const numeric = findings && typeof findings.numeric === 'object' ? findings.numeric : undefined;
  const qualitative = Array.isArray(findings?.qualitative)
    ? findings.qualitative.map((s: any) => String(s))
    : undefined;
  const binary = findings && typeof findings.binary_flags === 'object' ? findings.binary_flags : undefined;

  return {
    test_id: testId,
    label,
    region: region as Region,
    patient_output_script: {
      numeric,
      qualitative,
      binary_flags: binary,
    },
  } as ObjectiveFinding;
}

/**
 * Build objective findings catalog from raw objective data
 */
export function normalizeObjectiveCatalog(objective: any, region: string, scenarioId: string): ObjectiveFinding[] {
  const items: ObjectiveFinding[] = [];

  // Process special tests
  const special = Array.isArray(objective?.special_tests) ? objective.special_tests : [];
  special.forEach((test: any, idx: number) => {
    if (test?.performed === false) return;
    const templateId = String(test?.test_template_id || '') || `obj_${scenarioId}_${idx}`;
    const label = toTitleCase(templateId) || `Special Test ${idx + 1}`;
    items.push(normalizeObjectiveFinding(templateId, label, region, test?.findings || {}));
  });

  // Process functional tests
  const functional = Array.isArray(objective?.functional_tests) ? objective.functional_tests : [];
  functional.forEach((test: any, idx: number) => {
    if (test?.performed === false) return;
    const templateId = String(test?.test_template_id || '') || `fn_${scenarioId}_${idx}`;
    const label = toTitleCase(templateId) || `Functional Test ${idx + 1}`;
    items.push(normalizeObjectiveFinding(templateId, label, region, test?.findings || {}));
  });

  return items;
}
