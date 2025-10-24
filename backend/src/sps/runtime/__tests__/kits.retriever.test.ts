import { describe, it, expect } from 'vitest';
import { loadScenarioKit, retrieveFacts, formatRetrievedFacts } from '../kits.ts';

describe('kits retriever', () => {
  it('loads the PFP kit and retrieves facts (student audience)', () => {
    const kit = loadScenarioKit('patellofemoral_pain_v1');
    expect(kit).toBeTruthy();
    expect(kit?.case_id).toBe('patellofemoral_pain_v1');
    expect(Array.isArray(kit?.chunks)).toBe(true);

    const { texts, ids } = retrieveFacts(kit!, {
      roleId: 'clinician',
      phase: 'subjective',
      topK: 5,
      maxLen: 500,
      query: 'stairs squat running',
      audience: 'student',
    });

    expect(ids.length).toBeGreaterThan(0);
    expect(texts.length).toBe(ids.length);
    // Student should not receive faculty-only chunks
    expect(ids.some(id => id.startsWith('faculty_'))).toBe(false);

    const formatted = formatRetrievedFacts(texts);
    expect(formatted).toContain('Retrieved case facts');
    expect(formatted.split('\n').length).toBeGreaterThan(1);
  });

  it('includes faculty-only items when audience is faculty', () => {
    const kit = loadScenarioKit('patellofemoral_pain_v1');
    expect(kit).toBeTruthy();
    const { ids } = retrieveFacts(kit!, {
      roleId: 'clinician',
      phase: 'treatment_plan',
      topK: 10,
      maxLen: 800,
      query: 'ground truth diagnosis patellofemoral',
      audience: 'faculty',
    });
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('faculty_ground_truth');
  });
});
