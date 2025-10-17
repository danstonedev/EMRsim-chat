/**
 * Integration test for ConversationController voice/transcription flow
 * 
 * This test simulates the actual OpenAI Realtime API event sequence to verify
 * that transcriptions work correctly and audio responses play.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ConversationController } from '../ConversationController'

describe('ConversationController - Voice & Transcription', () => {
  let controller: ConversationController
  let mockChannel: any
  let mockAudioElement: HTMLAudioElement
  let events: any[]
  let simulateDataChannelEvent: ((type: string, payload: any) => void) | undefined
  
  beforeEach(() => {
    // Reset mocks
    events = []
    
    // Mock RTCDataChannel
    mockChannel = {
      readyState: 'open',
      send: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    
    // Mock HTMLAudioElement
    mockAudioElement = {
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      volume: 1,
      readyState: 4,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any
    
    // Create controller
    controller = new ConversationController({
      sessionId: 'test-session',
      personaId: 'test-persona',
      scenarioId: 'test-scenario',
      remoteAudioElement: mockAudioElement
    })
    
    // Listen to events
    controller.addListener((event) => {
      events.push(event)
    })

    // Manually attach the mocked data channel handlers since we bypass full WebRTC setup in tests
    const attachHandlers = (controller as any)?.attachDataChannelHandlers
    if (typeof attachHandlers === 'function') {
      attachHandlers.call(controller, mockChannel)
    }
    
    // Setup data channel handlers
    const dcHandler = mockChannel.addEventListener.mock.calls.find((call: any) => call[0] === 'message')?.[1]
    if (!dcHandler) throw new Error('No data channel message handler registered')
    
    // Helper to simulate receiving events
    simulateDataChannelEvent = (type: string, payload: any) => {
      const event = { data: JSON.stringify({ type, ...payload }) }
      dcHandler(event)
    }
  })
  
  afterEach(() => {
    ;(controller as any)?.cleanup?.()
    simulateDataChannelEvent = undefined
  })
  
  it('should properly handle the transcription event sequence', async () => {
    // Simulate the correct OpenAI Realtime API event sequence
    
    // 1. Session created
    simulateDataChannelEvent?.('session.created', {
      session: { id: 'sess_123' }
    })
    
    // 2. User starts speaking
    simulateDataChannelEvent?.('input_audio_buffer.speech_started', {
      type: 'input_audio_buffer.speech_started',
      event_id: 'evt_001',
      audio_start_ms: 0,
      item_id: 'msg_user_123'
    })
    
    // 3. User stops speaking
    simulateDataChannelEvent?.('input_audio_buffer.speech_stopped', {
      type: 'input_audio_buffer.speech_stopped',
      event_id: 'evt_002',
      audio_end_ms: 2500,
      item_id: 'msg_user_123'
    })
    
    // 4. Conversation item created (user message) - NO TRANSCRIPT YET
    simulateDataChannelEvent?.('conversation.item.created', {
      type: 'conversation.item.created',
      event_id: 'evt_003',
      previous_item_id: null,
      item: {
        id: 'msg_user_123',
        object: 'realtime.item',
        type: 'message',
        status: 'completed',
        role: 'user',
        content: [
          {
            type: 'input_audio',
            transcript: null  // Transcription not ready yet!
          }
        ]
      }
    })
    
    // 5. Transcription completes (THIS IS WHERE THE TRANSCRIPT ARRIVES)
    simulateDataChannelEvent?.('conversation.item.input_audio_transcription.completed', {
      type: 'conversation.item.input_audio_transcription.completed',
      event_id: 'evt_004',
      item_id: 'msg_user_123',
      content_index: 0,
      transcript: 'Hello, I have hip pain'
    })
    
    // 6. Assistant response created
  simulateDataChannelEvent?.('response.created', {
      type: 'response.created',
      event_id: 'evt_005',
      response: {
        id: 'resp_123',
        object: 'realtime.response',
        status: 'in_progress',
        output: []
      }
    })
    
    // 7. Response output item added
  simulateDataChannelEvent?.('response.output_item.added', {
      type: 'response.output_item.added',
      event_id: 'evt_006',
      response_id: 'resp_123',
      output_index: 0,
      item: {
        id: 'msg_assistant_123',
        object: 'realtime.item',
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        content: []
      }
    })
    
    // 8. Conversation item created (assistant message)
  simulateDataChannelEvent?.('conversation.item.created', {
      type: 'conversation.item.created',
      event_id: 'evt_007',
      previous_item_id: 'msg_user_123',
      item: {
        id: 'msg_assistant_123',
        object: 'realtime.item',
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        content: []
      }
    })
    
    // 9. Content part added (audio content)
  simulateDataChannelEvent?.('response.content_part.added', {
      type: 'response.content_part.added',
      event_id: 'evt_008',
      response_id: 'resp_123',
      item_id: 'msg_assistant_123',
      output_index: 0,
      content_index: 0,
      part: {
        type: 'audio',
        transcript: null
      }
    })
    
    // 10. Audio transcript delta (what the assistant is saying)
  simulateDataChannelEvent?.('response.audio_transcript.delta', {
      type: 'response.audio_transcript.delta',
      event_id: 'evt_009',
      response_id: 'resp_123',
      item_id: 'msg_assistant_123',
      output_index: 0,
      content_index: 0,
      delta: 'I understand you'
    })
    
    // 11. Audio transcript done
  simulateDataChannelEvent?.('response.audio_transcript.done', {
      type: 'response.audio_transcript.done',
      event_id: 'evt_010',
      response_id: 'resp_123',
      item_id: 'msg_assistant_123',
      output_index: 0,
      content_index: 0
    })
    
    // 12. Response done
  simulateDataChannelEvent?.('response.done', {
      type: 'response.done',
      event_id: 'evt_011',
      response: {
        id: 'resp_123',
        object: 'realtime.response',
        status: 'completed',
        output: ['msg_assistant_123']
      }
    })
    
    // Give a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // ASSERTIONS
    
    // Check that we received transcript events
    const transcriptEvents = events.filter(e => e.type === 'transcript')
    expect(transcriptEvents.length).toBeGreaterThan(0)
    
    // Check that user transcript is NOT "[Speech not transcribed]"
    const userTranscript = transcriptEvents.find(e => e.role === 'user' && e.isFinal)
    expect(userTranscript).toBeDefined()
    expect(userTranscript?.text).toBe('Hello, I have hip pain')
    expect(userTranscript?.text).not.toBe('[Speech not transcribed]')
    
    // Check that assistant transcript exists
    const assistantTranscript = transcriptEvents.find(e => e.role === 'assistant' && e.isFinal)
    expect(assistantTranscript).toBeDefined()
    expect(assistantTranscript?.text).toContain('I understand you')
  })
  
  it('should handle transcription arriving before item.created (edge case)', async () => {
    // This is the edge case mentioned in OpenAI's code: transcription can arrive before item.created
    // This happens in VAD mode with empty/very short audio
    
    // 1. Speech events
  simulateDataChannelEvent?.('input_audio_buffer.speech_started', {
      event_id: 'evt_001',
      audio_start_ms: 0,
      item_id: 'msg_user_edge'
    })
    
  simulateDataChannelEvent?.('input_audio_buffer.speech_stopped', {
      event_id: 'evt_002',
      audio_end_ms: 100,  // Very short audio
      item_id: 'msg_user_edge'
    })
    
    // 2. Transcription completes BEFORE item.created (edge case!)
  simulateDataChannelEvent?.('conversation.item.input_audio_transcription.completed', {
      event_id: 'evt_003',
      item_id: 'msg_user_edge',
      content_index: 0,
      transcript: 'Hi'
    })
    
    // 3. NOW item.created arrives
  simulateDataChannelEvent?.('conversation.item.created', {
      event_id: 'evt_004',
      previous_item_id: null,
      item: {
        id: 'msg_user_edge',
        type: 'message',
        status: 'completed',
        role: 'user',
        content: [{ type: 'input_audio', transcript: 'Hi' }]
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should still get the transcript correctly
    const transcriptEvents = events.filter(e => e.type === 'transcript' && e.role === 'user')
    const finalTranscript = transcriptEvents.find(e => e.isFinal)
    expect(finalTranscript?.text).toBe('Hi')
  })
  
  it('should handle transcription failures gracefully', async () => {
    // Simulate a transcription failure
    
  simulateDataChannelEvent?.('input_audio_buffer.speech_started', {
      event_id: 'evt_001',
      item_id: 'msg_fail'
    })
    
  simulateDataChannelEvent?.('input_audio_buffer.speech_stopped', {
      event_id: 'evt_002',
      item_id: 'msg_fail'
    })
    
    // Transcription fails
  simulateDataChannelEvent?.('conversation.item.input_audio_transcription.failed', {
      event_id: 'evt_003',
      item_id: 'msg_fail',
      content_index: 0,
      error: {
        type: 'transcription_error',
        code: 'audio_unintelligible',
        message: 'Audio could not be transcribed'
      }
    })
    
    // Item created without transcript
  simulateDataChannelEvent?.('conversation.item.created', {
      event_id: 'evt_004',
      item: {
        id: 'msg_fail',
        type: 'message',
        status: 'completed',
        role: 'user',
        content: [{ type: 'input_audio', transcript: null }]
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should have fallback text
    const transcriptEvents = events.filter(e => e.type === 'transcript' && e.role === 'user')
    const finalTranscript = transcriptEvents.find(e => e.isFinal)
    expect(finalTranscript?.text).toBe('[Speech not transcribed]')
  })
})
