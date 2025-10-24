export interface TranscriptTimings {
  startedAtMs: number | null
  emittedAtMs: number
  finalizedAtMs?: number | null
}

export type TranscriptEmitter = (text: string, isFinal: boolean, timings: TranscriptTimings) => void

export interface TranscriptLogger {
  log: (...args: any[]) => void
  warn: (...args: any[]) => void
}
