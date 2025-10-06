import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spsRegistry } from '../core/registry';
// Data imports (JSON). Some large banks abbreviated with TODO markers.
import challenges from '../data/challenges/red_yellow.core.json' assert { type: 'json' };
import sqAnkle from '../data/special_questions/ankle_foot.json' assert { type: 'json' };
import sqKnee from '../data/special_questions/knee.json' assert { type: 'json' };
import sqCspine from '../data/special_questions/cspine.json' assert { type: 'json' };
import sqShoulder from '../data/special_questions/shoulder.json' assert { type: 'json' };
import sqSports from '../data/special_questions/sports_general.json' assert { type: 'json' };
import realtimePersonas from '../data/personas/realtime_personas.json' assert { type: 'json' };
import { zPersona } from '../core/schemas';
import type { ClinicalScenario, DOBChallenge, ObjectiveFinding, PatientPersona, Region } from '../core/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCENARIO_V3_ROOT = path.join(__dirname, '../data/scenarios_v3');
const SCENARIO_PERSONA_ROOT = path.join(__dirname, '../data/personas/scenario');

const TONE_MAP: Record<string, 'friendly' | 'guarded' | 'disinterested' | 'worried' | 'irritable' | 'stoic' | 'optimistic'> = {
  guarded: 'guarded',
  cautious: 'guarded',
  skeptical: 'guarded',
  firm: 'guarded',
  authoritative: 'guarded',
  anxious: 'worried',
  worried: 'worried',
  nervous: 'worried',
  tense: 'worried',
  calm: 'stoic',
  slow: 'stoic',
  neutral: 'stoic',
  stoic: 'stoic',
  steady: 'stoic',
  practical: 'stoic',
  analytical: 'stoic',
  concise: 'stoic',
  professional: 'stoic',
  measured: 'stoic',
  direct: 'stoic',
  time: 'stoic',
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

function cloneDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function mergeStringArrays(...arrays: (unknown[] | undefined)[]): string[] | undefined {
  const merged: string[] = [];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const str = typeof entry === 'string'
        ? entry.trim()
        : typeof entry === 'number'
          ? String(entry)
          : '';
      if (str) merged.push(str);
    }
  }
  if (!merged.length) return undefined;
  return Array.from(new Set(merged));
}

function normalizeContext<T extends Record<string, any>>(ctx: T | undefined): T | undefined {
  if (!ctx) return undefined;
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (Array.isArray(value)) {
      const merged = mergeStringArrays(value);
      if (merged && merged.length) output[key] = merged;
    } else if (value !== undefined && value !== null && value !== '') {
      output[key] = value;
    }
  }
  return Object.keys(output).length ? (output as T) : undefined;
}

function isCanonicalPersona(raw: any): boolean {
  return Boolean(
    raw
    && typeof raw === 'object'
    && typeof raw.patient_id === 'string'
    && raw.patient_id.trim()
    && raw.demographics
    && typeof raw.demographics === 'object',
  );
}

function coerceCanonicalPersona(raw: any): PatientPersona | null {
  if (!isCanonicalPersona(raw)) return null;
  try {
    return zPersona.parse(raw) as PatientPersona;
  } catch (error) {
    if (process.env.DEBUG) {
      console.warn('[sps][persona] canonical persona parse failed', error);
    }
    return null;
  }
}

function augmentPersona(
  base: PatientPersona,
  personaRaw: any,
  instructions: any,
  subjective: any,
  plan: any,
): PatientPersona {
  const persona = cloneDeep(base) as PatientPersona;

  persona.display_name = persona.display_name || persona.demographics.name || persona.patient_id;
  persona.voice_id = persona.voice_id ?? (persona.dialogue_style.voice_id ?? undefined);
  persona.tags = mergeStringArrays(persona.tags, personaRaw?.tags) ?? persona.tags;

  const supportSystem = mergeStringArrays(
    persona.social_context?.support_system,
    personaRaw?.social_context?.support_system,
    personaRaw?.support_system,
  );
  if (supportSystem) {
    persona.social_context = persona.social_context || {};
    persona.social_context.support_system = supportSystem;
  }
  persona.social_context = normalizeContext(persona.social_context);

  const rawGoals = mergeStringArrays(
    persona.function_context?.goals,
    personaRaw?.function_context?.goals,
    personaRaw?.goals_patient_voice,
  );
  if (rawGoals) {
    persona.function_context = persona.function_context || {};
    persona.function_context.goals = rawGoals;
  }

  const workDemands = typeof subjective?.social_history?.work_demands === 'string'
    ? subjective.social_history.work_demands.trim()
    : '';
  if (workDemands) {
    persona.function_context = persona.function_context || {};
    if (!persona.function_context.work_demands) persona.function_context.work_demands = workDemands;
  }

  const sleepSource = subjective?.pain?.sleep_disturbance;
  if (sleepSource) {
    const sleepQuality = mapSleepQuality(sleepSource);
    persona.function_context = persona.function_context || {};
    if (!persona.function_context.sleep_quality) persona.function_context.sleep_quality = sleepQuality;
  }
  persona.function_context = normalizeContext(persona.function_context);

  const instructionQuirks = Array.isArray(instructions?.llm_prompt_hooks?.coaching_cues)
    ? instructions.llm_prompt_hooks.coaching_cues
    : undefined;
  const rawQuirks = Array.isArray(personaRaw?.dialogue_style?.quirks)
    ? personaRaw.dialogue_style.quirks
    : undefined;
  persona.dialogue_style.quirks = mergeStringArrays(persona.dialogue_style.quirks, rawQuirks, instructionQuirks);

  const instructionPrivacy = Array.isArray(instructions?.sp_instructions?.cueing_rules)
    ? instructions.sp_instructions.cueing_rules
    : undefined;
  const rawPrivacy = Array.isArray(personaRaw?.dialogue_style?.privacy_hesitations)
    ? personaRaw.dialogue_style.privacy_hesitations
    : undefined;
  persona.dialogue_style.privacy_hesitations = mergeStringArrays(
    persona.dialogue_style.privacy_hesitations,
    rawPrivacy,
    instructionPrivacy,
  );

  const misunderstandingPatterns = Array.isArray(personaRaw?.dialogue_style?.misunderstanding_patterns)
    ? personaRaw.dialogue_style.misunderstanding_patterns
    : undefined;
  persona.dialogue_style.misunderstanding_patterns = mergeStringArrays(
    persona.dialogue_style.misunderstanding_patterns,
    misunderstandingPatterns,
  );

  persona.dialogue_style.voice_id = persona.dialogue_style.voice_id
    || persona.voice_id
    || (typeof personaRaw?.voice_id === 'string' ? personaRaw.voice_id : undefined)
    || null;

  const planFears = Array.isArray(plan?.safety_netting) ? plan.safety_netting : undefined;
  if (planFears) {
    persona.beliefs_affect = persona.beliefs_affect || {};
    persona.beliefs_affect.fears = mergeStringArrays(persona.beliefs_affect.fears, planFears);
  }
  if (persona.beliefs_affect) {
    persona.beliefs_affect.mood = persona.beliefs_affect.mood || persona.dialogue_style.tone;
    persona.beliefs_affect = normalizeContext(persona.beliefs_affect);
  }

  if (rawGoals) {
    persona.closure_style = persona.closure_style || {};
    persona.closure_style.preferred_questions = mergeStringArrays(
      persona.closure_style.preferred_questions,
      rawGoals,
    );
    persona.closure_style = normalizeContext(persona.closure_style);
  } else if (persona.closure_style) {
    persona.closure_style = normalizeContext(persona.closure_style);
  }

  if (!persona.dob_challenges || !persona.dob_challenges.length) {
    persona.dob_challenges = buildDobChallenges(persona.demographics.name, persona.demographics.dob);
  }

  if (persona.tags && !persona.tags.length) {
    persona.tags = undefined;
  }

  if (!persona.voice_id && persona.dialogue_style.voice_id) {
    persona.voice_id = persona.dialogue_style.voice_id;
  }

  return persona;
}

function safeReadJson(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (process.env.DEBUG) console.warn('[sps][load] failed to parse', filePath, e);
    return null;
  }
}

function toTitleCase(input: string) {
  if (!input) return '';
  return input
    .replace(/^tmpl_/, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function coerceDob(ageValue: unknown) {
  const age = typeof ageValue === 'number' && Number.isFinite(ageValue) ? ageValue : Number(ageValue);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const fallbackYear = Math.max(1940, Math.min(currentYear - 25, currentYear - 18));
  const year = Number.isFinite(age) && age > 0 ? currentYear - Math.round(age) : fallbackYear;
  return `${year}-01-15`;
}

function mapVerbosity(style: unknown): 'brief' | 'balanced' | 'talkative' {
  const value = typeof style === 'string' ? style.toLowerCase().trim() : '';
  if (value === 'brief' || value === 'balanced' || value === 'talkative') return value as 'brief' | 'balanced' | 'talkative';
  if (value === 'concise' || value === 'succinct' || value === 'direct') return 'brief';
  if (value === 'verbose' || value === 'expansive' || value === 'chatty') return 'talkative';
  return 'balanced';
}

function mapTone(affect: unknown): 'friendly' | 'guarded' | 'disinterested' | 'worried' | 'irritable' | 'stoic' | 'optimistic' {
  const value = typeof affect === 'string' ? affect.toLowerCase() : '';
  if (!value) return 'friendly';
  if (TONE_MAP[value]) return TONE_MAP[value];
  const tokens = value.split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    if (TONE_MAP[token]) return TONE_MAP[token];
  }
  return 'friendly';
}

function mapSleepQuality(value: unknown): 'good' | 'fair' | 'poor' {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  if (v === 'none' || v === 'normal' || v === 'good') return 'good';
  if (v === 'difficulty_falling' || v === 'difficulty_staying' || v === 'both' || v === 'poor') return 'poor';
  return 'fair';
}

function buildDobChallenges(name: string, dob: string): DOBChallenge[] {
  const who = name || 'Patient';
  return [
    { style: 'straightforward', example_response: `${who}, ${dob}.` },
    { style: 'clarification', example_response: `${who}. Date of birth ${dob}.` },
  ];
}

function computeAgeFromDob(dob: string | undefined | null): number {
  if (!dob) return 35;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 35;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return Math.max(0, age);
}



export function convertPersonaBundle(personaRaw: any, instructions: any, subjective: any, plan: any): PatientPersona | null {
  if (!personaRaw || typeof personaRaw !== 'object') return null;
  const id = String(personaRaw.persona_id || personaRaw.id || `persona_${Math.random().toString(36).slice(2, 8)}`);
  const age = typeof personaRaw.age === 'number' && Number.isFinite(personaRaw.age) ? personaRaw.age : Number(personaRaw.age) || 30;
  const name = String(personaRaw.name || personaRaw.display_name || id);
  const pronouns = personaRaw.preferred_pronouns ? String(personaRaw.preferred_pronouns) : undefined;
  const occupation = personaRaw.occupation ? String(personaRaw.occupation) : 'Not specified';
  const literacy = ['low', 'moderate', 'high'].includes(String(personaRaw.health_literacy))
    ? String(personaRaw.health_literacy)
    : 'moderate';
  const tone = mapTone(instructions?.sp_instructions?.affect || personaRaw.communication_style);
  const verbosity = mapVerbosity(personaRaw.communication_style);
  const preferredName = name.includes(' ') ? name.split(' ')[0] : name;
  const demographics: PatientPersona['demographics'] = {
    name,
    preferred_name: preferredName,
    pronouns,
    age,
    sex: String(personaRaw.sex || 'unspecified'),
    occupation,
    sport_activity: personaRaw.activity_level ? String(personaRaw.activity_level) : undefined,
    education_health_literacy: literacy as 'low' | 'moderate' | 'high',
    primary_language: Array.isArray(personaRaw.cultural_linguistic_notes) && personaRaw.cultural_linguistic_notes.length
      ? String(personaRaw.cultural_linguistic_notes[0])
      : undefined,
    dob: coerceDob(age),
  };

  const social_context = Array.isArray(personaRaw.support_system) && personaRaw.support_system.length
    ? { support_system: personaRaw.support_system.map((s: any) => String(s)).filter(Boolean) }
    : undefined;

  const sportLimitations = Array.isArray(personaRaw.goals_patient_voice)
    ? personaRaw.goals_patient_voice.map((g: any) => String(g)).filter(Boolean)
    : [];

  const workDemands = subjective?.social_history?.work_demands
    ? String(subjective.social_history.work_demands)
    : undefined;

  const sleepQuality = subjective?.pain?.sleep_disturbance
    ? mapSleepQuality(subjective.pain.sleep_disturbance)
    : undefined;

  const function_context = (workDemands || sleepQuality || sportLimitations.length)
    ? {
        work_demands: workDemands,
        sleep_quality: sleepQuality,
        goals: sportLimitations.length ? sportLimitations : undefined,
      }
    : undefined;

  const beliefs_affect = {
    fears: Array.isArray(plan?.safety_netting) ? plan.safety_netting.map((s: any) => String(s)).filter(Boolean) : undefined,
    mood: tone,
  };

  const medical_baseline = (Array.isArray(subjective?.past_medical_history) || Array.isArray(subjective?.medications))
    ? {
        comorbidities: Array.isArray(subjective?.past_medical_history)
          ? subjective.past_medical_history.map((s: any) => String(s)).filter(Boolean)
          : undefined,
        medications: Array.isArray(subjective?.medications)
          ? subjective.medications.map((s: any) => String(s)).filter(Boolean)
          : undefined,
      }
    : undefined;

  const dialogue_style: PatientPersona['dialogue_style'] = {
    verbosity,
    tone,
    quirks: Array.isArray(instructions?.llm_prompt_hooks?.coaching_cues)
      ? instructions.llm_prompt_hooks.coaching_cues.map((s: any) => String(s)).filter(Boolean)
      : undefined,
    privacy_hesitations: Array.isArray(instructions?.sp_instructions?.cueing_rules)
      ? instructions.sp_instructions.cueing_rules.map((s: any) => String(s)).filter(Boolean)
      : undefined,
  };

  const closure_style = Array.isArray(personaRaw.goals_patient_voice) && personaRaw.goals_patient_voice.length
    ? { preferred_questions: personaRaw.goals_patient_voice.map((s: any) => String(s)).filter(Boolean) }
    : undefined;

  const dob_challenges = buildDobChallenges(name, demographics.dob);

  return {
    patient_id: id,
    demographics,
    social_context,
    function_context,
    beliefs_affect,
    medical_baseline,
    dialogue_style,
    closure_style,
    dob_challenges,
  } as PatientPersona;
}

type ScenarioPersonaBundle = {
  raw: any;
  persona: PatientPersona;
};

function loadScenarioPersonasFromDisk(): Map<string, ScenarioPersonaBundle> {
  const personas = new Map<string, ScenarioPersonaBundle>();
  if (!fs.existsSync(SCENARIO_PERSONA_ROOT)) return personas;

  const entries = fs.readdirSync(SCENARIO_PERSONA_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(SCENARIO_PERSONA_ROOT, entry.name);
    const personaRaw = safeReadJson(filePath);
    if (!personaRaw) continue;
    const persona = convertPersonaBundle(personaRaw, undefined, undefined, undefined);
    if (!persona) continue;
    personas.set(persona.patient_id, { raw: personaRaw, persona });
  }

  return personas;
}

function buildObjectiveFinding(testId: string, label: string, region: string, findings: any): ObjectiveFinding {
  const numeric = findings && typeof findings.numeric === 'object' ? findings.numeric : undefined;
  const qualitative = Array.isArray(findings?.qualitative) ? findings.qualitative.map((s: any) => String(s)) : undefined;
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

function buildObjectiveCatalog(objective: any, region: string, scenarioId: string): ObjectiveFinding[] {
  const items: ObjectiveFinding[] = [];
  const special = Array.isArray(objective?.special_tests) ? objective.special_tests : [];
  special.forEach((test: any, idx: number) => {
    if (test?.performed === false) return;
    const templateId = String(test?.test_template_id || '') || `obj_${scenarioId}_${idx}`;
    const label = toTitleCase(templateId) || `Special Test ${idx + 1}`;
    items.push(buildObjectiveFinding(templateId, label, region, test?.findings || {}));
  });

  const functional = Array.isArray(objective?.functional_tests) ? objective.functional_tests : [];
  functional.forEach((test: any, idx: number) => {
    if (test?.performed === false) return;
    const templateId = String(test?.test_template_id || '') || `fn_${scenarioId}_${idx}`;
    const label = toTitleCase(templateId) || `Functional Test ${idx + 1}`;
    items.push(buildObjectiveFinding(templateId, label, region, test?.findings || {}));
  });

  return items;
}

function buildScenarioContext(subjective: any, personaRaw: any, plan: any): ClinicalScenario['scenario_context'] | undefined {
  const context: ClinicalScenario['scenario_context'] = {};
  const goals: string[] = [];
  const planGoals = plan?.goals;
  if (Array.isArray(planGoals?.ltg_6_12_weeks)) goals.push(...planGoals.ltg_6_12_weeks.map((s: any) => String(s)).filter(Boolean));
  if (Array.isArray(planGoals?.stg_2_4_weeks)) goals.push(...planGoals.stg_2_4_weeks.map((s: any) => String(s)).filter(Boolean));
  if (!goals.length && Array.isArray(personaRaw?.goals_patient_voice)) goals.push(...personaRaw.goals_patient_voice.map((s: any) => String(s)).filter(Boolean));
  if (goals.length) context.goals = goals;

  const environment = subjective?.sdoh?.home_environment ? String(subjective.sdoh.home_environment) : undefined;
  if (environment) context.environment = environment;

  const roleImpacts = Array.isArray(subjective?.sdoh?.caregiving_roles) ? subjective.sdoh.caregiving_roles.map((s: any) => String(s)).filter(Boolean) : [];
  if (roleImpacts.length) context.role_impacts = roleImpacts;

  return Object.keys(context).length ? context : undefined;
}

export function convertScenarioBundle(
  bundleName: string,
  header: any,
  personaId: string | null,
  persona: PatientPersona | null,
  personaRaw: any,
  instructions: any,
  subjective: any,
  objective: any,
  assessment: any,
  plan: any,
): ClinicalScenario | null {
  if (!header || typeof header !== 'object') return null;
  const scenarioId = String(header.scenario_id || bundleName);
  const meta = header.meta || {};
  const region = typeof meta.region === 'string' ? meta.region : 'sports_trauma_general';
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : scenarioId;
  const presenting = header.presenting_problem || {};
  const icf = header.icf || {
    health_condition: '',
    body_functions_structures: [],
    activities: [],
    participation: [],
    environmental_factors: [],
    personal_factors: [],
  };
  const objective_catalog = buildObjectiveCatalog(objective, region, scenarioId);
  const guardrails: ClinicalScenario['guardrails'] = {};
  const precautions = Array.isArray(objective?.contraindications_precautions)
    ? objective.contraindications_precautions.map((s: any) => String(s)).filter(Boolean)
    : [];
  if (precautions.some((txt: string) => /hop|impact|jump/i.test(txt))) guardrails.impact_testing_unsafe = true;

  const objective_guardrails = {
    deflection_lines: Array.isArray(instructions?.llm_prompt_hooks?.deflection_lines)
      ? instructions.llm_prompt_hooks.deflection_lines.map((s: any) => String(s)).filter(Boolean)
      : undefined,
    require_explicit_physical_consent: Boolean(plan?.safety_netting?.some((txt: any) => /consent/i.test(String(txt)))),
  };

  const scenario_context = buildScenarioContext(subjective, personaRaw, plan);

  const linkedPersonaId = persona?.patient_id || (personaId ?? undefined);
  const snapshot = persona
    ? {
        id: persona.patient_id,
        display_name: persona.demographics?.name || persona.patient_id,
        age: persona.demographics?.age ?? null,
        sex: persona.demographics?.sex ?? null,
        headline: Array.isArray(personaRaw?.goals_patient_voice) && personaRaw.goals_patient_voice.length
          ? String(personaRaw.goals_patient_voice[0])
          : persona.function_context?.goals?.[0] || null,
      }
    : undefined;

  const scenario: ClinicalScenario = {
    scenario_id: scenarioId,
    title,
    region: region as Region,
    difficulty: typeof meta.difficulty === 'string' ? meta.difficulty : undefined,
    setting: typeof meta.setting === 'string' ? meta.setting : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags.map((s: any) => String(s)).filter(Boolean) : undefined,
    schema_version: header.schema_version,
    version: header.version,
    status: header.status,
    meta,
    pedagogy: header.pedagogy,
    presenting_problem: presenting,
    icf,
    scenario_context,
    symptom_fluctuation: undefined,
    screening_challenge_ids: undefined,
    special_question_ids: undefined,
    subjective_catalog: undefined,
    objective_catalog,
    objective_guardrails: objective_guardrails.deflection_lines || objective_guardrails.require_explicit_physical_consent ? objective_guardrails : undefined,
    guardrails: Object.keys(guardrails).length ? guardrails : undefined,
    instructions,
    soap: { subjective, objective, assessment, plan },
    provenance: header.provenance,
    linked_persona_id: linkedPersonaId,
    persona_snapshot: snapshot,
  } as ClinicalScenario;

  return scenario;
}

function loadScenarioBundlesFromDisk(personaBundles: Map<string, ScenarioPersonaBundle>) {
  if (!fs.existsSync(SCENARIO_V3_ROOT)) {
    return [] as ClinicalScenario[];
  }

  const scenarios: ClinicalScenario[] = [];

  const entries = fs.readdirSync(SCENARIO_V3_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(SCENARIO_V3_ROOT, entry.name);
    const header = safeReadJson(path.join(dirPath, 'scenario.header.json'));
    if (!header) continue;

    const linkage = header.linkage || {};
    const personaId = typeof linkage.persona_id === 'string' && linkage.persona_id.trim()
      ? String(linkage.persona_id).trim()
      : null;
    const personaBundle = personaId ? personaBundles.get(personaId) : undefined;
    if (personaId && !personaBundle) {
      console.warn('[sps][load] persona not found for scenario', entry.name, personaId);
    }
    const instructions = safeReadJson(path.join(dirPath, linkage.instructions_file || 'instructions.json')) || {};
    const subjective = safeReadJson(path.join(dirPath, linkage.soap_subjective_file || 'soap.subjective.json')) || {};
    const objective = safeReadJson(path.join(dirPath, linkage.soap_objective_file || 'soap.objective.json')) || {};
    const assessment = safeReadJson(path.join(dirPath, linkage.soap_assessment_file || 'soap.assessment.json')) || {};
    const plan = safeReadJson(path.join(dirPath, linkage.soap_plan_file || 'soap.plan.json')) || {};

    const persona = personaBundle?.persona || null;
    const personaRaw = personaBundle?.raw || null;

    const scenario = convertScenarioBundle(
      entry.name,
      header,
      personaId,
      persona,
      personaRaw,
      instructions,
      subjective,
      objective,
      assessment,
      plan,
    );
    if (scenario) {
      scenarios.push(scenario);
    }
  }

  return scenarios;
}

export function loadSPSContent() {
  const registry = spsRegistry
    .addChallenges(challenges as any)
    .addSpecialQuestions([...(sqAnkle as any), ...(sqKnee as any), ...(sqCspine as any), ...(sqShoulder as any), ...(sqSports as any)]);

  // Load realtime personas (already in canonical format)
  if (Array.isArray(realtimePersonas) && realtimePersonas.length) {
    registry.addPersonas(realtimePersonas as any);
  }

  const scenarioPersonas = loadScenarioPersonasFromDisk();
  if (scenarioPersonas.size) {
    registry.addPersonas(Array.from(scenarioPersonas.values()).map((bundle) => bundle.persona) as any);
  }

  const scenarios = loadScenarioBundlesFromDisk(scenarioPersonas);
  if (scenarios.length) registry.addScenarios(scenarios as any);

  return registry;
}
