import { describe, it, expect, beforeAll } from 'vitest';
import { loadSPSContent } from '../src/sps/runtime/session';
import { handleStudentTurn } from '../src/sps/runtime/sps.service';
import { ActiveCase, GateFlags } from '../src/sps/core/types';

let active: ActiveCase;
const baseGate: GateFlags = { greeting_done: true, intro_done: true, consent_done: true, identity_verified: true };

beforeAll(() => {
  const reg = loadSPSContent();
  const personaFromRegistry = Object.values(reg.personas)[0];
  const persona = (personaFromRegistry || {
    patient_id: 'sp_persona_stub_v1',
    demographics: {
      name: 'Casey Example',
      preferred_name: 'Casey',
      age: 32,
      pronouns: 'they/them',
      sex: 'unspecified',
      occupation: 'Engineer',
    },
    dialogue_style: {
      tone: 'friendly',
      verbosity: 'balanced',
    },
  }) as ActiveCase['persona'];
  const scenario = {
    scenario_id: 'sc_stub_guardrail',
    title: 'Guardrail demo scenario',
    region: 'knee',
    objective_catalog: [
      {
        test_id: 'palp_femoral_shaft',
        label: 'Palp Femoral Shaft',
        patient_output_script: {
          qualitative: ['Sharp 7/10 tenderness along the shaft.'],
        },
      },
      {
        test_id: 'single_leg_hop',
        label: 'Single-Leg Hop Test',
        patient_output_script: {
          qualitative: ['I would avoid hopping right now.'],
        },
      },
    ],
    objective_guardrails: {
      deflection_lines: ['Tell me which movement you want me to try, and I’ll describe what I feel.'],
      require_explicit_physical_consent: true,
    },
    guardrails: {
      impact_testing_unsafe: true,
    },
  } as ActiveCase['scenario'];

  active = {
    id: `${persona.patient_id}::${scenario.scenario_id}`,
    persona,
    scenario,
  } as ActiveCase;
});

describe('Objective guardrails', () => {
  it('requires explicit consent before objective if not given', () => {
    const localGate: GateFlags = { ...baseGate, consent_done: false, identity_verified: false };
    const res = handleStudentTurn(active, 'objective', localGate, 'Let us measure hip flexion');
    // Non-blocking gate: expect a consent deflection prior to testing
    expect(res.patientReply.toLowerCase()).toMatch(/before we do any physical tests|make sure i’m comfortable|explain what you’ll do/);
  });

  it('deflects when no specific test identified', () => {
    const g: GateFlags = { ...baseGate, consent_done: true };
    const res = handleStudentTurn(active, 'objective', g, 'Can you show me something?');
    // Expect default deflection requesting specific movement if no match
    expect(res.patientReply.toLowerCase()).toMatch(/which movement|tell me which movement|only perform low-risk/);
  });

  it('refuses unsafe hop test', () => {
    const g: GateFlags = { ...baseGate, consent_done: true };
    const res = handleStudentTurn(active, 'objective', g, 'Please perform hop test single-leg');
    expect(res.patientReply.toLowerCase()).toMatch(/rather avoid|avoid any hopping/);
  });

  it('returns data-only script for a known test', () => {
    const g: GateFlags = { ...baseGate, consent_done: true };
    const res = handleStudentTurn(active, 'objective', g, 'palp femoral shaft');
    expect(/point tenderness/i.test(res.patientReply) || /sharp 7\/10/i.test(res.patientReply)).toBe(true);
  });
});
