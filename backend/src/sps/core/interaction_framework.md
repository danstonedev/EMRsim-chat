# SPS Interaction Framework

This document supplements `instructions.ts` with engineering-facing guidance for persona layering, runtime state, variation control, and QA validation.

## 1. Layering & Precedence

Order of dominance (higher overrides lower):

1. Safety & Contraindications (scenario.guardrails, objective_guardrails)
2. Scenario factual data (presenting_problem, subjective/objective catalogs, objective scripts)
3. Persona demographics & dialogue style (tone, verbosity, quirks, misunderstanding, privacy)
4. Hidden agenda triggers & one-off challenge behaviors (DOB challenge, misunderstanding patterns)
5. Baseline interaction rules (`GOLD_STANDARD_SPS_INSTRUCTIONS`)
6. Stylistic variation (micro-elaboration, disfluencies, phrasing diversity)

Conflict rule: If a lower layer conflicts with a higher layer, omit or adapt the lower-layer effect; never fabricate a contradictory fact. If resolution cannot be silent, express uncertainty instead of inventing.

## 2. Runtime State Object

Ephemeral per encounter; not persisted beyond session.

```ts
export interface SPSRuntimeState {
  rapport: 'guarded' | 'neutral' | 'open';
  personaVerbosity: 'brief' | 'balanced' | 'talkative';
  lastClarifications: string[]; // rotating window (size 3)
  lastBoundaries: string[];    // rotating window (size 3)
  lastOpeners: string[];       // last N (e.g., 3) starting bigrams
  agendaRevealed: Set<string>; // hidden agenda item ids
  identityVerified: boolean;
  dobChallengeUsed: boolean;
  turnsSinceHesitation: number;
  rngSeed: number;             // deterministic replay
  turnIndex: number;           // increment each utterance
}
```

### Initialization

```ts
function initRuntimeState(personaVerbosity: SPSRuntimeState['personaVerbosity'], seed: number): SPSRuntimeState {
  return {
    rapport: 'guarded',
    personaVerbosity,
    lastClarifications: [],
    lastBoundaries: [],
    lastOpeners: [],
    agendaRevealed: new Set(),
    identityVerified: false,
    dobChallengeUsed: false,
    turnsSinceHesitation: 0,
    rngSeed: seed >>> 0,
    turnIndex: 0,
  };
}
```

## 3. Seeded RNG (xorshift32 example)

Deterministic variation for reproducible transcripts.

```ts
export function nextRng(state: SPSRuntimeState): number {
  let x = state.rngSeed | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rngSeed = x >>> 0;
  return state.rngSeed / 0xFFFFFFFF;
}
```

## 4. Variation Helpers

```ts
function choose<T>(state: SPSRuntimeState, domain: 'clar'|'bound'|'decl'|'other', pool: T[]): T {
  if (!pool.length) throw new Error('empty pool');
  const idx = Math.floor(nextRng(state) * pool.length);
  return pool[idx];
}

function recordRotating(list: string[], value: string, max = 3) {
  list.push(value);
  while (list.length > max) list.shift();
}
```

## 5. Micro-Elaboration Logic

Base probabilities by persona verbosity:

- brief: 0.25
- balanced: 0.40
- talkative: 0.55

Clamp not to exceed 40% overall across transcript (track moving average; throttle if surpassing).

```ts
function shouldElaborate(state: SPSRuntimeState, questionType: 'closed'|'open'|'narrative') {
  if (questionType !== 'open' && questionType !== 'narrative') return false;
  const base = state.personaVerbosity === 'brief' ? 0.25 : state.personaVerbosity === 'balanced' ? 0.40 : 0.55;
  return nextRng(state) < base;
}
```

## 6. Rapport Progression

Upgrade conditions: detect 2 distinct empathy cues (reflection patterns) since last upgrade; degrade on 2 dismissive interruptions. Cooldown: 2 turns between shifts. Rapport influences allowed elaboration multiplier (guarded 0.9, neutral 1.0, open 1.1) and emotional adjective allowance.

## 7. Hidden Agenda Reveal

Algorithm:

1. For each agenda item not yet revealed, test trigger patterns on learner input.
2. If triggered & no safety refusal in this turn: append one subtle clause (stored variant) to next relevant answer.
3. Mark item revealed.

No stacking multiple items in the same turn unless scenario explicitly requires.

## 8. Challenge Behaviors

DOB challenge used at most once: on first identity request if challenge style exists; after clear re-ask → must comply fully. Misunderstanding pattern: at most one every 3 turns; resolved by immediate clarification after learner reframes.

## 9. Anti-Echo Mechanism

Store starting bigram of each patient utterance in `lastOpeners`. If candidate opener matches any in window and synonyms available, substitute variant. Fallback: left-trim filler (“Well,”, “So,”) if repetition persists.

## 10. QA Validator Rule Set (High-Level)

Flags (severity levels):

- ERROR: numeric leakage without measurement request; multiple agenda reveals same id; duplicate clarification phrase inside last 3; diagnosis/coaching lexicon; >1 DOB challenge; contradiction (same slot different value).
- WARN: consecutive identical opening bigram; refusal phrase reused consecutively; elaboration frequency > 45% on eligible turns; more than 1 disfluency token in a turn.
- INFO: turns exceeding narrative max length; absence of any clarification despite >5 vague prompts.

## 11. Validator Inputs/Outputs

Input: transcript array of `{ turnIndex, role: 'learner'|'patient', text, meta?: any }` plus scenario + persona snapshot.
Output: `{ errors: Issue[], warnings: Issue[], info: Issue[], summaryMetrics: {...} }`.

Issue interface:

```ts
interface Issue { severity: 'ERROR'|'WARN'|'INFO'; code: string; turnIndex: number; message: string; details?: any; }
```

## 12. Metrics to Collect

- totalPatientTurns
- avgSentencesPerTurn
- elaborationRate
- clarificationRate
- refusalCount / unsafeRequests
- agendaRevealCount
- duplicationScores (openers / clarifications)

## 13. Extensibility Hooks

Expose functions:

- `initRuntimeState()`
- `applyLearnerTurn(state, learnerText)` (updates trigger tracking)
- `generatePatientResponse(state, context) -> { text, meta }`
- `validateTranscript(transcript, scenario, persona) -> ValidationResult`

## 14. Future Telehealth Extension Placeholder

Add constraint injection stage that filters unsafe self-provocation requests before answer assembly.

---

This framework is intentionally modular: generation can proceed even if some modules (agenda, telemetry) are omitted. Validator allows regression testing of interaction quality over time.
