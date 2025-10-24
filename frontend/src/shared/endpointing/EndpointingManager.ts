import { voiceDebug } from '../utils/voiceLogging'

export interface EndpointingManagerOptions {
  sttFallbackMs: number
  sttExtendedMs: number
  adaptiveEnabled: boolean
  adaptiveDebug: boolean
  baseVadThreshold?: number
  baseVadSilenceMs?: number
  minVadThreshold?: number
  maxVadThreshold?: number
  minVadSilenceMs?: number
  maxVadSilenceMs?: number
  emaAlphaQuiet?: number
  emaAlphaSpeech?: number
  maxTrackedUtterances?: number
}

export interface AdaptiveUpdateResult {
  threshold: number
  silenceMs: number
  debug?: {
    category: 'quiet' | 'noisy' | 'very-noisy'
    noise: number
    snr: number
  }
}

export type AssistantResponseAction =
  | 'finalize-from-deltas'
  | 'wait-for-pending'
  | 'wait-for-commit'
  | 'finalize-empty'
  | 'none'

export type SpeechStartResult = 'continue-active-turn' | 'start-new-turn'

const UPDATE_COOLDOWN_MS = 2500
const MIN_FALLBACK_MS = 300
const MAX_FALLBACK_MS = 5000
const MIN_EXTENDED_MS = 800
const MAX_EXTENDED_MS = 8000

export class EndpointingManager {
  private readonly sttFallbackMs: number
  private readonly sttExtendedMs: number
  private readonly adaptiveEnabled: boolean
  private readonly adaptiveDebug: boolean
  private readonly baseVadThreshold: number
  private readonly baseVadSilenceMs: number
  private readonly minVadThreshold: number
  private readonly maxVadThreshold: number
  private readonly minVadSilenceMs: number
  private readonly maxVadSilenceMs: number
  private readonly emaAlphaQuiet: number
  private readonly emaAlphaSpeech: number
  private readonly maxTrackedUtterances: number

  private userHasDelta = false
  private userFinalized = false
  private userSpeechPending = false
  private userDeltaCount = 0
  private userSpeechStartMs = 0
  private userCommitTimer: ReturnType<typeof setTimeout> | null = null
  private isUserSpeaking = false

  private recentUserUtterances: { duration: number; wordCount: number; timestamp: number }[] = []
  private lastUserSpeechEndMs = 0
  private lastLoggedPatienceBonus = 0

  private noiseFloorEma = 0
  private speechPeakEma = 0
  private lastAdaptiveUpdateMs = 0
  private currentVadThreshold: number | null = null
  private currentVadSilenceMs: number | null = null
  private lastAdaptiveNoise = 0
  private lastAdaptiveSnr = 0
  private lastAdaptiveCategory: 'quiet' | 'noisy' | 'very-noisy' = 'quiet'
  private adaptiveFallbackOffset = { fallback: 0, extended: 0 }

  constructor(options: EndpointingManagerOptions) {
    this.sttFallbackMs = options.sttFallbackMs
    this.sttExtendedMs = options.sttExtendedMs
    this.adaptiveEnabled = options.adaptiveEnabled
    this.adaptiveDebug = options.adaptiveDebug
    this.baseVadThreshold = options.baseVadThreshold ?? 0.35
    this.baseVadSilenceMs = options.baseVadSilenceMs ?? 1000  // Increased from 700ms to allow natural pauses
    this.minVadThreshold = options.minVadThreshold ?? 0.25
    this.maxVadThreshold = options.maxVadThreshold ?? 0.75
    this.minVadSilenceMs = options.minVadSilenceMs ?? 800  // Increased from 500ms to prevent premature interruption
    this.maxVadSilenceMs = options.maxVadSilenceMs ?? 1800  // Increased from 1500ms for longer pauses
    this.emaAlphaQuiet = options.emaAlphaQuiet ?? 0.03
    this.emaAlphaSpeech = options.emaAlphaSpeech ?? 0.12
    this.maxTrackedUtterances = options.maxTrackedUtterances ?? 5
  }

  resetAll(): void {
    this.clearCommitTimer()
    this.userHasDelta = false
    this.userFinalized = false
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.userSpeechStartMs = 0
    this.isUserSpeaking = false
    this.recentUserUtterances = []
    this.lastUserSpeechEndMs = 0
    this.lastLoggedPatienceBonus = 0
    this.adaptiveFallbackOffset = { fallback: 0, extended: 0 }
    this.noiseFloorEma = 0
    this.speechPeakEma = 0
    this.lastAdaptiveUpdateMs = 0
    this.currentVadThreshold = null
    this.currentVadSilenceMs = null
    this.lastAdaptiveNoise = 0
    this.lastAdaptiveSnr = 0
    this.lastAdaptiveCategory = 'quiet'
  }

  resetTurn(): void {
    this.clearCommitTimer()
    this.userHasDelta = false
    this.userFinalized = false
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.userSpeechStartMs = 0
    this.isUserSpeaking = false
  }

  dispose(): void {
    this.clearCommitTimer()
  }

  hasActiveTurn(): boolean {
    return this.userHasDelta || !this.userFinalized || this.userSpeechPending
  }

  handleSpeechStarted(now: number): SpeechStartResult {
    if (this.hasActiveTurn()) {
      this.isUserSpeaking = true
      return 'continue-active-turn'
    }
    this.userHasDelta = false
    this.userFinalized = false
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.userSpeechStartMs = now
    this.clearCommitTimer()
    this.isUserSpeaking = true
    return 'start-new-turn'
  }

  handleSpeechStopped(now: number): void {
    this.isUserSpeaking = false
    this.userSpeechPending = true
    this.recordUtteranceDuration(now)
  }

  handleAudioCommitted(now: number, onFallback: () => void): number {
    this.recordUtteranceDuration(now)
    const timeoutMs = this.getAdaptiveFallbackMs()
    this.replaceCommitTimer(onFallback, timeoutMs)
    return timeoutMs
  }

  handleTranscriptionDelta(now: number, onExtendedTimeout: () => void): { restarted: boolean; extendedMs: number } {
    let restarted = false
    if (this.userFinalized) {
      // Resume turn state when deltas arrive after a forced finalize
      this.userFinalized = false
      this.userSpeechPending = false
      this.userHasDelta = false
      this.userDeltaCount = 0
      this.userSpeechStartMs = now
      this.clearCommitTimer()
      restarted = true
    }
    this.userHasDelta = true
    this.userDeltaCount += 1
    if (this.userSpeechStartMs === 0) {
      this.userSpeechStartMs = now
    }
    const extendedMs = this.getAdaptiveExtendedMs()
    this.replaceCommitTimer(onExtendedTimeout, extendedMs)
    return { restarted, extendedMs }
  }

  handleTranscriptionCompleted(): boolean {
    const newlyFinalized = !this.userFinalized
    this.userHasDelta = false
    this.userFinalized = true
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.clearCommitTimer()
    return newlyFinalized
  }

  handleTranscriptionFailed(): void {
    this.userHasDelta = false
    this.userFinalized = true
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.clearCommitTimer()
  }

  prepareAssistantResponseStart(): AssistantResponseAction {
    if (!this.userFinalized && this.userHasDelta) {
      return 'finalize-from-deltas'
    }
    if (!this.userFinalized && !this.userHasDelta) {
      if (this.userSpeechPending) {
        return 'wait-for-pending'
      }
      if (this.userCommitTimer != null) {
        return 'wait-for-commit'
      }
      return 'finalize-empty'
    }
    return 'none'
  }

  markTurnFinalized(): void {
    this.userHasDelta = false
    this.userFinalized = true
    this.userSpeechPending = false
    this.userDeltaCount = 0
    this.clearCommitTimer()
  }

  markUserSpeechPending(value: boolean): void {
    this.userSpeechPending = value
  }

  markUserHasDelta(value: boolean): void {
    this.userHasDelta = value
  }

  markUserFinalized(value: boolean): void {
    this.userFinalized = value
  }

  incrementDeltaCount(): void {
    this.userDeltaCount += 1
  }

  resetDeltaCount(): void {
    this.userDeltaCount = 0
  }

  setSpeechStart(now: number): void {
    this.userSpeechStartMs = now
  }

  recordWordCount(wordCount: number): void {
    if (this.recentUserUtterances.length === 0) return
    this.recentUserUtterances[this.recentUserUtterances.length - 1].wordCount = wordCount
  }

  handleBackendUserItem(now: number): boolean {
    if (!this.userFinalized) return false
    this.userFinalized = false
    this.userSpeechPending = false
    this.userHasDelta = false
    this.userDeltaCount = 0
    this.userSpeechStartMs = now
    this.clearCommitTimer()
    return true
  }

  clearCommitTimer(): void {
    if (this.userCommitTimer != null) {
      clearTimeout(this.userCommitTimer)
      this.userCommitTimer = null
    }
  }

  getAdaptiveSnapshot(): {
    enabled: boolean
    status: 'quiet' | 'noisy' | 'very-noisy'
    noise: number
    snr: number
    threshold: number | null
    silenceMs: number | null
  } {
    return {
      enabled: this.adaptiveEnabled,
      status: this.lastAdaptiveCategory,
      noise: this.lastAdaptiveNoise,
      snr: this.lastAdaptiveSnr,
      threshold: this.currentVadThreshold,
      silenceMs: this.currentVadSilenceMs,
    }
  }

  observeRms(rms: number, now: number, channelReady: boolean): AdaptiveUpdateResult | null {
    if (!this.adaptiveEnabled) {
      return null
    }

    const likelySpeech = this.isUserSpeaking || rms > (this.noiseFloorEma * 1.8 + 0.02)
    if (likelySpeech) {
      this.speechPeakEma = this.speechPeakEma === 0 ? rms : (1 - this.emaAlphaSpeech) * this.speechPeakEma + this.emaAlphaSpeech * rms
    } else {
      this.noiseFloorEma = this.noiseFloorEma === 0 ? rms : (1 - this.emaAlphaQuiet) * this.noiseFloorEma + this.emaAlphaQuiet * rms
    }

    const noise = this.noiseFloorEma || 0.01
    const speech = Math.max(this.speechPeakEma, noise + 0.005)
    const snrRatio = speech / noise
    const veryLowNoise = noise < 0.02
    const isNoisy = !veryLowNoise && (noise > 0.06 || snrRatio < 2.2)
    const isVeryNoisy = !veryLowNoise && (noise > 0.10 || snrRatio < 1.6)
    const category: 'quiet' | 'noisy' | 'very-noisy' = isVeryNoisy ? 'very-noisy' : isNoisy ? 'noisy' : 'quiet'

    this.lastAdaptiveNoise = noise
    this.lastAdaptiveSnr = snrRatio
    this.lastAdaptiveCategory = category

    let desiredThreshold = this.baseVadThreshold
    let desiredSilence = this.baseVadSilenceMs
    let fallbackOffset = 0
    let extendedOffset = 0

    if (isVeryNoisy) {
      desiredThreshold = this.clamp(this.baseVadThreshold + 0.15, this.minVadThreshold, this.maxVadThreshold)
      desiredSilence = this.clamp(this.baseVadSilenceMs + 350, this.minVadSilenceMs, this.maxVadSilenceMs)
      fallbackOffset = 400
      extendedOffset = 900
    } else if (isNoisy) {
      desiredThreshold = this.clamp(this.baseVadThreshold + 0.08, this.minVadThreshold, this.maxVadThreshold)
      desiredSilence = this.clamp(this.baseVadSilenceMs + 200, this.minVadSilenceMs, this.maxVadSilenceMs)
      fallbackOffset = 250
      extendedOffset = 600
    } else {
      desiredThreshold = this.clamp(this.baseVadThreshold - 0.05, this.minVadThreshold, this.maxVadThreshold)
      desiredSilence = this.clamp(this.baseVadSilenceMs - 80, this.minVadSilenceMs, this.maxVadSilenceMs)
      fallbackOffset = -100
      extendedOffset = -200
    }

    this.adaptiveFallbackOffset.fallback = Math.round(0.7 * (this.adaptiveFallbackOffset.fallback || 0) + 0.3 * fallbackOffset)
    this.adaptiveFallbackOffset.extended = Math.round(0.7 * (this.adaptiveFallbackOffset.extended || 0) + 0.3 * extendedOffset)

    let patienceBonus = 0
    if (this.recentUserUtterances.length > 0) {
      const recentUtterances = this.recentUserUtterances.filter((u) => now - u.timestamp < 10000)
      const shortFragments = recentUtterances.filter((u) => u.wordCount > 0 && u.wordCount < 5)
      if (shortFragments.length >= 2) {
        patienceBonus += 500
      }
      const rapidUtterances = recentUtterances.filter((value, index) => index > 0 && recentUtterances[index - 1] && value.timestamp - recentUtterances[index - 1].timestamp < 3000)
      if (rapidUtterances.length >= 2) {
        patienceBonus += 300
      }
      if (this.lastUserSpeechEndMs > 0 && now - this.lastUserSpeechEndMs < 5000) {
        patienceBonus += 200
      }
      if (patienceBonus > 0 && patienceBonus !== this.lastLoggedPatienceBonus) {
        this.lastLoggedPatienceBonus = patienceBonus
        voiceDebug('EndpointingManager smart patience active', {
          bonus: patienceBonus,
          shortFragments: shortFragments.length,
          rapidUtterances: rapidUtterances.length,
          recentSpeech: this.lastUserSpeechEndMs > 0 && now - this.lastUserSpeechEndMs < 5000,
          baseSilence: desiredSilence,
          finalSilence: Math.min(desiredSilence + patienceBonus, this.maxVadSilenceMs),
        })
      } else if (patienceBonus === 0 && this.lastLoggedPatienceBonus !== 0) {
        this.lastLoggedPatienceBonus = 0
      }
    }

    desiredSilence = Math.min(desiredSilence + patienceBonus, this.maxVadSilenceMs)

    const thresholdChanged = this.currentVadThreshold == null || Math.abs(desiredThreshold - this.currentVadThreshold) >= 0.05
    const silenceChanged = this.currentVadSilenceMs == null || Math.abs(desiredSilence - this.currentVadSilenceMs) >= 100
    const cooldownElapsed = now - this.lastAdaptiveUpdateMs > UPDATE_COOLDOWN_MS

    if (channelReady && cooldownElapsed && (thresholdChanged || silenceChanged)) {
      this.currentVadThreshold = desiredThreshold
      this.currentVadSilenceMs = desiredSilence
      this.lastAdaptiveUpdateMs = now
      return {
        threshold: desiredThreshold,
        silenceMs: desiredSilence,
        debug: this.adaptiveDebug
          ? {
              category,
              noise: Number(noise.toFixed(3)),
              snr: Number(snrRatio.toFixed(2)),
            }
          : undefined,
      }
    }

    return null
  }

  isAdaptiveEnabled(): boolean {
    return this.adaptiveEnabled
  }

  setIsUserSpeaking(value: boolean): void {
    this.isUserSpeaking = value
  }

  updateLastSpeechEnd(now: number): void {
    this.lastUserSpeechEndMs = now
  }

  getUserSpeechPending(): boolean {
    return this.userSpeechPending
  }

  getUserFinalized(): boolean {
    return this.userFinalized
  }

  getUserHasDelta(): boolean {
    return this.userHasDelta
  }

  getUserCommitTimer(): ReturnType<typeof setTimeout> | null {
    return this.userCommitTimer
  }

  private replaceCommitTimer(callback: () => void, timeoutMs: number): void {
    this.clearCommitTimer()
    this.userCommitTimer = setTimeout(() => {
      this.userCommitTimer = null
      callback()
    }, timeoutMs)
  }

  private recordUtteranceDuration(now: number): void {
    if (this.userSpeechStartMs <= 0) {
      return
    }
    const duration = now - this.userSpeechStartMs
    this.userSpeechStartMs = 0
    this.lastUserSpeechEndMs = now
    this.recentUserUtterances.push({ duration, wordCount: 0, timestamp: now })
    if (this.recentUserUtterances.length > this.maxTrackedUtterances) {
      this.recentUserUtterances.shift()
    }
  }

  private getAdaptiveFallbackMs(): number {
    const base = this.sttFallbackMs
    const offset = this.adaptiveFallbackOffset.fallback || 0
    return Math.max(MIN_FALLBACK_MS, Math.min(MAX_FALLBACK_MS, base + offset))
  }

  private getAdaptiveExtendedMs(): number {
    const base = this.sttExtendedMs
    const offset = this.adaptiveFallbackOffset.extended || 0
    return Math.max(MIN_EXTENDED_MS, Math.min(MAX_EXTENDED_MS, base + offset))
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}
