// Automated conversation traversal test
// This test composes every persona+scenario pair and simulates a minimal, structured interview
// to detect runtime errors, missing data, and stuck gate/phase transitions.
// It is NOT attempting to validate clinical accuracy—only structural integrity.

import { describe, it, expect } from 'vitest';
import { loadSPSContent } from '../../sps/runtime/session.ts';
import { spsRegistry } from '../../sps/core/registry.ts';
import { getGoldInstructions, handleStudentTurn, nextPhase } from '../../sps/runtime/sps.service.ts';
import { GateFlags, EncounterPhase, ActiveCase } from '../../sps/core/types.ts';

// Helper: create initial gate flags (student performs ideal intro immediately)
function unlockedGate(): GateFlags {
  return { greeting_done: true, intro_done: true, consent_done: true, identity_verified: true };
}

// Very naive subjective questioning strategy: ask about each trigger keyword once.
function subjectivePrompts(ac: ActiveCase): string[] {
  const sc = ac.scenario;
  const specials = spsRegistry.getScenarioSpecials(sc).map(sq => sq.student_prompt_patterns[0]).filter(Boolean);
  const challenges = spsRegistry.getScenarioChallenges(sc).map(ch => ch.reveal_triggers[0]).filter(Boolean);
  // remove leading boilerplate from triggers (matcher strips 'if student asks about')
  const norm = (s: string) => s.replace(/^if student asks about\s*/i, '').split(/[,.;]/)[0];
  const uniq = Array.from(new Set([...specials, ...challenges].map(norm)));
  // fallback if nothing
  return uniq.length ? uniq : ['pain', 'function'];
}

// Objective prompts: attempt to request each objective test label once
function objectivePrompts(ac: ActiveCase): string[] {
  return ac.scenario.objective_catalog.slice(0, 6).map(o => o.label); // cap to avoid huge loops
}

// Treatment prompts: simple generic planning queries
function treatmentPrompts(): string[] {
  return [
    'What home exercise frequency makes sense?',
    'Can you outline realistic goals?',
    'Anything else before we wrap up?'
  ];
}

// Drive a phase with supplied prompts; returns collected patient replies
function drivePhase(ac: ActiveCase, phase: EncounterPhase, prompts: string[], gate: GateFlags) {
  const replies: string[] = [];
  for (const p of prompts) {
    const { patientReply } = handleStudentTurn(ac, phase, gate, p);
    replies.push(patientReply ?? '');
  }
  return replies;
}

describe('SPS conversation structural traversal', () => {
  loadSPSContent();

  const personas = Object.keys(spsRegistry.personas);
  const scenarios = Object.keys(spsRegistry.scenarios);
  expect(personas.length).toBeGreaterThan(0);
  expect(scenarios.length).toBeGreaterThan(0);

  it('gold instructions available', () => {
    const instr = getGoldInstructions();
    expect(typeof instr).toBe('string');
    expect(instr.length).toBeGreaterThan(10);
  });

  it('can traverse each persona + scenario without runtime errors', () => {
    const failures: string[] = [];

    for (const pid of personas) {
      for (const sid of scenarios) {
        try {
          const ac = spsRegistry.composeActiveCase(pid, sid);
          const gate = unlockedGate();

          // Subjective
          const subjPrompts = subjectivePrompts(ac);
            const subjReplies = drivePhase(ac, 'subjective', subjPrompts, gate);
          // Objective
          const objPrompts = objectivePrompts(ac);
          const objReplies = drivePhase(ac, 'objective', objPrompts, gate);
          // Treatment
          const txPrompts = treatmentPrompts();
          const txReplies = drivePhase(ac, 'treatment_plan', txPrompts, gate);

          // Basic structural assertions
          expect(subjReplies.length).toBeGreaterThan(0);
          expect(objReplies.length).toBeGreaterThan(0);
          expect(txReplies.length).toBeGreaterThan(0);

          // Ensure at least one subjective reply revealed some content (not just empty strings)
          const anyContent = subjReplies.concat(objReplies).some(r => (r||'').trim().length > 0);
          if (!anyContent) throw new Error('No patient content produced');

        } catch (e: any) {
          failures.push(`${pid}::${sid} -> ${e.message}`);
        }
      }
    }

    if (failures.length) {
      // Provide aggregated failure details for easier debugging
      console.error('Conversation traversal failures:', failures);
    }
    expect(failures).toEqual([]);
  });
});
