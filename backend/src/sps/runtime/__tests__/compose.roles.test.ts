import { describe, it, expect } from 'vitest';
import { composeRealtimeInstructions } from '../sps.service.js';
import type { ActiveCase, PatientPersona, ClinicalScenario } from '../../core/types.js';

function makePersona(overrides: Partial<PatientPersona> = {}): PatientPersona {
  return {
    patient_id: 'p_test_01',
    tags: [],
    demographics: {
      name: 'Jordan Taylor',
      preferred_name: 'Jordan',
      pronouns: 'they/them',
      age: 28,
      sex: 'female',
      occupation: 'Teacher',
      education_health_literacy: 'high',
      dob: '1997-04-05',
    },
    dialogue_style: {
      verbosity: 'balanced',
      tone: 'friendly',
    },
    ...overrides as any,
  } as PatientPersona;
}

function makeScenario(overrides: Partial<ClinicalScenario> = {}): ClinicalScenario {
  const base: ClinicalScenario = {
    scenario_id: 'sc_unit_test_minimal',
    title: 'Unit Test Scenario',
    region: 'knee',
    presenting_problem: {},
    icf: {},
    scenario_context: {},
    symptom_fluctuation: {},
    objective_guardrails: {},
    guardrails: {},
    instructions: {},
    soap: {},
  } as any;
  return { ...base, ...overrides };
}

function makeActiveCase(): ActiveCase {
  return {
    id: 'ac_unit_01',
    persona: makePersona(),
    scenario: makeScenario(),
  };
}

describe('composeRealtimeInstructions role directives', () => {
  it('includes Patient role directive and identity guidance for patient role', () => {
    const ac = makeActiveCase();
    const out = composeRealtimeInstructions({
      activeCase: ac,
      role_id: 'patient',
      audience: 'student',
      phase: 'subjective',
      gate: { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false },
    });

    // Baseline is always included
    expect(out).toMatch(/Interaction Baseline/i);

    // Patient role directive block present
    expect(out).toMatch(/Role directive \(PATIENT\):/);

    // Identity verification rule should be present in patient directive
    expect(out).toMatch(/Identity verification:.*date of birth.*ONLY when explicitly asked/i);
  });

  it('does not include patient-only identity guidance for translator role', () => {
    const ac = makeActiveCase();
    const out = composeRealtimeInstructions({
      activeCase: ac,
      role_id: 'translator',
      audience: 'student',
      phase: 'subjective',
      gate: { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false },
    });

    // Baseline is always included
    expect(out).toMatch(/Interaction Baseline/i);

    // Translator directive present
    expect(out).toMatch(/Role directive \(TRANSLATOR\):/);

    // Patient-specific identity rule should NOT appear in translator instructions
    expect(out).not.toMatch(/Identity verification:.*date of birth.*ONLY when explicitly asked/i);
  });
});
