import type { MediaReference } from '../../../../shared/types'
import type { BackendSocketFactory } from '../../../../shared/types/backendSocket'

export type PreferredString<T extends string> = T | (string & { __preferred?: never })

export interface ConversationControllerConfig {
  personaId?: string | null
  scenarioId?: string | null
  sessionId?: string | null
  remoteAudioElement?: HTMLAudioElement | null
  sttFallbackMs?: number
  sttExtendedMs?: number
  debugEnabled?: boolean
  bargeInEnabled?: boolean
  iceServers?: RTCIceServer[]
  voiceOverride?: string | null
  inputLanguage?: PreferredString<'auto'>
  replyLanguage?: PreferredString<'default'>
  model?: string | null
  transcriptionModel?: string | null
  backendTranscriptMode?: boolean
  scenarioMedia?: MediaReference[]
  socketFactory?: BackendSocketFactory
}

export interface InstructionRefreshOptions {
  phase?: string
  gate?: Record<string, unknown>
  audience?: 'student' | 'faculty'
}
