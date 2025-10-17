/**
 * Event family classifier for WebRTC data-channel payloads.
 * Pure function with no side effects - aids testing and maintainability.
 */

export type EventFamily =
  | 'session'
  | 'speech'
  | 'transcription'
  | 'assistant'
  | 'conversation-item'
  | 'error'
  | 'unknown'

export interface ClassifiedEvent {
  family: EventFamily
  type: string
  payload: unknown
}

/**
 * Classifies an event type string into its family for dispatch routing.
 * This allows handleMessage to delegate to specialized handlers without
 * maintaining multiple conditional chains.
 */
export function classifyEvent(type: string, payload: unknown): ClassifiedEvent {
  const lowerType = type.toLowerCase()

  // Session lifecycle events
  if (
    lowerType === 'session.created' ||
    lowerType === 'session.updated' ||
    lowerType === 'session.failed' ||
    lowerType === 'session.expired'
  ) {
    return { family: 'session', type: lowerType, payload }
  }

  // Speech detection events (VAD / audio buffer)
  if (
    lowerType === 'input_audio_buffer.speech_started' ||
    lowerType.endsWith('input_audio_buffer.speech_started') ||
    lowerType === 'input_audio_buffer.speech_stopped' ||
    lowerType.endsWith('input_audio_buffer.speech_stopped') ||
    lowerType === 'input_audio_buffer.committed'
  ) {
    return { family: 'speech', type: lowerType, payload }
  }

  // Transcription events (both deltas and completions)
  if (
    lowerType.includes('input_audio_transcription') ||
    lowerType.includes('input_transcription') ||
    lowerType.includes('transcription.delta') ||
    lowerType.includes('transcription.completed') ||
    lowerType.includes('transcription.failed') ||
    lowerType.endsWith('input_text.delta') ||
    lowerType.endsWith('input_text.done') ||
    lowerType.endsWith('input_text.completed') ||
    lowerType.endsWith('input_text.commit')
  ) {
    return { family: 'transcription', type: lowerType, payload }
  }

  // Assistant response events (text/audio streaming)
  if (
    lowerType === 'response.created' ||
    lowerType.endsWith('response.created') ||
    lowerType.includes('content_part.added') ||
    lowerType.endsWith('response.content_part.delta') ||
    lowerType.includes('content_part.done') ||
    lowerType.endsWith('response.content_part.done') ||
    lowerType.includes('audio_transcript.delta') ||
    lowerType.endsWith('response.audio_transcript.delta') ||
    lowerType.includes('audio_transcript.done') ||
    lowerType.endsWith('response.audio_transcript.done') ||
    lowerType.includes('output_text.delta') ||
    lowerType.endsWith('response.output_text.delta') ||
    lowerType.includes('output_text.done') ||
    lowerType.endsWith('response.output_text.done') ||
    lowerType === 'response.delta' ||
    lowerType === 'response.completed' ||
    lowerType === 'response.done'
  ) {
    return { family: 'assistant', type: lowerType, payload }
  }

  // Conversation item management
  if (
    lowerType === 'conversation.item.created' ||
    lowerType === 'conversation.item.truncated' ||
    lowerType.endsWith('conversation.item.truncated')
  ) {
    return { family: 'conversation-item', type: lowerType, payload }
  }

  // Errors and warnings
  if (lowerType.includes('error') || lowerType.includes('warning')) {
    return { family: 'error', type: lowerType, payload }
  }

  // Unhandled event types
  return { family: 'unknown', type: lowerType, payload }
}
