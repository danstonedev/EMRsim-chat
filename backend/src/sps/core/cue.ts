import { PatientPersona } from './types';

const LIB: Record<string, string[]> = {
  'night pain not eased by rest or position': ['It wakes me and no position makes it better.'],
  'fear-avoidance of movement': ['I’ve been avoiding certain moves because I’m afraid it’ll flare.']
};

function variant(intent: string) { const v = LIB[intent]; return v ? v[Math.floor(Math.random()*v.length)] : intent; }
function tinyDetail(persona: PatientPersona) {
  const fx = persona.function_context || {};
  const a = fx.adl_limitations?.[0] || fx.sport_limitations?.[0] || '';
  return a ? ` Especially when ${a.toLowerCase()}.` : '';
}
export function realizeCue(
  persona: PatientPersona,
  item: { cue_intent?: string; patient_cue_intent?: string; example_phrases?: string[] },
  opts?: { brief?: boolean }
) {
  const tone = persona.dialogue_style.tone;
  const pre = tone === 'guarded' ? 'Honestly, ' : tone === 'worried' ? 'Lately, ' : '';
  const intent = (item as any).cue_intent || (item as any).patient_cue_intent || '';
  const out = pre + variant(intent) + (opts?.brief ? '' : tinyDetail(persona));
  return out.trim();
}
