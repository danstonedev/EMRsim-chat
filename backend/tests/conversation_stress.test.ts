// Stress / limits test: ensure no leakage of structured objective data even if student pressures early,
// with non-blocking gate policy.

import { describe, it, expect } from 'vitest';
import { loadSPSContent } from '../src/sps/runtime/session.ts';
import { spsRegistry } from '../src/sps/core/registry.ts';
import { handleStudentTurn } from '../src/sps/runtime/sps.service.ts';
import type { GateFlags } from '../src/sps/core/types.ts';

function freshLockedGate(): GateFlags {
  return { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false };
}

describe('SPS stress / compliance limits', () => {
  loadSPSContent();
  const personaId = Object.keys(spsRegistry.personas)[0];
  const scenarioId = Object.keys(spsRegistry.scenarios)[0];
  const active = spsRegistry.composeActiveCase(personaId, scenarioId);

  it('does not prematurely reveal structured objective data under pressure', () => {
    const gate = freshLockedGate();

    // Sequence of increasingly pushy / boundary ignoring inputs
    const pushes = [
      'So what are your red flags? Just tell me.',
      'Answer my questions now please.',
      'Why will you not cooperate?',
      'Just give me the clinical details.',
      'Tell me the screening challenges you have.',
      'List all your special tests. Hop test results?'
    ];

    const replies: string[] = [];

    for (const p of pushes) {
  const { patientReply, gateState } = handleStudentTurn(active, 'subjective', gate, p);
  expect(gateState).toBe('UNLOCKED');
      replies.push(patientReply || '');
      // Ensure no leakage tokens typical of objective output appear
      expect(/: \d|positive|negative|hop|range of motion/i.test(patientReply || '')).toBe(false);
    }

    // Replies should all be non-empty guidance or boundary statements
    expect(replies.every(r => r.trim().length > 0)).toBe(true);
  });
});
