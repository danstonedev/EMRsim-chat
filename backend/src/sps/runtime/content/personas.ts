import { normalizePersona } from '../../core/normalization/index.ts';
import type { DOBChallenge, PatientPersona } from '../../core/types.ts';

export function buildDobChallenges(name: string, dob: string): DOBChallenge[] {
  const who = name || 'Patient';
  return [
    { style: 'straightforward', example_response: `${who}, ${dob}.` },
    { style: 'clarification', example_response: `${who}. Date of birth ${dob}.` },
  ];
}

export function convertPersonaBundle(
  personaRaw: any,
  instructions: any,
  subjective: any,
  plan: any,
): PatientPersona | null {
  const normalized = normalizePersona({ raw: personaRaw, instructions, subjective, plan });
  if (!normalized) return null;

  return {
    ...normalized,
    beliefs_affect: {
      ...normalized.beliefs_affect,
      fears: Array.isArray(plan?.safety_netting)
        ? plan.safety_netting.map((s: any) => String(s)).filter(Boolean)
        : undefined,
      mood: normalized.dialogue_style.tone,
    },
    medical_baseline: (Array.isArray(subjective?.past_medical_history) || Array.isArray(subjective?.medications))
      ? {
          comorbidities: Array.isArray(subjective?.past_medical_history)
            ? subjective.past_medical_history.map((s: any) => String(s)).filter(Boolean)
            : undefined,
          medications: Array.isArray(subjective?.medications)
            ? subjective.medications.map((s: any) => String(s)).filter(Boolean)
            : undefined,
        }
      : undefined,
    closure_style: Array.isArray(personaRaw.goals_patient_voice) && personaRaw.goals_patient_voice.length
      ? { preferred_questions: personaRaw.goals_patient_voice.map((s: any) => String(s)).filter(Boolean) }
      : undefined,
    dob_challenges: buildDobChallenges(normalized.demographics.name, normalized.demographics.dob),
  } as PatientPersona;
}
