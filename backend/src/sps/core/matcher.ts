import { ClinicalScenario, ScreeningChallenge, SpecialQuestion } from './types';
import { spsRegistry } from './registry';

const triggerKey = (t: string) => t.replace(/^if student asks about\s*/i, '').split(/\s+/)[0];

export function findScreeningHit(scenario: ClinicalScenario, text: string): ScreeningChallenge | null {
  const lower = text.toLowerCase();
  const bank = spsRegistry.getScenarioChallenges(scenario);
  return bank.find(ch => ch.reveal_triggers.some(t => lower.includes(triggerKey(t)))) || null;
}
export function findSpecialHit(scenario: ClinicalScenario, text: string): SpecialQuestion | null {
  const lower = text.toLowerCase();
  const bank = spsRegistry.getScenarioSpecials(scenario);
  return bank.find(sq => sq.student_prompt_patterns.some(p => lower.includes(p))) || null;
}
