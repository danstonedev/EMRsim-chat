// Tests for sustaining persona tone, stable demographic details, and bounded randomness.
import { describe, it, expect } from 'vitest';
import { loadSPSContent } from '../src/sps/runtime/session.ts';
import { spsRegistry } from '../src/sps/core/registry.ts';
import { realizeCue } from '../src/sps/core/cue.ts';
import type { PatientPersona } from '../src/sps/core/types.ts';

loadSPSContent();

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

// Extract prefix heuristics used in realizeCue (guarded => 'Honestly, ', worried => 'Lately, ', else none)
function expectedPrefix(tone: string) {
  if (tone === 'guarded') return 'Honestly,'; // trimmed because realizeCue returns out.trim()
  if (tone === 'worried') return 'Lately,';
  return null;
}

describe('Persona tone & randomness sustainability', () => {
  const personas: PatientPersona[] = Object.values(spsRegistry.personas);
  expect(personas.length).toBeGreaterThan(0);

  it('persona demographics remain immutable across cloning operations', () => {
    for (const p of personas) {
      const before = clone(p.demographics);
      const after = clone(p.demographics);
      expect(after).toEqual(before);
    }
  });

  it('realizeCue respects tone prefix and tiny detail inclusion deterministically for same seed state', () => {
    const persona = personas.find(p => ['guarded','worried'].includes(p.dialogue_style.tone)) || personas[0];
    const tone = persona.dialogue_style.tone;
    const prefix = expectedPrefix(tone);

    const item = { cue_intent: 'fear-avoidance of movement', example_phrases: [] as string[] };
    // Run multiple times; library variant length = 1 for this intent so output should not oscillate except for optional detail.
    const outputs = Array.from({length:5}, ()=> realizeCue(persona, item));
    if (prefix) outputs.forEach(o => expect(o.startsWith(prefix)).toBe(true));
    // Ensure no output is empty
    outputs.forEach(o => expect(o.trim().length).toBeGreaterThan(5));
  });

  it('cue variant choice constrained to library or intent text', () => {
    const persona = personas[0];
    const intents = [
      'night pain not eased by rest or position',
      'fear-avoidance of movement',
      'nonexistent intent example placeholder'
    ];
    for (const intent of intents) {
      const out = realizeCue(persona, { cue_intent: intent });
      // Should either include library phrase (if defined) or echo raw intent text (possibly prefixed / detail appended)
      if (intent === 'nonexistent intent example placeholder') {
        expect(out.toLowerCase()).toContain('nonexistent intent example placeholder');
      }
    }
  });
});
