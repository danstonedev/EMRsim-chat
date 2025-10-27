import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { zClinicalScenario, zPersona, zScreeningChallenge, zSpecialQuestion } from '../src/sps/core/schemas.js';
import { loadSPSContent } from '../src/sps/runtime/session.js';
import challenges from '../src/sps/content/banks/challenges/red_yellow.core.json' with { type: 'json' };
import sqKnee from '../src/sps/content/banks/special_questions/knee.json' with { type: 'json' };

let scenario: any;
let persona: any;

const zObjectiveFinding = z.object({
  test_id: z.string(),
  label: z.string(),
  patient_output_script: z
    .object({
      numeric: z.record(z.union([z.number(), z.string()])).optional(),
      qualitative: z.array(z.string()).optional(),
      binary_flags: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
    })
    .passthrough(),
}).passthrough();

beforeAll(() => {
  const reg = loadSPSContent();
  const scenarios = Object.values(reg.scenarios || {});
  scenario = scenarios.find((sc: any) => sc?.schema_version?.startsWith?.('3')) || scenarios[0];
  persona = Object.values(reg.personas || {})[0];
  if (!scenario) throw new Error('Expected at least one scenario to load from registry');
  if (!persona) throw new Error('Expected at least one persona to load from registry');
});

describe('Schema validation smoke', () => {
  it('persona validates', () => {
    expect(() => zPersona.parse(persona)).not.toThrow();
  });
  it('scenario validates', () => {
    expect(scenario).toBeTruthy();
    expect(() => zClinicalScenario.parse(scenario)).not.toThrow();
  });
  it('challenge bank entries validate', () => {
    for (const c of challenges as any[]) {
      expect(() => zScreeningChallenge.parse(c)).not.toThrow();
    }
  });
  it('special question entries validate', () => {
    for (const sq of sqKnee as any[]) {
      expect(() => zSpecialQuestion.parse(sq)).not.toThrow();
    }
  });
  it('objective catalog items validate', () => {
    const objectives = Array.isArray(scenario.objective_catalog) ? scenario.objective_catalog : [];
    for (const o of objectives) {
      expect(() => zObjectiveFinding.parse(o)).not.toThrow();
    }
  });
});
