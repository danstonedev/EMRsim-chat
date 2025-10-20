import { GOLD_STANDARD_SPS_INSTRUCTIONS } from '../core/instructions';
import { ActiveCase, EncounterPhase, GateFlags } from '../core/types';

export function getGoldInstructions() {
  return GOLD_STANDARD_SPS_INSTRUCTIONS;
}
export function nextPhase(current: EncounterPhase, signal?: 'move_objective' | 'move_treatment'): EncounterPhase {
  if (signal === 'move_objective') return 'objective';
  if (signal === 'move_treatment') return 'treatment_plan';
  return current;
}

const BOOLEAN_GATE_KEYS = ['greeting_done', 'intro_done', 'consent_done', 'identity_verified'] as const;

const BASE_GATE_FLAGS: GateFlags = Object.freeze({
  greeting_done: false,
  intro_done: false,
  consent_done: false,
  identity_verified: false,
});

const GATE_LABELS: Record<'greeting_done' | 'intro_done' | 'consent_done' | 'identity_verified', string> = {
  greeting_done: 'Greeting exchange',
  intro_done: 'Student introduction',
  consent_done: 'Consent to proceed',
  identity_verified: 'Identity verification (name + DOB)',
};

const PHASE_GUIDANCE: Record<'subjective' | 'objective' | 'treatment_plan' | 'default', string> = {
  subjective:
    'Stay in the subjective history lane. Offer relevant symptom details, timelines, and contextual factors but avoid volunteering objective findings or treatment plans until asked within this phase.',
  objective:
    'Respond as a patient experiencing the examination. Describe sensations, limits, and guardrails tied to each maneuver. Do not invent tests not requested by the student.',
  treatment_plan:
    'Collaborate on planning. Share preferences, daily realities, and reasonable goals. Ask clarifying questions if the plan feels unclear or unrealistic.',
  default: 'Respond naturally while respecting the encounter structure and prior guidance.',
};

function formatList(values: unknown, max = 3): string {
  if (!Array.isArray(values)) return '';
  const cleaned = values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
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

  // Include subjective catalog responses with media markers
  if (scenario.subjective_catalog && scenario.subjective_catalog.length > 0) {
    lines.push('\nYour prepared responses to common questions:');
    scenario.subjective_catalog.forEach(item => {
      const label = item.label || item.id;
      const patterns = item.patterns?.slice(0, 3).join(', ') || '';
      const responses = item.patient_response_script?.qualitative || [];
      if (responses.length > 0) {
        lines.push(`\nWhen asked about "${label}" (${patterns}):`);
        responses.forEach(response => {
          lines.push(`  → "${response}"`);
        });
        // Add media marker hint if there's a note about media
        if (item.notes && item.notes.includes('[MEDIA:')) {
          const mediaMatch = item.notes.match(/\[MEDIA:([^\]]+)\]/);
          if (mediaMatch) {
            lines.push(`  ⚠️ IMPORTANT: Include ${mediaMatch[0]} at the end of your response to display visual media!`);
          }
        }
      }
    });
  }

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
  const out: string[] = [];
  for (const key of BOOLEAN_GATE_KEYS) {
    if (!gate[key]) {
      out.push(GATE_LABELS[key]);
    }
  }
  return out;
}

function buildMediaGuidance(scenario: ActiveCase['scenario']): string {
  if (!scenario.media_library || scenario.media_library.length === 0) return '';

  const lines = ['Visual demonstration capability:'];
  lines.push(
    'You can display images and videos to the student by including [MEDIA:media_id] anywhere in your spoken response.'
  );
  lines.push('The [MEDIA:...] marker will NOT be spoken aloud - it silently triggers the visual display.');
  lines.push('');
  lines.push('WHEN TO USE MEDIA:');
  lines.push(
    "- Student asks about imaging (X-rays, MRI, CT, etc.) you've already had → Include the [MEDIA:...] marker when mentioning you had those images done"
  );
  lines.push('- Student asks to see imaging results → Include the marker when confirming you can show them');
  lines.push('- Student asks you to demonstrate movement/function → Include the marker when you describe the movement');
  lines.push(
    '- Student explicitly requests to review or see something → Include the marker in your affirmative response'
  );
  lines.push('');
  lines.push('Available media assets:');
  scenario.media_library.forEach(media => {
    lines.push(`  [MEDIA:${media.id}] - ${media.type}: ${media.caption}`);
  });
  lines.push('');
  lines.push('CRITICAL EXAMPLES - Follow these patterns exactly:');
  lines.push('');
  lines.push('Student: "Did you get any X-rays?"');
  lines.push(
    'You: "Yes, I got X-rays at urgent care right after I hurt it. Here, I have them on my patient portal. [MEDIA:knee_xray_bilateral] They said no bones were broken."'
  );
  lines.push('');
  lines.push('Student: "Can I see the X-rays?"');
  lines.push(
    'You: "Sure, let me pull them up. [MEDIA:knee_xray_bilateral] Here they are from my patient portal account."'
  );
  lines.push('');
  lines.push('Student: "Do you have any imaging?"');
  lines.push(
    'You: "Yeah, I got some X-rays done. Let me show you. [MEDIA:knee_xray_bilateral] They said everything looked normal bone-wise."'
  );
  lines.push('');
  lines.push('Student: "Can you bend your knee for me?"');
  lines.push('You: "Sure, let me bend it for you. [MEDIA:knee_flexion_active]"');
  lines.push('');
  lines.push('Student: "Can you show me how you walk?"');
  lines.push('You: "Sure, I can walk for you. [MEDIA:gait_demonstration]"');
  lines.push('');
  lines.push('⚠️ CRITICAL RULES:');
  lines.push('1. When showing media for objective tests/demonstrations, NEVER interpret or analyze the findings');
  lines.push('2. Simply comply with the request and include the [MEDIA:...] marker');
  lines.push('3. Do NOT say things like "as you can see...", "you\'ll notice...", or describe what the media shows');
  lines.push("4. Let the student observe and interpret - that's their job!");
  lines.push('');
  lines.push('⚠️ CRITICAL: When answering about imaging you have, ALWAYS:');
  lines.push('1. Confirm you have the imaging');
  lines.push(
    '2. Offer to show it ("Here, I have them on my patient portal", "Let me pull them up", "Let me show you")'
  );
  lines.push('3. Include the [MEDIA:...] marker so the student can see the image');
  lines.push('The student cannot see the images unless you include the marker in your response!');

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
  if (!persona) return '';
  const demographics = persona.demographics || {};
  const bits: string[] = [];
  const name = demographics.preferred_name || demographics.name || persona.patient_id || 'Patient';
  const idLine = [
    name,
    demographics.pronouns ? `(${demographics.pronouns})` : null,
    typeof demographics.age === 'number' ? `${demographics.age}-year-old` : null,
  ]
    .filter(Boolean)
    .join(' ');
  bits.push(`- Identity: ${idLine}`);
  if (demographics.occupation) bits.push(`- Occupation: ${demographics.occupation}`);
  if (persona.dialogue_style?.tone) bits.push(`- Tone: ${persona.dialogue_style.tone}`);
  if (persona.dialogue_style?.verbosity) bits.push(`- Typical detail level: ${persona.dialogue_style.verbosity}`);
  const fears = Array.isArray(persona.beliefs_affect?.fears) ? persona.beliefs_affect.fears.join('; ') : '';
  if (fears) bits.push(`- Concerns: ${fears}`);
  if (persona.beliefs_affect?.mood) bits.push(`- Mood: ${persona.beliefs_affect.mood}`);
  return bits.join('\n');
}

export function formatScenarioSection(_scenario: any) {
  if (!_scenario) return '';
  const lines: string[] = [];
  const metaParts: string[] = [];
  if (_scenario.region) metaParts.push(`Region: ${String(_scenario.region).replace(/_/g, ' ')}`);
  if (_scenario.difficulty) metaParts.push(`Difficulty: ${_scenario.difficulty}`);
  if (_scenario.setting) metaParts.push(`Setting: ${_scenario.setting}`);
  if (Array.isArray(_scenario.tags) && _scenario.tags.length)
    metaParts.push(`Tags: ${_scenario.tags.slice(0, 3).join(', ')}`);
  if (metaParts.length) lines.push(metaParts.join(' · '));
  const presenting = _scenario.presenting_problem || {};
  if (presenting.primary_dx) lines.push(`- Primary concern: ${presenting.primary_dx}`);
  if (presenting.onset)
    lines.push(`- Onset: ${presenting.onset}${presenting.onset_detail ? ` (${presenting.onset_detail})` : ''}`);
  if (typeof presenting.duration_weeks === 'number') lines.push(`- Duration: ${presenting.duration_weeks} weeks`);
  const dominant = Array.isArray(presenting.dominant_symptoms) ? presenting.dominant_symptoms.join('; ') : '';
  if (dominant) lines.push(`- Dominant symptoms: ${dominant}`);
  const aggravators = Array.isArray(presenting.aggravators) ? presenting.aggravators.join('; ') : '';
  if (aggravators) lines.push(`- Aggravators: ${aggravators}`);
  const easers = Array.isArray(presenting.easers) ? presenting.easers.join('; ') : '';
  if (easers) lines.push(`- Relieved by: ${easers}`);
  if (typeof presenting.pain_nrs_rest === 'number' || typeof presenting.pain_nrs_activity === 'number') {
    const rest = typeof presenting.pain_nrs_rest === 'number' ? `${presenting.pain_nrs_rest}/10` : '—';
    const activity = typeof presenting.pain_nrs_activity === 'number' ? `${presenting.pain_nrs_activity}/10` : '—';
    lines.push(`- Pain (rest / activity): ${rest} · ${activity}`);
  }
  if (presenting.pattern_24h) lines.push(`- 24-hour pattern: ${presenting.pattern_24h}`);
  const goals = Array.isArray(_scenario.scenario_context?.goals) ? _scenario.scenario_context.goals.join('; ') : '';
  if (goals) lines.push(`- Patient goals: ${goals}`);
  if (_scenario.scenario_context?.environment) lines.push(`- Environment: ${_scenario.scenario_context.environment}`);
  const icf = _scenario.icf || {};
  if (icf.health_condition) lines.push(`- Health condition: ${icf.health_condition}`);
  const activities = Array.isArray(icf.activities) ? icf.activities.slice(0, 3).join('; ') : '';
  if (activities) lines.push(`- Key activity limits: ${activities}`);
  const participation = Array.isArray(icf.participation) ? icf.participation.slice(0, 2).join('; ') : '';
  if (participation) lines.push(`- Participation impact: ${participation}`);
  if (_scenario.symptom_fluctuation?.with_activity)
    lines.push(`- Symptoms w/ activity: ${_scenario.symptom_fluctuation.with_activity}`);
  if (_scenario.symptom_fluctuation?.with_time)
    lines.push(`- Symptoms over time: ${_scenario.symptom_fluctuation.with_time}`);
  if (_scenario.guardrails?.impact_testing_unsafe) lines.push('- Guardrail: avoid impact testing unless cleared');
  return lines.join('\n');
}

/**
 * Note: Rule-based media matching has been removed in favor of the AI/LLM-based media insertion system
 * that uses [MEDIA:id] markers in AI responses.
 */
