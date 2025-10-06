import { describe, it, expect, beforeAll } from 'vitest';
import { loadSPSContent } from '../src/sps/runtime/session';
import { findScreeningHit, findSpecialHit } from '../src/sps/core/matcher';

let screeningScenario: any;
let specialScenario: any;

beforeAll(() => {
  loadSPSContent();
  screeningScenario = {
    scenario_id: 'stub_screening',
    screening_challenge_ids: ['Y6', 'Y3', 'Y1'],
  } as any;
  specialScenario = {
    scenario_id: 'stub_special',
    special_question_ids: ['SQ_K_2'],
  } as any;
});

describe('Matcher', () => {
  it('finds a screening challenge (goal Y6)', () => {
    const hit = findScreeningHit(screeningScenario, 'My main goal is to walk farther');
    expect(hit?.id).toBe('Y6');
  });
  it('returns null for unrelated text', () => {
    const hit = findScreeningHit(screeningScenario, 'Random unrelated statement');
    expect(hit).toBeNull();
  });
  it('finds special question by pattern (knee instability)', () => {
    const sq = findSpecialHit(specialScenario, 'It feels unstable and might give way.');
    // Knee special question pattern includes unstable/buckl/giving way => choose one that matches
    expect(sq).toBeTruthy();
    expect(sq!.id).toBe('SQ_K_2');
  });
});
