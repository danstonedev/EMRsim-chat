// Automated conversation traversal test (structural integrity)
// This test composes every persona+scenario pair and simulates a minimal, structured interview
// to detect runtime errors, missing data, and stuck gate/phase transitions using the new SPS schema.
// It is NOT attempting to validate clinical accuracy—only structural integrity.

import { describe, it, expect } from 'vitest';
import { loadSPSContent } from '../src/sps/runtime/session.ts';
import { spsRegistry } from '../src/sps/core/registry.ts';
import { getGoldInstructions, handleStudentTurn } from '../src/sps/runtime/sps.service.ts';
import { GateFlags, ActiveCase } from '../src/sps/core/types.ts';

function unlockedGate(): GateFlags {
  return { greeting_done: true, intro_done: true, consent_done: true, identity_verified: true };
}

function subjectivePrompts(ac: ActiveCase): string[] {
  const sc = ac.scenario;
  const specials = spsRegistry.getScenarioSpecials(sc).map(sq => sq.student_prompt_patterns[0]).filter(Boolean);
  const challenges = spsRegistry.getScenarioChallenges(sc).map(ch => ch.reveal_triggers[0]).filter(Boolean);
  const norm = (s: string) => s.replace(/^if student asks about\s*/i, '').split(/[,.;]/)[0];
  const uniq = Array.from(new Set([...specials, ...challenges].map(norm)));
  return uniq.length ? uniq : ['pain', 'function'];
}

function objectivePrompts(ac: ActiveCase): string[] {
  return ac.scenario.objective_catalog.slice(0, 6).map(o => o.label);
}

function treatmentPrompts(): string[] {
  return [
    'What home exercise frequency makes sense?',
    'Can you outline realistic goals?',
    'Anything else before we wrap up?'
  ];
}

function drivePhase(ac: ActiveCase, phase: 'subjective'|'objective'|'treatment_plan', prompts: string[], gate: GateFlags) {
  const replies: string[] = [];
  for (const p of prompts) {
    const { patientReply } = handleStudentTurn(ac, phase, gate, p);
    replies.push(patientReply ?? '');
  }
  return replies;
}

describe('SPS structural conversation traversal', () => {
  loadSPSContent();
  const personas = Object.keys(spsRegistry.personas);
  const scenarios = Object.keys(spsRegistry.scenarios);

  it('gold instructions available', () => {
    const instr = getGoldInstructions();
    expect(typeof instr).toBe('string');
    expect(instr.length).toBeGreaterThan(10);
  });

  it('traverses each persona+scenario without runtime errors', () => {
    expect(personas.length).toBeGreaterThan(0);
    expect(scenarios.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const pid of personas) {
      for (const sid of scenarios) {
        try {
          const ac = spsRegistry.composeActiveCase(pid, sid);
          const gate = unlockedGate();
          const subj = drivePhase(ac, 'subjective', subjectivePrompts(ac), gate);
          const obj = drivePhase(ac, 'objective', objectivePrompts(ac), gate);
          const tx = drivePhase(ac, 'treatment_plan', treatmentPrompts(), gate);

          // Assertions
          expect(subj.length).toBeGreaterThan(0);
          expect(obj.length).toBeGreaterThan(0);
          expect(tx.length).toBeGreaterThan(0);
          const anyContent = subj.concat(obj).some(r => (r||'').trim().length > 0);
          if (!anyContent) throw new Error('No patient content produced');
        } catch (e: any) {
          failures.push(`${pid}::${sid} -> ${e.message}`);
        }
      }
    }

    if (failures.length) {
      console.error('Conversation traversal failures:', failures);
    }
    expect(failures).toEqual([]);
  });
});
