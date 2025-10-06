import { GOLD_STANDARD_SPS_INSTRUCTIONS } from '../core/instructions';
import { nextGateState } from '../core/gate';
import { findSpecialHit, findScreeningHit } from '../core/matcher';
import { realizeCue } from '../core/cue';
import { ActiveCase, EncounterPhase, GateFlags } from '../core/types';

export function getGoldInstructions(){ return GOLD_STANDARD_SPS_INSTRUCTIONS; }
export function nextPhase(current: EncounterPhase, signal?: 'move_objective'|'move_treatment'): EncounterPhase {
  if (signal==='move_objective') return 'objective';
  if (signal==='move_treatment') return 'treatment_plan';
  return current;
}

export function handleStudentTurn(active: ActiveCase, phase: EncounterPhase, gate: GateFlags, text: string) {
  const gateState = nextGateState(gate);
  // New policy: do NOT block when gate is locked. Always respond in character.
  // Gate remains for grading/telemetry only.

  if (phase==='subjective') {
    const sq = findSpecialHit(active.scenario, text);
    if (sq) return { gateState, patientReply: realizeCue(active.persona, sq) };
    const sc = findScreeningHit(active.scenario, text);
    if (sc) return { gateState, patientReply: realizeCue(active.persona, sc) };
    // Optional: if scenario has a subjective_catalog, try simple pattern match
    const subj = active.scenario.subjective_catalog;
    if (Array.isArray(subj) && subj.length) {
      const t = text.toLowerCase();
      const hit = subj.find(it => it.patterns.some(p => t.includes(p.toLowerCase())));
      if (hit) {
        const scr = hit.patient_response_script;
        const lines: string[] = [];
        if (scr.qualitative?.length) lines.push(scr.qualitative[0]);
        if (scr.numeric) { const kv = Object.entries(scr.numeric).map(([k,v]) => `${k}: ${v}`); if (kv.length) lines.push(kv.join('; ')); }
        if (scr.binary_flags) { const flags = Object.entries(scr.binary_flags).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`); if (flags.length) lines.push(flags.join('; ')); }
        return { gateState, patientReply: lines.join('. ') };
      }
    }
    // Default, stay in character with a neutral, tone-aware reply
    return { gateState, patientReply: defaultSubjectiveReply(active, text) };
  }

  if (phase==='objective') return runObjectiveExchange(active, text, gate);

  return { gateState, patientReply: realizePlanDialogue(active, text) };
}

function defaultSubjectiveReply(active: ActiveCase, _text: string): string {
  const tone = active.persona.dialogue_style?.tone || 'balanced';
  const name = active.persona.demographics?.preferred_name || active.persona.demographics?.name || 'I';
  const genericByTone: Record<string,string> = {
    friendly: `Hi—sure. What would you like to know?`,
    guarded: `Honestly, what do you want to know first?`,
    disinterested: `What do you want to know?`,
    worried: `Lately, I’ve just been worried about how this feels. What do you need to ask?`,
    irritable: `Can we just get to your questions?`,
    stoic: `Go ahead with your questions.`,
    optimistic: `I’m ready—what should we start with?`,
    balanced: `Sure—what would you like to know?`
  };
  const base = genericByTone[tone] || genericByTone['balanced'];
  // Light personalization without revealing protected details unless asked later
  return base.replace('Hi—sure', `Hi—${name} here, sure`);
}

function runObjectiveExchange(active: ActiveCase, text: string, gate: GateFlags) {
  const scn = active.scenario; const guard = scn.objective_guardrails ?? {};
  const t = text.toLowerCase();
  // Only gate on consent if explicitly required, gate flags show consent not yet done, AND user has not indicated consent keywords.
  if (guard.require_explicit_physical_consent && !gate.consent_done && !/(consent|okay to test|you have my consent|that is okay)/i.test(t)) {
    return { gateState: 'UNLOCKED' as const, patientReply: 'Before we do any physical tests, could you explain what you’ll do and make sure I’m comfortable with it?' };
  }
  // Flexible token-based match: split test_id words and allow partial token presence.
  const match = scn.objective_catalog.find(o => {
    const label = o.label.toLowerCase();
    if (t.includes(o.test_id) || t.includes(label)) return true;
    // allow simplified queries like 'palp femoral'
    const tokens = label.split(/[^a-z0-9]+/).filter(Boolean).slice(0,3); // first few distinctive tokens
    return tokens.filter(tok => tok.length>3).some(tok => t.includes(tok));
  });
  if (!match) {
    const deflect = guard.deflection_lines?.[0] ?? 'Tell me which movement you want me to try, and I’ll describe what I feel.';
    return { gateState: 'UNLOCKED' as const, patientReply: deflect };
  }
  // Refusal pathway for unsafe impact / hop tests
  if (active.scenario.guardrails?.impact_testing_unsafe && /hop|impact|jump/.test(match.label.toLowerCase())) {
    return { gateState: 'UNLOCKED' as const, patientReply: 'Given what’s going on, I’d rather avoid any hopping or impact tests until we’re sure it’s safe.' };
  }
  const scr = match.patient_output_script;
  const lines: string[] = [];
  if (scr.numeric) { const kv = Object.entries(scr.numeric).map(([k,v]) => `${k}: ${v}`); if (kv.length) lines.push(kv.join('; ')); }
  if (scr.binary_flags) { const flags = Object.entries(scr.binary_flags).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`); if (flags.length) lines.push(flags.join('; ')); }
  if (scr.qualitative?.length) lines.push(scr.qualitative[0]);
  const out = lines.join('. ') || 'Okay—guide me through and I’ll say how it feels.';
  return { gateState: 'UNLOCKED' as const, patientReply: out };
}

function realizePlanDialogue(active: ActiveCase, text: string) {
  const pf = active.persona.function_context || {}; const sc = active.scenario.scenario_context || {};
  const deflect = 'I can say what seems realistic for me—does that help?';
  if (/home\s?exercise|how often|per week|sets|reps|program/i.test(text)) {
    const bits = [ pf.work_demands && `Work: ${pf.work_demands}`, sc.environment && `Environment: ${sc.environment}`, pf.sleep_quality && `Sleep: ${pf.sleep_quality}`].filter(Boolean).join('. ');
    return bits || deflect;
  }
  if (/goals?|timeline|return/i.test(text)) return (sc.goals?.[0] || 'Something realistic that fits my routine.');
  return deflect;
}

const BOOLEAN_GATE_KEYS = ['greeting_done', 'intro_done', 'consent_done', 'identity_verified'] as const;

const BASE_GATE_FLAGS: GateFlags = Object.freeze({
  greeting_done: false,
  intro_done: false,
  consent_done: false,
  identity_verified: false,
});

const GATE_LABELS: Record<'greeting_done'|'intro_done'|'consent_done'|'identity_verified', string> = {
  greeting_done: 'Greeting exchange',
  intro_done: 'Student introduction',
  consent_done: 'Consent to proceed',
  identity_verified: 'Identity verification (name + DOB)',
};

const PHASE_GUIDANCE: Record<'subjective'|'objective'|'treatment_plan'|'default', string> = {
  subjective: 'Stay in the subjective history lane. Offer relevant symptom details, timelines, and contextual factors but avoid volunteering objective findings or treatment plans until asked within this phase.',
  objective: 'Respond as a patient experiencing the examination. Describe sensations, limits, and guardrails tied to each maneuver. Do not invent tests not requested by the student.',
  treatment_plan: 'Collaborate on planning. Share preferences, daily realities, and reasonable goals. Ask clarifying questions if the plan feels unclear or unrealistic.',
  default: 'Respond naturally while respecting the encounter structure and prior guidance.',
};

function formatList(values: unknown, max = 3): string {
  if (!Array.isArray(values)) return '';
  const cleaned = values
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (!cleaned.length) return '';
  const trimmed = cleaned.slice(0, max);
  if (cleaned.length > max) trimmed.push('…');
  return trimmed.join('; ');
}

function buildPersonaSection(persona?: ActiveCase['persona'] | null): string {
  if (!persona) return '';
  const demographics = persona.demographics || {};
  const identityBits: string[] = [];
  const name = demographics.preferred_name || demographics.name || persona.patient_id || 'Patient';
  identityBits.push(name);
  if (demographics.pronouns) identityBits.push(`(${demographics.pronouns})`);
  if (typeof demographics.age === 'number') identityBits.push(`${demographics.age}-year-old`);

  const lines = ['Persona snapshot:'];
  lines.push(`- Identity: ${identityBits.join(' ')}`);
  
  // Include full name and DOB for identity verification
  const fullName = demographics.name || name;
  const dob = demographics.dob;
  if (fullName) lines.push(`- Full name: ${fullName}`);
  if (dob) lines.push(`- Date of birth: ${dob}`);
  
  if (demographics.occupation) lines.push(`- Occupation: ${demographics.occupation}`);
  if (persona.dialogue_style?.tone) lines.push(`- Tone: ${persona.dialogue_style.tone}`);
  if (persona.dialogue_style?.verbosity) lines.push(`- Typical detail level: ${persona.dialogue_style.verbosity}`);
  const fears = formatList(persona.beliefs_affect?.fears);
  if (fears) lines.push(`- Concerns: ${fears}`);
  if (persona.beliefs_affect?.mood) lines.push(`- Mood: ${persona.beliefs_affect.mood}`);
  return lines.join('\n');
}

function buildScenarioSection(scenario?: ActiveCase['scenario'] | null): string {
  if (!scenario) return '';
  const lines = [`Scenario context: ${scenario.title || scenario.scenario_id || 'Unknown scenario'}`];
  const presenting = scenario.presenting_problem || {};
  if (presenting.primary_dx) lines.push(`- Primary concern: ${presenting.primary_dx}`);
  const dominant = formatList(presenting.dominant_symptoms);
  if (dominant) lines.push(`- Dominant symptoms: ${dominant}`);
  const aggravators = formatList(presenting.aggravators);
  if (aggravators) lines.push(`- Aggravators: ${aggravators}`);
  const easers = formatList(presenting.easers);
  if (easers) lines.push(`- Relieved by: ${easers}`);
  const goals = formatList(scenario.scenario_context?.goals);
  if (goals) lines.push(`- Patient goals: ${goals}`);
  if (scenario.scenario_context?.environment) lines.push(`- Environment: ${scenario.scenario_context.environment}`);
  return lines.join('\n');
}

export function normalizeGate(gate?: Partial<GateFlags> | null): GateFlags {
  const normalized: GateFlags = { ...BASE_GATE_FLAGS };
  if (gate && typeof gate === 'object') {
    for (const key of BOOLEAN_GATE_KEYS) {
      if (gate[key] === true) normalized[key] = true;
    }
    if (typeof gate.locked_pressure_count === 'number') normalized.locked_pressure_count = gate.locked_pressure_count;
    if (typeof gate.supervisor_escalated === 'boolean') normalized.supervisor_escalated = gate.supervisor_escalated;
  }
  return normalized;
}

// Compute human-readable outstanding gate items based on boolean flags
export function computeOutstandingGate(gate: GateFlags): string[] {
  const out: string[] = []
  for (const key of BOOLEAN_GATE_KEYS) {
    if (!gate[key]) {
      out.push(GATE_LABELS[key])
    }
  }
  return out
}

function buildMediaGuidance(scenario: ActiveCase['scenario']): string {
  if (!scenario.media_library || scenario.media_library.length === 0) return '';
  
  const lines = ['Visual demonstration capability:'];
  lines.push('When clinically appropriate during the OBJECTIVE phase, you may trigger visual media by including [MEDIA:media_id] in your response.');
  lines.push('Use this when:');
  lines.push('- Student explicitly asks to see or demonstrate something physical (e.g., "show me your knee ROM")');
  lines.push('- Visual observation would significantly enhance clinical understanding');
  lines.push('- During physical examination or functional testing');
  
  lines.push('\nAvailable media assets:');
  scenario.media_library.forEach(media => {
    const contexts = media.clinical_context.slice(0, 3).join(', ');
    lines.push(`- [MEDIA:${media.id}] (${media.type}): ${contexts}`);
  });
  
  lines.push('\nExample: "Sure, let me bend my knee for you. [MEDIA:knee_flexion_active]"');
  lines.push('Note: Text will be shown to student; [MEDIA:...] marker triggers visual display.');
  
  return lines.join('\n');
}

export function composeRealtimeInstructions(context: {
  activeCase?: ActiveCase | null;
  phase?: EncounterPhase | null;
  gate?: Partial<GateFlags> | null;
  outstandingGate?: string[] | null;
}): string {
  const sections: string[] = [];
  const gold = getGoldInstructions()?.trim?.() || '';
  if (gold) sections.push(gold);

  if (context?.activeCase) {
    const personaSection = buildPersonaSection(context.activeCase.persona);
    if (personaSection) sections.push(personaSection);

    const scenarioSection = buildScenarioSection(context.activeCase.scenario);
    if (scenarioSection) sections.push(scenarioSection);

    // Add media guidance if media library exists
    if (context.activeCase.scenario.media_library && context.activeCase.scenario.media_library.length > 0) {
      const mediaSection = buildMediaGuidance(context.activeCase.scenario);
      if (mediaSection) sections.push(mediaSection);
    }
  }

  const phase = (context?.phase || 'subjective') as keyof typeof PHASE_GUIDANCE;
  const guidance = PHASE_GUIDANCE[phase] || PHASE_GUIDANCE.default;
  sections.push(`Encounter phase: ${String(context?.phase || 'subjective').toUpperCase()}. ${guidance}`);

  return sections.filter(Boolean).join('\n\n');
}

// --- Export helpers for printing/exporting scenario & persona ---
export function formatPersonaSection(persona: any) {
  if (!persona) return ''
  const demographics = persona.demographics || {}
  const bits: string[] = []
  const name = demographics.preferred_name || demographics.name || persona.patient_id || 'Patient'
  const idLine = [name, demographics.pronouns ? `(${demographics.pronouns})` : null, typeof demographics.age === 'number' ? `${demographics.age}-year-old` : null]
    .filter(Boolean)
    .join(' ')
  bits.push(`- Identity: ${idLine}`)
  if (demographics.occupation) bits.push(`- Occupation: ${demographics.occupation}`)
  if (persona.dialogue_style?.tone) bits.push(`- Tone: ${persona.dialogue_style.tone}`)
  if (persona.dialogue_style?.verbosity) bits.push(`- Typical detail level: ${persona.dialogue_style.verbosity}`)
  const fears = Array.isArray(persona.beliefs_affect?.fears) ? persona.beliefs_affect.fears.join('; ') : ''
  if (fears) bits.push(`- Concerns: ${fears}`)
  if (persona.beliefs_affect?.mood) bits.push(`- Mood: ${persona.beliefs_affect.mood}`)
  return bits.join('\n')
}

export function formatScenarioSection(scenario: any) {
  if (!scenario) return ''
  const lines: string[] = []
  const metaParts: string[] = []
  if (scenario.region) metaParts.push(`Region: ${String(scenario.region).replace(/_/g, ' ')}`)
  if (scenario.difficulty) metaParts.push(`Difficulty: ${scenario.difficulty}`)
  if (scenario.setting) metaParts.push(`Setting: ${scenario.setting}`)
  if (Array.isArray(scenario.tags) && scenario.tags.length) metaParts.push(`Tags: ${scenario.tags.slice(0, 3).join(', ')}`)
  if (metaParts.length) lines.push(metaParts.join(' · '))
  const presenting = scenario.presenting_problem || {}
  if (presenting.primary_dx) lines.push(`- Primary concern: ${presenting.primary_dx}`)
  if (presenting.onset) lines.push(`- Onset: ${presenting.onset}${presenting.onset_detail ? ` (${presenting.onset_detail})` : ''}`)
  if (typeof presenting.duration_weeks === 'number') lines.push(`- Duration: ${presenting.duration_weeks} weeks`)
  const dominant = Array.isArray(presenting.dominant_symptoms) ? presenting.dominant_symptoms.join('; ') : ''
  if (dominant) lines.push(`- Dominant symptoms: ${dominant}`)
  const aggravators = Array.isArray(presenting.aggravators) ? presenting.aggravators.join('; ') : ''
  if (aggravators) lines.push(`- Aggravators: ${aggravators}`)
  const easers = Array.isArray(presenting.easers) ? presenting.easers.join('; ') : ''
  if (easers) lines.push(`- Relieved by: ${easers}`)
  if (typeof presenting.pain_nrs_rest === 'number' || typeof presenting.pain_nrs_activity === 'number') {
    const rest = typeof presenting.pain_nrs_rest === 'number' ? `${presenting.pain_nrs_rest}/10` : '—'
    const activity = typeof presenting.pain_nrs_activity === 'number' ? `${presenting.pain_nrs_activity}/10` : '—'
    lines.push(`- Pain (rest / activity): ${rest} · ${activity}`)
  }
  if (presenting.pattern_24h) lines.push(`- 24-hour pattern: ${presenting.pattern_24h}`)
  const goals = Array.isArray(scenario.scenario_context?.goals) ? scenario.scenario_context.goals.join('; ') : ''
  if (goals) lines.push(`- Patient goals: ${goals}`)
  if (scenario.scenario_context?.environment) lines.push(`- Environment: ${scenario.scenario_context.environment}`)
  const icf = scenario.icf || {}
  if (icf.health_condition) lines.push(`- Health condition: ${icf.health_condition}`)
  const activities = Array.isArray(icf.activities) ? icf.activities.slice(0, 3).join('; ') : ''
  if (activities) lines.push(`- Key activity limits: ${activities}`)
  const participation = Array.isArray(icf.participation) ? icf.participation.slice(0, 2).join('; ') : ''
  if (participation) lines.push(`- Participation impact: ${participation}`)
  if (scenario.symptom_fluctuation?.with_activity) lines.push(`- Symptoms w/ activity: ${scenario.symptom_fluctuation.with_activity}`)
  if (scenario.symptom_fluctuation?.with_time) lines.push(`- Symptoms over time: ${scenario.symptom_fluctuation.with_time}`)
  if (scenario.guardrails?.impact_testing_unsafe) lines.push('- Guardrail: avoid impact testing unless cleared')
  return lines.join('\n')
}

/**
 * Find media asset matching the clinical context from user input
 * Returns media reference if appropriate for the current phase and context
 */
export function findMediaForContext(
  scenario: ActiveCase['scenario'],
  userText: string,
  phase: EncounterPhase
): { id: string; type: string; url: string; caption: string; thumbnail?: string } | null {
  // Only show media during objective examination phase
  if (phase !== 'objective') return null;
  if (!scenario.media_library || !Array.isArray(scenario.media_library) || scenario.media_library.length === 0) {
    return null;
  }

  const t = userText.toLowerCase();

  // Find media that matches clinical context or trigger patterns
  const match = scenario.media_library.find(media => {
    // Check clinical context tags
    if (media.clinical_context?.some(ctx => t.includes(ctx.toLowerCase()))) {
      return true;
    }
    // Check explicit trigger patterns
    if (media.trigger_patterns?.some(pattern => t.includes(pattern.toLowerCase()))) {
      return true;
    }
    return false;
  });

  if (!match) return null;

  return {
    id: match.id,
    type: match.type,
    url: match.url,
    caption: match.caption,
    thumbnail: match.thumbnail,
  };
}

