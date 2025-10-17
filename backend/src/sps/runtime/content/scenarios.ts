import { toTitleCase } from '../../core/normalization/index.ts';
import type { ClinicalScenario, ObjectiveFinding, PatientPersona, Region } from '../../core/types.ts';

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

export function buildScenarioContext(
  subjective: any,
  personaRaw: any,
  plan: any,
  contextModules: any[] = [],
): ClinicalScenario['scenario_context'] | undefined {
  const context: ClinicalScenario['scenario_context'] = {};

  for (const module of contextModules) {
    if (module && typeof module === 'object') {
      Object.assign(context, module);
    }
  }

  const goals: string[] = [];
  const planGoals = plan?.goals;
  if (Array.isArray(planGoals?.ltg_6_12_weeks)) goals.push(...planGoals.ltg_6_12_weeks.map((s: any) => String(s)).filter(Boolean));
  if (Array.isArray(planGoals?.stg_2_4_weeks)) goals.push(...planGoals.stg_2_4_weeks.map((s: any) => String(s)).filter(Boolean));
  if (!goals.length && Array.isArray(personaRaw?.goals_patient_voice)) goals.push(...personaRaw.goals_patient_voice.map((s: any) => String(s)).filter(Boolean));
  if (goals.length) context.goals = goals;

  const environment = subjective?.sdoh?.home_environment ? String(subjective.sdoh.home_environment) : undefined;
  if (environment) context.environment = environment;

  const roleImpacts = Array.isArray(subjective?.sdoh?.caregiving_roles)
    ? subjective.sdoh.caregiving_roles.map((s: any) => String(s)).filter(Boolean)
    : [];
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
  contextModules: any[] = [],
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

  const scenario_context = buildScenarioContext(subjective, personaRaw, plan, contextModules);

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
    subjective_catalog: Array.isArray(header.subjective_catalog) ? header.subjective_catalog : undefined,
    media_library: Array.isArray(header.media_library) ? header.media_library : undefined,
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
