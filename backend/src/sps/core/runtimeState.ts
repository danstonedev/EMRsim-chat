// Runtime state scaffolding for SPS interaction engine
// NOTE: This module is framework-internal; it does not generate patient text by itself.

export type RapportLevel = 'guarded' | 'neutral' | 'open';
export type VerbosityLevel = 'brief' | 'balanced' | 'talkative';

export interface SPSRuntimeState {
  rapport: RapportLevel;
  personaVerbosity: VerbosityLevel;
  lastClarifications: string[]; // rotating window (size 3)
  lastBoundaries: string[]; // rotating window (size 3)
  lastOpeners: string[]; // rotating window (size 3) of starting bigrams
  agendaRevealed: Set<string>; // hidden agenda item ids already surfaced
  identityVerified: boolean;
  dobChallengeUsed: boolean;
  turnsSinceHesitation: number;
  rngSeed: number; // xorshift32 internal state
  turnIndex: number; // increments each patient turn
  // rapport cooldown tracking
  lastRapportShiftTurn: number | null;
  empathyCueBuffer: Set<string>; // distinct empathy cues since last shift
  dismissiveCueCount: number; // consecutive dismissive cues
}

export interface ElaborateDecisionContext {
  questionType: 'closed' | 'open' | 'narrative';
}

// Initialize runtime state with seed (deterministic replay)
export function initRuntimeState(personaVerbosity: VerbosityLevel, seed: number): SPSRuntimeState {
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
    lastRapportShiftTurn: null,
    empathyCueBuffer: new Set(),
    dismissiveCueCount: 0,
  };
}

// xorshift32 RNG
export function nextRng(state: SPSRuntimeState): number {
  let x = state.rngSeed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngSeed = x >>> 0;
  return state.rngSeed / 0xffffffff;
}

// Select an element from a pool using deterministic RNG
export function seededChoice<T>(state: SPSRuntimeState, pool: readonly T[]): T {
  if (!pool.length) throw new Error('seededChoice: empty pool');
  const idx = Math.floor(nextRng(state) * pool.length);
  return pool[idx];
}

// Maintain rotating windows for anti-repetition
export function recordRotating(list: string[], value: string, max = 3) {
  list.push(value);
  while (list.length > max) list.shift();
}

// Decide whether to add micro elaboration based on persona verbosity & rapport
export function shouldElaborate(state: SPSRuntimeState, ctx: ElaborateDecisionContext): boolean {
  if (ctx.questionType !== 'open' && ctx.questionType !== 'narrative') return false;
  const base = state.personaVerbosity === 'brief' ? 0.25 : state.personaVerbosity === 'balanced' ? 0.4 : 0.55;
  const rapportMultiplier = state.rapport === 'guarded' ? 0.9 : state.rapport === 'neutral' ? 1.0 : 1.1;
  return nextRng(state) < base * rapportMultiplier;
}

// Rapport management -------------------------------------------------------

const EMPATHY_PATTERNS = [
  /sounds like/i,
  /seems (like )?you/i,
  /i (can|could) see why/i,
  /i understand/i,
  /that must be/i,
];

const DISMISSIVE_PATTERNS = [/okay but/i, /let me (just )?ask/i, /anyway/i];

export interface LearnerTurnAnalysis {
  empathyCues: string[];
  dismissive: boolean;
}

export function analyzeLearnerTurn(text: string): LearnerTurnAnalysis {
  const empathyCues: string[] = [];
  for (const p of EMPATHY_PATTERNS) {
    if (p.test(text)) empathyCues.push(p.source);
  }
  const dismissive = DISMISSIVE_PATTERNS.some(p => p.test(text));
  return { empathyCues, dismissive };
}

export function updateRapport(state: SPSRuntimeState, analysis: LearnerTurnAnalysis) {
  // Add empathy cues
  for (const cue of analysis.empathyCues) state.empathyCueBuffer.add(cue);
  if (analysis.dismissive) state.dismissiveCueCount += 1;
  else state.dismissiveCueCount = 0;

  const canShift = state.lastRapportShiftTurn == null || state.turnIndex - state.lastRapportShiftTurn >= 2;
  if (!canShift) return;

  // Upgrade logic
  if (state.rapport !== 'open' && state.empathyCueBuffer.size >= 2) {
    state.rapport = state.rapport === 'guarded' ? 'neutral' : 'open';
    state.lastRapportShiftTurn = state.turnIndex;
    state.empathyCueBuffer.clear();
    state.dismissiveCueCount = 0;
    return;
  }
  // Downgrade logic
  if (state.rapport !== 'guarded' && state.dismissiveCueCount >= 2) {
    state.rapport = state.rapport === 'open' ? 'neutral' : 'guarded';
    state.lastRapportShiftTurn = state.turnIndex;
    state.empathyCueBuffer.clear();
    state.dismissiveCueCount = 0;
  }
}

// Utility to extract starting bigram for anti-echo logic
export function startingBigram(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 2);
  return words.join(' ').toLowerCase();
}

export function isEchoOpener(state: SPSRuntimeState, opener: string): boolean {
  return state.lastOpeners.includes(opener);
}

export function recordOpener(state: SPSRuntimeState, opener: string) {
  recordRotating(state.lastOpeners, opener, 3);
}

// Advance turn after generating patient response
export function advanceTurn(state: SPSRuntimeState) {
  state.turnIndex += 1;
  state.turnsSinceHesitation += 1;
}

// Mark identity verified
export function markIdentityVerified(state: SPSRuntimeState) {
  state.identityVerified = true;
}

// Agenda reveal bookkeeping
export function revealAgendaItem(state: SPSRuntimeState, id: string) {
  state.agendaRevealed.add(id);
}

export function agendaAlreadyRevealed(state: SPSRuntimeState, id: string): boolean {
  return state.agendaRevealed.has(id);
}

// Boundary phrase repetition guard
export function recordBoundary(state: SPSRuntimeState, phrase: string) {
  recordRotating(state.lastBoundaries, phrase, 3);
}

export function recentlyUsedBoundary(state: SPSRuntimeState, phrase: string): boolean {
  return state.lastBoundaries.includes(phrase);
}

// Clarification repetition guard
export function recordClarification(state: SPSRuntimeState, phrase: string) {
  recordRotating(state.lastClarifications, phrase, 3);
}

export function recentlyUsedClarification(state: SPSRuntimeState, phrase: string): boolean {
  return state.lastClarifications.includes(phrase);
}

// Derive numeric presence of elaboration target sentences (guidance only)
export function targetSentenceRange(
  state: SPSRuntimeState,
  questionType: 'closed' | 'open' | 'narrative'
): [number, number] {
  if (questionType === 'closed') return [1, 1];
  const base: [number, number] = questionType === 'open' ? [2, 4] : [3, 6];
  if (state.personaVerbosity === 'brief') return [Math.max(1, base[0] - 1), base[1] - 1];
  if (state.personaVerbosity === 'talkative') return [base[0], base[1] + 1];
  return base; // balanced
}

// Export a convenience object for external modules (optional future injection pattern)
export const SPSRuntime = {
  initRuntimeState,
  nextRng,
  seededChoice,
  recordRotating,
  shouldElaborate,
  analyzeLearnerTurn,
  updateRapport,
  startingBigram,
  isEchoOpener,
  recordOpener,
  advanceTurn,
  markIdentityVerified,
  revealAgendaItem,
  agendaAlreadyRevealed,
  recordBoundary,
  recentlyUsedBoundary,
  recordClarification,
  recentlyUsedClarification,
  targetSentenceRange,
};
