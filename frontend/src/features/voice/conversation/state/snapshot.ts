import type { VoiceStatus } from '../../../../shared/types'

export interface SnapshotDependencies {
  state: {
    getStatus(): VoiceStatus
    getError(): string | null
  }
  transcript: {
    getUserPartial(): string
    getAssistantPartial(): string
  }
  audio: {
    getMicLevel(): number
  }
  sessionId: string | null
  debugEnabled: boolean
  micPaused: boolean
}

export interface ConversationSnapshotData {
  status: VoiceStatus
  error: string | null
  sessionId: string | null
  userPartial: string
  assistantPartial: string
  micLevel: number
  debugEnabled: boolean
  micPaused: boolean
}

export function buildSnapshot(deps: SnapshotDependencies): ConversationSnapshotData {
  const { state, transcript, audio, sessionId, debugEnabled, micPaused } = deps

  return {
    status: state.getStatus(),
    error: state.getError(),
    sessionId,
    userPartial: transcript.getUserPartial(),
    assistantPartial: transcript.getAssistantPartial(),
    micLevel: audio.getMicLevel(),
    debugEnabled,
    micPaused,
  }
}
