export type PatientProfile = {
  name?: string
  age?: number
  sex?: 'male' | 'female' | 'non-binary' | 'other'
  occupation?: string
  background?: string
}

export type EncounterContext = {
  chiefComplaint?: string
  onset?: string
  severity?: string
  associatedSymptoms?: string
  meds?: string
  allergies?: string
  vitals?: string
}

export type PatientPromptOptions = {
  profile?: PatientProfile
  context?: EncounterContext
  tone?: 'neutral' | 'anxious' | 'irritable' | 'stoic' | 'chatty'
  allowMedicalKnowledge?: boolean
}

function fallback<T>(v: T | undefined, d: T): T { return v === undefined || v === null || v === '' as any ? d : v }

export function buildPatientSystemPrompt(opts: PatientPromptOptions = {}): string {
  const p = opts.profile ?? {}
  const c = opts.context ?? {}
  const tone = opts.tone ?? 'neutral'
  const allowMedical = opts.allowMedicalKnowledge ?? false

  const name = fallback(p.name, 'Alex')
  const age = fallback(p.age, 34)
  const sex = fallback(p.sex as any, 'male')
  const occupation = fallback(p.occupation, 'office worker')
  const background = p.background ? `Background: ${p.background}.` : ''

  const cc = c.chiefComplaint ? `Chief complaint: ${c.chiefComplaint}.` : ''
  const onset = c.onset ? `Onset: ${c.onset}.` : ''
  const severity = c.severity ? `Severity: ${c.severity}.` : ''
  const assoc = c.associatedSymptoms ? `Associated symptoms: ${c.associatedSymptoms}.` : ''
  const meds = c.meds ? `Medications: ${c.meds}.` : ''
  const allergies = c.allergies ? `Allergies: ${c.allergies}.` : ''
  const vitals = c.vitals ? `Vitals: ${c.vitals}.` : ''

  const toneLine = {
    neutral: 'Your demeanor is calm and matter‑of‑fact.',
    anxious: 'You are anxious and occasionally seek reassurance.',
    irritable: 'You are a bit irritable and may give short answers if asked repetitive questions.',
    stoic: 'You are stoic, understate symptoms, and avoid dramatizing.',
    chatty: 'You are talkative and offer extra details, sometimes tangentially.'
  }[tone]

  const knowledgeGuard = allowMedical
    ? 'You may use basic lay explanations when appropriate.'
    : 'Avoid using medical jargon or clinician‑level reasoning. Answer as a layperson would, based only on lived experience and symptoms.'

  return [
    `You are role‑playing a realistic patient in a clinical encounter. Stay in character strictly.`,
    `Patient identity: ${name}, ${age} years old, ${sex}. Occupation: ${occupation}. ${background}`,
    `Presenting details: ${[cc, onset, severity, assoc, meds, allergies, vitals].filter(Boolean).join(' ')}`,
    toneLine,
    knowledgeGuard,
    `Behavioral rules:`,
    `- Provide answers only from the patient's perspective.`,
    `- Do not invent clinician findings or test results beyond what is plausible.`,
    `- If you do not know, say so naturally (e.g., "I'm not sure" or "I don't remember").`,
    `- Keep responses concise unless asked to elaborate; use natural language, not lists.`,
    `- If the clinician asks multiple questions at once, answer them in a natural flow.`,
    `- If asked non‑medical small talk, respond briefly and politely while staying in character.`
  ].join('\n')
}

export function getDefaultPatientPrompt(): string {
  // Allow ops to override the default via environment
  if (process.env.PATIENT_SYSTEM_PROMPT && process.env.PATIENT_SYSTEM_PROMPT.trim()) {
    return process.env.PATIENT_SYSTEM_PROMPT
  }
  return buildPatientSystemPrompt({
    profile: { name: 'Alex', age: 34, sex: 'male', occupation: 'office worker' },
    context: { chiefComplaint: 'intermittent chest discomfort for 2 weeks', onset: 'gradual', severity: 'mild to moderate', associatedSymptoms: 'worse with stress; occasional shortness of breath', meds: 'no daily meds', allergies: 'NKDA' },
    tone: 'neutral',
    allowMedicalKnowledge: false,
  })
}
