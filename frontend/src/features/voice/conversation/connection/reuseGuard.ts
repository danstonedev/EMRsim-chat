import type { VoiceDebugEvent } from '../../../../shared/types'

export interface SessionReuseDependencies {
  getSessionReused(): boolean
  setSessionReused(value: boolean): void
  getDropNextAssistantResponse(): boolean
  setDropNextAssistantResponse(value: boolean): void
  getInitialAssistantAutoPauseActive(): boolean
  setInitialAssistantAutoPauseActive(value: boolean): void
  getInitialAssistantGuardUsed(): boolean
  setInitialAssistantGuardUsed(value: boolean): void
  getUserHasSpoken(): boolean
  setUserHasSpoken(value: boolean): void
  getRemoteAudioElement(): HTMLAudioElement | null
  getRemoteVolumeBeforeGuard(): number | null
  setRemoteVolumeBeforeGuard(value: number | null): void
  getInitialAssistantReleaseTimer(): ReturnType<typeof setTimeout> | null
  setInitialAssistantReleaseTimer(timer: ReturnType<typeof setTimeout> | null): void
  hasAutoMicPauseReason(reason: string): boolean
  setAutoMicPaused(reason: string, paused: boolean): void
  emitDebug(event: VoiceDebugEvent): void
}

export interface SessionReuseHandlers {
  handleSessionReuse(reused: boolean): void
  resetInitialAssistantGuards(): void
  scheduleInitialAssistantRelease(trigger: string, delayMs?: number): void
  releaseInitialAssistantAutoPause(trigger: string): void
}

export function createSessionReuseHandlers(deps: SessionReuseDependencies): SessionReuseHandlers {
  const resetInitialAssistantGuards = (): void => {
    const timer = deps.getInitialAssistantReleaseTimer()
    if (timer != null) {
      clearTimeout(timer)
      deps.setInitialAssistantReleaseTimer(null)
    }
    deps.setInitialAssistantAutoPauseActive(false)
    deps.setInitialAssistantGuardUsed(false)
    deps.setUserHasSpoken(false)
    deps.setSessionReused(false)
    deps.setDropNextAssistantResponse(false)

    const element = deps.getRemoteAudioElement()
    if (element) {
      element.muted = false
      const previousVolume = deps.getRemoteVolumeBeforeGuard()
      if (previousVolume != null) {
        element.volume = previousVolume
      }
    }
    deps.setRemoteVolumeBeforeGuard(null)
    deps.setAutoMicPaused('initial-assistant', false)
  }

  const releaseInitialAssistantAutoPause = (trigger: string): void => {
    if (!deps.getInitialAssistantAutoPauseActive() && !deps.hasAutoMicPauseReason('initial-assistant')) return
    const timer = deps.getInitialAssistantReleaseTimer()
    if (timer != null) {
      clearTimeout(timer)
      deps.setInitialAssistantReleaseTimer(null)
    }
    deps.setInitialAssistantAutoPauseActive(false)
    deps.setDropNextAssistantResponse(false)
    deps.setSessionReused(false)
    deps.setAutoMicPaused('initial-assistant', false)
    const element = deps.getRemoteAudioElement()
    if (element) {
      element.muted = false
      const previousVolume = deps.getRemoteVolumeBeforeGuard()
      if (previousVolume != null) {
        element.volume = previousVolume
      }
    }
    deps.setRemoteVolumeBeforeGuard(null)
    deps.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'mic',
      msg: 'auto-unpaused',
      data: { trigger },
    })
  }

  const scheduleInitialAssistantRelease = (trigger: string, delayMs = 350): void => {
    if (!deps.getInitialAssistantAutoPauseActive() || !deps.hasAutoMicPauseReason('initial-assistant')) return
    const timer = deps.getInitialAssistantReleaseTimer()
    if (timer != null) {
      clearTimeout(timer)
    }
    const nextTimer = setTimeout(() => {
      deps.setInitialAssistantReleaseTimer(null)
      releaseInitialAssistantAutoPause(trigger)
    }, delayMs)
    deps.setInitialAssistantReleaseTimer(nextTimer)
  }

  const handleSessionReuse = (reused: boolean): void => {
    deps.setSessionReused(reused)
    if (reused) {
      deps.setDropNextAssistantResponse(true)
      deps.setInitialAssistantAutoPauseActive(false)
      deps.setInitialAssistantGuardUsed(false)
      deps.setUserHasSpoken(false)
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'session.reuse.detected',
        data: { reused: true },
      })
      return
    }

    deps.setDropNextAssistantResponse(false)
    if (deps.getInitialAssistantAutoPauseActive()) {
      releaseInitialAssistantAutoPause('session-reuse-reset')
    }
    resetInitialAssistantGuards()
  }

  return {
    handleSessionReuse,
    resetInitialAssistantGuards,
    scheduleInitialAssistantRelease,
    releaseInitialAssistantAutoPause,
  }
}
