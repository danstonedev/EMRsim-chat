import { safeInvoke } from '../config/safeInvoke'
import type { ConversationEvent, VoiceDebugEvent } from '../../../../shared/types'

interface SessionReadyStateManager {
  isAwaitingSessionAck(): boolean
  setAwaitingSessionAck(value: boolean): void
  isSessionReady(): boolean
  setSessionReady(value: boolean, trigger: string): void
  isFullyReady(): boolean
  setFullyReady(value: boolean): void
  isConnected(): boolean
}

interface SessionReadyWebRTCManager {
  isConnected(): boolean
}

export interface SessionReadyDependencies {
  getSessionAckTimeout(): ReturnType<typeof setTimeout> | null
  setSessionAckTimeout(timer: ReturnType<typeof setTimeout> | null): void
  stateManager: SessionReadyStateManager
  webrtcManager: SessionReadyWebRTCManager
  emit(event: ConversationEvent): void
  emitDebug(event: VoiceDebugEvent): void
  drainPendingInstructionSync(trigger: string): void
}

export interface SessionReadyManager {
  markSessionReady(trigger: string): void
  ensureSessionAckTimeout(): void
}

export function createSessionReadyManager(deps: SessionReadyDependencies): SessionReadyManager {
  const markSessionReady = (trigger: string): void => {
    const timeout = deps.getSessionAckTimeout()
    if (timeout != null) {
      safeInvoke(() => clearTimeout(timeout), 'Failed to clear session ack timeout in markSessionReady')
      deps.setSessionAckTimeout(null)
    }

    const wasAwaiting = deps.stateManager.isAwaitingSessionAck()
    deps.stateManager.setAwaitingSessionAck(false)
    const wasReady = deps.stateManager.isSessionReady()
    deps.stateManager.setSessionReady(true, trigger)

    deps.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: wasReady ? 'session.ready.duplicate' : 'session.ready',
      data: { trigger, wasAwaiting },
    })

    deps.drainPendingInstructionSync(trigger)
  }

  const ensureSessionAckTimeout = (): void => {
    const existingTimeout = deps.getSessionAckTimeout()
    if (existingTimeout != null) {
      safeInvoke(() => clearTimeout(existingTimeout), 'Failed to clear session ack timeout before rescheduling')
    }

    if (!deps.stateManager.isSessionReady()) {
      deps.stateManager.setAwaitingSessionAck(true)
    }

    const warnDelayMs = 2500
    const forceDelayMs = 4000

    const scheduleForcedReady = (): void => {
      const forcedTimeout = setTimeout(() => {
        deps.setSessionAckTimeout(null)
        if (deps.stateManager.isSessionReady()) return
        deps.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'dc',
          msg: 'session.updated.timeout',
          data: { trigger: 'timeout-force' },
        })
        markSessionReady('session.updated.timeout')
        if (
          !deps.stateManager.isFullyReady() &&
          (deps.stateManager.isConnected() || deps.webrtcManager.isConnected())
        ) {
          deps.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'dc',
            msg: 'connection-progress.fallback',
            data: { trigger: 'session.updated.timeout' },
          })
          deps.stateManager.setFullyReady(true)
          deps.emit({ type: 'connection-progress', step: 'complete', progress: 100 })
          deps.emit({ type: 'voice-ready' })
        }
      }, forceDelayMs)
      deps.setSessionAckTimeout(forcedTimeout)
    }

    const timeout = setTimeout(() => {
      if (deps.stateManager.isSessionReady()) {
        deps.setSessionAckTimeout(null)
        return
      }
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'dc',
        msg: 'session.updated.waiting',
        data: { trigger: 'timeout-warning' },
      })
      scheduleForcedReady()
    }, warnDelayMs)

    deps.setSessionAckTimeout(timeout)
  }

  return { markSessionReady, ensureSessionAckTimeout }
}
