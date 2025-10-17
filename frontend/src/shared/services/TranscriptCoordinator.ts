import { TranscriptEngine, TranscriptTimings } from '../transcript/TranscriptEngine'
import { voiceDebug } from '../utils/voiceLogging'

/**
 * Transcript role enum
 */
export const enum TranscriptRole {
  User = 'user',
  Assistant = 'assistant',
}

/**
 * Media reference extracted from transcript
 */
export interface MediaReference {
  id: string
  url: string
  type?: string
  [key: string]: unknown
}

/**
 * Transcript event for emission
 */
export interface TranscriptEvent {
  type: 'transcript' | 'partial'
  role: TranscriptRole
  text: string
  isFinal?: boolean
  timestamp?: number
  media?: MediaReference
  timings?: TranscriptTimings
}

/**
 * Callback functions for transcript handling
 */
export interface TranscriptCallbacks {
  onUserTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void
  onAssistantTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void
}

/**
 * TranscriptCoordinator
 *
 * Manages transcript processing and coordination between user and assistant.
 * Handles media marker parsing, partial/final transcript tracking, and transcript engine.
 *
 * Responsibilities:
 * - Manage TranscriptEngine lifecycle
 * - Track user and assistant partial transcripts
 * - Parse media markers from assistant responses
 * - Coordinate transcript timing metadata
 * - Provide transcript reset functionality
 *
 * Extracted from ConversationController.ts as part of refactoring to reduce
 * main file complexity and improve testability.
 */
export class TranscriptCoordinator {
  private transcriptEngine: TranscriptEngine
  private userPartial = ''
  private assistantPartial = ''
  private scenarioMedia: MediaReference[] = []

  constructor(callbacks: TranscriptCallbacks, bargeInEnabled: boolean = false) {
    this.transcriptEngine = new TranscriptEngine(
      callbacks.onUserTranscript,
      callbacks.onAssistantTranscript,
      bargeInEnabled
    )
  }

  // ============================================
  // TranscriptEngine Delegation
  // ============================================

  /**
   * Get the underlying TranscriptEngine instance
   */
  getEngine(): TranscriptEngine {
    return this.transcriptEngine
  }

  /**
   * Start processing a new user transcript
   */
  startUserTranscript(): void {
    this.transcriptEngine.startUserTranscript()
  }

  /**
   * Finalize user transcript with the provided data
   */
  finalizeUser(data: { transcript: string }): void {
    this.transcriptEngine.finalizeUser(data)
    this.userPartial = ''
  }

  /**
   * Reset the transcript engine (clears all state)
   */
  reset(): void {
    this.transcriptEngine.reset()
    this.userPartial = ''
    this.assistantPartial = ''
  }

  // ============================================
  // Partial Transcript Management
  // ============================================

  /**
   * Get current user partial transcript
   */
  getUserPartial(): string {
    return this.userPartial
  }

  /**
   * Set user partial transcript
   */
  setUserPartial(text: string): void {
    this.userPartial = text
  }

  /**
   * Clear user partial transcript
   */
  clearUserPartial(): void {
    this.userPartial = ''
  }

  /**
   * Get current assistant partial transcript
   */
  getAssistantPartial(): string {
    return this.assistantPartial
  }

  /**
   * Set assistant partial transcript
   */
  setAssistantPartial(text: string): void {
    this.assistantPartial = text
  }

  /**
   * Clear assistant partial transcript
   */
  clearAssistantPartial(): void {
    this.assistantPartial = ''
  }

  /**
   * Clear both user and assistant partials
   */
  clearAllPartials(): void {
    this.userPartial = ''
    this.assistantPartial = ''
  }

  // ============================================
  // Media Marker Parsing
  // ============================================

  /**
   * Set the scenario media library for media marker resolution
   */
  setScenarioMedia(media: MediaReference[]): void {
    this.scenarioMedia = media
  }

  /**
   * Parse media markers from text
   * Format: [MEDIA:media_id] anywhere in text
   * Returns { cleanText, media }
   */
  parseMediaMarker(text: string): { cleanText: string; media: MediaReference | undefined } {
    const mediaMatch = text.match(/\[MEDIA:([^\]]+)\]/)
    if (!mediaMatch) {
      return { cleanText: text, media: undefined }
    }

    const mediaId = mediaMatch[1]
    const cleanText = text.replace(mediaMatch[0], '').trim()

    // Find media by ID in scenario media library
    const media = this.scenarioMedia.find(m => m.id === mediaId)

    voiceDebug('TranscriptCoordinator media marker found', {
      mediaId,
      scenarioMediaCount: this.scenarioMedia.length,
      found: !!media,
      mediaUrl: media?.url,
    })

    return { cleanText, media }
  }

  // ============================================
  // Transcript Processing Helpers
  // ============================================

  /**
   * Process user transcript and generate events
   * Handles both partial and final transcripts
   */
  processUserTranscript(
    text: string,
    isFinal: boolean,
    timings: TranscriptTimings,
    backendMode: boolean
  ): TranscriptEvent[] {
    const events: TranscriptEvent[] = []
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    const finalizedAtMs =
      typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : isFinal ? emittedAtMs : null
    const eventTimestamp = isFinal ? (finalizedAtMs ?? emittedAtMs) : (startedAtMs ?? emittedAtMs)

    // In backend mode: emit partials for typing animation, but skip finals (backend will broadcast those)
    if (backendMode) {
      if (isFinal) {
        this.userPartial = ''
        return []
      } else {
        this.userPartial = text
        events.push({
          type: 'transcript',
          role: TranscriptRole.User,
          text,
          isFinal,
          timestamp: eventTimestamp,
          timings,
        })
        return events
      }
    }

    if (isFinal) {
      this.userPartial = ''
      events.push({
        type: 'transcript',
        role: TranscriptRole.User,
        text,
        isFinal,
        timestamp: eventTimestamp,
        timings,
      })
    } else {
      this.userPartial = text
      events.push({
        type: 'partial',
        role: TranscriptRole.User,
        text,
      })
      events.push({
        type: 'transcript',
        role: TranscriptRole.User,
        text,
        isFinal,
        timestamp: eventTimestamp,
        timings,
      })
    }

    return events
  }

  /**
   * Process assistant transcript and generate events
   * Handles media marker parsing, partial and final transcripts
   */
  processAssistantTranscript(
    text: string,
    isFinal: boolean,
    timings: TranscriptTimings,
    backendMode: boolean
  ): {
    events: TranscriptEvent[]
    shouldRelay: boolean
    timestamp: number
  } {
    const events: TranscriptEvent[] = []
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    const finalizedAtMs =
      typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : isFinal ? emittedAtMs : null
    const eventTimestamp = isFinal ? (finalizedAtMs ?? emittedAtMs) : (startedAtMs ?? emittedAtMs)

    // In backend mode, transcripts are broadcast from backend - skip local emission
    // But still relay final transcripts to backend
    if (backendMode) {
      if (isFinal) {
        this.assistantPartial = ''
        return { events: [], shouldRelay: true, timestamp: eventTimestamp }
      } else {
        this.assistantPartial = text
        return { events: [], shouldRelay: false, timestamp: eventTimestamp }
      }
    }

    // Parse media markers from assistant responses
    const { cleanText, media } = this.parseMediaMarker(text)

    if (isFinal) {
      this.assistantPartial = ''
      events.push({
        type: 'transcript',
        role: TranscriptRole.Assistant,
        text: cleanText,
        isFinal,
        timestamp: eventTimestamp,
        media,
        timings,
      })
    } else {
      this.assistantPartial = cleanText
      events.push({
        type: 'partial',
        role: TranscriptRole.Assistant,
        text: cleanText,
      })
      events.push({
        type: 'transcript',
        role: TranscriptRole.Assistant,
        text: cleanText,
        isFinal,
        timestamp: eventTimestamp,
        media,
        timings,
      })
    }

    return { events, shouldRelay: false, timestamp: eventTimestamp }
  }

  // ============================================
  // State Snapshot
  // ============================================

  /**
   * Get a snapshot of the current transcript state
   */
  getSnapshot(): {
    userPartial: string
    assistantPartial: string
  } {
    return {
      userPartial: this.userPartial,
      assistantPartial: this.assistantPartial,
    }
  }
}
