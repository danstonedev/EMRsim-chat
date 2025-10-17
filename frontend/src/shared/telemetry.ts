import { featureFlags } from './flags'
import type { VoiceStatus } from './types'
import type { TranscriptTimings } from './transcript/TranscriptEngine'

export type VoiceTelemetryEvent =
  | { type: 'status'; status: VoiceStatus; error: string | null; sessionId: string | null }
  | {
      type: 'transcript'
      role: 'user' | 'assistant'
      text: string
      isFinal: boolean
      timestamp: number
      sessionId: string | null
      timings?: TranscriptTimings
    }
  | { type: 'start-request'; personaId: string | null | undefined; scenarioId: string | null | undefined }
  | { type: 'start-success'; sessionId: string | null }
  | { type: 'start-error'; error: string; sessionId: string | null }
  | { type: 'stop'; sessionId: string | null }
  | { type: 'text-only-toggle'; enabled: boolean }
  | { type: 'send-text'; length: number; sessionId: string | null }
  | { type: 'turn-persist'; role: 'user' | 'assistant'; saved: number; duplicates: number; sessionId: string | null }
  | { type: 'turn-persist-error'; role: 'user' | 'assistant'; error: string; sessionId: string | null }

type RecordedTelemetry = VoiceTelemetryEvent & { ts: number }

const MAX_BUFFER = 500
let buffer: RecordedTelemetry[] = []

const truthy = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled'])

export function isVoiceTelemetryEnabled(): boolean {
  if (featureFlags.voiceDebug) return true
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem('voice.debug')
      if (stored && truthy.has(stored.toLowerCase())) return true
    } catch (error) {
      // Swallow storage errors (e.g., private browsing mode).
      console.debug?.('[voice:telemetry]', 'localStorage unavailable', error)
    }
    const win = window as any
    const runtime = win?.__VOICE_DEBUG
    if (typeof runtime === 'boolean') return runtime
    if (typeof runtime === 'string' && truthy.has(runtime.toLowerCase())) return true
  }
  return false
}

export function recordVoiceEvent(event: VoiceTelemetryEvent): void {
  if (!isVoiceTelemetryEnabled()) return
  const record: RecordedTelemetry = { ...event, ts: Date.now() }
  buffer = [...buffer, record].slice(-MAX_BUFFER)
  if (typeof window !== 'undefined') {
    const win = window as any
    if (!Array.isArray(win.__VOICE_TELEMETRY__)) win.__VOICE_TELEMETRY__ = []
    win.__VOICE_TELEMETRY__.push(record)
    win.__VOICE_TELEMETRY__ = win.__VOICE_TELEMETRY__.slice(-MAX_BUFFER)
    try {
      window.dispatchEvent(new CustomEvent('voice-telemetry', { detail: record }))
    } catch (error) {
      // Ignore if dispatching events is not permitted (e.g., during tests).
      console.debug?.('[voice:telemetry]', 'dispatch failed', error)
    }
  }
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[voice:telemetry]', record)
  }
}

export function getVoiceTelemetry(): RecordedTelemetry[] {
  return buffer.slice()
}
