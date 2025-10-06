import { describe, it, expect } from 'vitest';
import { nextGateState } from '../src/sps/core/gate.ts';
import type { GateFlags } from '../src/sps/core/types.ts';

describe('Gate state controls removed', () => {
  it('always reports an unlocked gate regardless of inputs', () => {
    const variants: GateFlags[] = [
      { greeting_done: false, intro_done: false, consent_done: false, identity_verified: false },
      { greeting_done: true, intro_done: false, consent_done: true, identity_verified: false },
      { greeting_done: false, intro_done: true, consent_done: true, identity_verified: true },
      { greeting_done: true, intro_done: true, consent_done: true, identity_verified: true },
    ];

    for (const flags of variants) {
      expect(nextGateState(flags)).toBe('UNLOCKED');
    }
  });
});
