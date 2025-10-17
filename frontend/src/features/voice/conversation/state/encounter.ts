import type { InstructionRefreshOptions } from '../types/config'

export type EncounterGate = Record<string, unknown> | null

export interface EncounterSnapshot {
  phase: string | null
  gate: EncounterGate
  outstandingGate: string[]
}

export interface EncounterStateContext {
  phase: string | null
  gate: EncounterGate
  setPhase(value: string | null): void
  setGate(value: EncounterGate): void
  refresh(reason: string, options?: InstructionRefreshOptions): Promise<unknown>
}

export function normalizePhase(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function areGatesEqual(a: EncounterGate, b: EncounterGate): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

export function getEncounterState(input: {
  phase: string | null
  gate: EncounterGate
  outstandingGate: string[]
}): EncounterSnapshot {
  return {
    phase: input.phase,
    gate: input.gate ? { ...input.gate } : null,
    outstandingGate: [...input.outstandingGate],
  }
}

export function updateEncounterState(
  ctx: EncounterStateContext,
  state: { phase?: string | null; gate?: EncounterGate },
  reason = 'state.update'
): void {
  let dirty = false
  let phaseDirty = false
  let gateDirty = false
  let nextPhase = ctx.phase
  let nextGate = ctx.gate

  if (state && Object.prototype.hasOwnProperty.call(state, 'phase')) {
    const normalizedPhase = normalizePhase(state.phase)
    if (ctx.phase !== normalizedPhase) {
      nextPhase = normalizedPhase
      phaseDirty = true
      dirty = true
    }
  }

  if (state && Object.prototype.hasOwnProperty.call(state, 'gate')) {
    const candidate = state.gate ? { ...state.gate } : null
    if (!areGatesEqual(ctx.gate, candidate)) {
      nextGate = candidate
      gateDirty = true
      dirty = true
    }
  }

  if (!dirty) return

  if (phaseDirty) {
    ctx.setPhase(nextPhase)
  }
  if (gateDirty) {
    ctx.setGate(nextGate)
  }

  const options: InstructionRefreshOptions = {}
  if (nextPhase) options.phase = nextPhase
  if (nextGate) options.gate = nextGate
  const effective = Object.keys(options).length ? options : undefined

  ctx.refresh(reason, effective).catch(() => {})
}
