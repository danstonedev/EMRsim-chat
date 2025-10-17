/**
 * Types for the Conversation Controller and its services
 * Extracted from ConversationController.ts to be shared across services
 */

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type VoiceDebugEvent =
  | { t: string; kind: 'info' | 'warn' | 'error'; src: 'pc' | 'dc' | 'mic' | 'api' | 'app'; msg: string; data?: any }
  | { t: string; kind: 'event'; src: 'dc' | 'pc' | 'app'; msg: string; data?: any }

export interface MediaReference {
  id: string
  type: 'image' | 'video' | 'youtube' | 'animation'
  url: string
  thumbnail?: string
  caption: string
  // For animations
  animationId?: string
  options?: { speed?: number; loop?: 'repeat' | 'once' }
}

export interface TranscriptTimings {
  startedAtMs: number | null
  emittedAtMs: number
  finalizedAtMs?: number | null
}

export type ConversationEvent =
  | { type: 'status'; status: VoiceStatus; error: string | null }
  | { type: 'session'; sessionId: string | null }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; isFinal: boolean; timestamp: number; media?: MediaReference; timings?: TranscriptTimings }
  | { type: 'partial'; role: 'user' | 'assistant'; text: string }
  | { type: 'mic-level'; level: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'connection-progress'; step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'; progress: number; estimatedMs?: number }
  | { type: 'instructions'; instructions: string; phase?: string | null; outstandingGate?: string[] }
  | { type: 'voice-ready' }

export type ConversationListener = (event: ConversationEvent) => void
export type ConversationDebugListener = (event: VoiceDebugEvent) => void
