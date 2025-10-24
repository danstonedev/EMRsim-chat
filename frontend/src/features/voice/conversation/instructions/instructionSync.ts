import { api } from '../../../../shared/api'
import type { ConversationEvent, VoiceDebugEvent } from '../../../../shared/types'
import {
  getEncounterState as snapshotEncounterState,
  normalizePhase,
  updateEncounterState as applyEncounterState,
} from '../state/encounter'
import type { InstructionRefreshOptions } from '../types/config'

interface PendingInstructionSync {
  reason: string
  options?: InstructionRefreshOptions
}

export interface InstructionSyncDependencies {
  stateManager: {
    isSessionReady(): boolean
    isAwaitingSessionAck(): boolean
  }
  getSessionId(): string | null
  getActiveChannel(): RTCDataChannel | null
  isActiveChannelOpen(): boolean
  emit(event: ConversationEvent): void
  emitDebug(event: VoiceDebugEvent): void
}

export interface InstructionSyncManager {
  getEncounterState(): { phase: string | null; gate: Record<string, unknown> | null; outstandingGate: string[] }
  updateEncounterState(state: { phase?: string | null; gate?: Record<string, unknown> | null }, reason?: string): void
  refreshInstructions(reason?: string, options?: InstructionRefreshOptions): Promise<void>
  drainPendingInstructionSync(trigger: string): void
  reset(): void
}

export function createInstructionSyncManager(deps: InstructionSyncDependencies): InstructionSyncManager {
  let encounterPhase: string | null = null
  let encounterGate: Record<string, unknown> | null = null
  let outstandingGate: string[] = []
  let currentAudience: 'student' | 'faculty' = 'student'

  let instructionSyncInFlight = false
  let instructionSyncPending: PendingInstructionSync | null = null
  let lastInstructionPayload: string | null = null
  let instructionRefreshSeq = 0

  const prepareInstructionOptions = (options?: InstructionRefreshOptions): InstructionRefreshOptions | undefined => {
    let nextPhase = encounterPhase
    let nextGate = encounterGate

    if (options && Object.prototype.hasOwnProperty.call(options, 'phase')) {
      nextPhase = normalizePhase(options.phase)
    }
    if (options && Object.prototype.hasOwnProperty.call(options, 'gate')) {
      nextGate = options.gate ? { ...options.gate } : null
    }
    if (options && Object.prototype.hasOwnProperty.call(options, 'audience')) {
      const a = options.audience
      if (a === 'student' || a === 'faculty') {
        currentAudience = a
      }
    }

    encounterPhase = nextPhase
    encounterGate = nextGate

    const result: InstructionRefreshOptions = {}
    if (nextPhase) result.phase = nextPhase
    if (nextGate) result.gate = nextGate
    // Do not include audience here; we'll always merge the current value when calling the API

    return Object.keys(result).length ? result : undefined
  }

  const syncRealtimeInstructions = async (reason: string, options?: InstructionRefreshOptions): Promise<void> => {
    const sessionId = deps.getSessionId()
    if (!deps.stateManager.isSessionReady() || !sessionId || deps.stateManager.isAwaitingSessionAck()) {
      instructionSyncPending = { reason, options }
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'dc',
        msg: 'instructions.refresh.deferred',
        data: {
          reason,
          hasSession: Boolean(sessionId),
          sessionReady: deps.stateManager.isSessionReady(),
          awaitingAck: deps.stateManager.isAwaitingSessionAck(),
        },
      })
      return
    }

    if (!deps.isActiveChannelOpen()) {
      instructionSyncPending = { reason, options }
      return
    }

    if (instructionSyncInFlight) {
      instructionSyncPending = { reason, options }
      return
    }

    instructionSyncPending = null
    instructionSyncInFlight = true
    const seq = ++instructionRefreshSeq
    deps.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: 'instructions.refresh.request',
      data: { reason, options },
    })

    try {
      const {
        instructions,
        phase: returnedPhase,
        outstanding_gate: nextOutstandingGate,
  } = await api.getVoiceInstructions(sessionId, { ...(options || {}), audience: currentAudience })
      if (seq !== instructionRefreshSeq) return

      const normalized = typeof instructions === 'string' ? instructions.trim() : ''
      if (!normalized) {
        deps.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'dc',
          msg: 'instructions.refresh.empty',
          data: { reason },
        })
        return
      }

      if (returnedPhase !== undefined) {
        const normalizedPhase = normalizePhase(returnedPhase)
        if (normalizedPhase !== encounterPhase) {
          encounterPhase = normalizedPhase
        }
      }

      const nextOutstanding = Array.isArray(nextOutstandingGate) ? [...nextOutstandingGate] : []
      const outstandingChanged =
        outstandingGate.length !== nextOutstanding.length ||
        outstandingGate.some((value, idx) => value !== nextOutstanding[idx])
      outstandingGate = nextOutstanding

      const signature = JSON.stringify({
        instructions: normalized,
        phase: encounterPhase,
        outstanding: outstandingGate,
      })

      if (signature === lastInstructionPayload) {
        deps.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'dc',
          msg: 'instructions.refresh.skipped',
          data: { reason, length: normalized.length, outstandingChanged },
        })
        return
      }

      const readyChannel = deps.getActiveChannel()
      if (!readyChannel || readyChannel.readyState !== 'open') {
        instructionSyncPending = { reason, options }
        return
      }

      const payload = {
        type: 'session.update',
        session: {
          instructions: normalized,
        },
      }
      readyChannel.send(JSON.stringify(payload))
      lastInstructionPayload = signature

      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'dc',
        msg: 'instructions.refresh.applied',
        data: {
          reason,
          length: normalized.length,
          phase: encounterPhase,
          outstanding: outstandingGate,
        },
      })

      deps.emit({
        type: 'instructions',
        instructions: normalized,
        phase: encounterPhase,
        outstandingGate: outstandingGate.length ? [...outstandingGate] : undefined,
      })
    } catch (err) {
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'dc',
        msg: 'instructions.refresh.error',
        data: { reason, error: err instanceof Error ? err.message : String(err) },
      })
    } finally {
      instructionSyncInFlight = false
      if (instructionSyncPending) {
        const pending = instructionSyncPending
        instructionSyncPending = null
        setTimeout(() => {
          void syncRealtimeInstructions(pending.reason, pending.options)
        }, 0)
      }
    }
  }

  const refreshInstructions = async (reason = 'manual', options?: InstructionRefreshOptions): Promise<void> => {
    const effectiveOptions = prepareInstructionOptions(options)
    await syncRealtimeInstructions(reason, effectiveOptions)
  }

  const reset = (): void => {
    encounterPhase = null
    encounterGate = null
    outstandingGate = []
    lastInstructionPayload = null
    instructionSyncPending = null
    instructionSyncInFlight = false
    instructionRefreshSeq += 1
  }

  return {
    getEncounterState: () =>
      snapshotEncounterState({
        phase: encounterPhase,
        gate: encounterGate,
        outstandingGate,
      }),
    updateEncounterState: (state, reason = 'state.update') => {
      applyEncounterState(
        {
          phase: encounterPhase,
          gate: encounterGate,
          setPhase: value => {
            encounterPhase = value
          },
          setGate: value => {
            encounterGate = value
          },
          refresh: (refreshReason, refreshOptions) => refreshInstructions(refreshReason, refreshOptions),
        },
        state,
        reason
      )
    },
    refreshInstructions,
    drainPendingInstructionSync: trigger => {
      const sessionId = deps.getSessionId()
      if (!deps.stateManager.isSessionReady() || !sessionId) return
      if (!instructionSyncPending) return
      if (instructionSyncInFlight) return

      const pending = instructionSyncPending
      instructionSyncPending = null
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'dc',
        msg: 'instructions.refresh.flush',
        data: { trigger, reason: pending.reason },
      })
      void syncRealtimeInstructions(pending.reason, pending.options)
    },
    reset,
  }
}
