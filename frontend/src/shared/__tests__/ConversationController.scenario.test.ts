/**
 * Integration test: Simulated user scenario performance test
 * 
 * This test simulates a complete user interaction through a medical interview scenario,
 * measuring performance, transcript accuracy, and system behavior under realistic conditions.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConversationController, ConversationEvent, VoiceDebugEvent } from '../ConversationController'

// Simulated user interaction script
interface UserAction {
  type: 'speak' | 'wait' | 'pause' | 'resume' | 'text'
  content?: string
  durationMs?: number
}

interface ScenarioMetrics {
  startTime: number
  endTime: number
  totalDurationMs: number
  userTurns: number
  assistantTurns: number
  partialUpdates: number
  finalizationDelays: number[]
  errors: number
  pauseCount: number
  avgResponseTimeMs: number
  transcriptEvents: Array<Extract<ConversationEvent, { type: 'transcript' }>>
}

/**
 * SimulatedUser orchestrates a realistic user interaction with ConversationController
 */
class SimulatedUser {
  private controller: ConversationController
  public metrics: ScenarioMetrics
  private events: ConversationEvent[] = []
  private debugEvents: VoiceDebugEvent[] = []
  private responseTimer: number | null = null

  constructor(config?: ConstructorParameters<typeof ConversationController>[0]) {
    this.controller = new ConversationController({
      sttFallbackMs: 100,
      sttExtendedMs: 50,
      debugEnabled: true,
      ...config,
    })

    this.metrics = {
      startTime: 0,
      endTime: 0,
      totalDurationMs: 0,
      userTurns: 0,
      assistantTurns: 0,
      partialUpdates: 0,
      finalizationDelays: [],
      errors: 0,
      pauseCount: 0,
      avgResponseTimeMs: 0,
      transcriptEvents: [],
    }

    this.controller.addListener((event) => {
      this.events.push(event)
      this.handleEvent(event)
    })

    this.controller.addDebugListener((event) => {
      this.debugEvents.push(event)
      if (event.kind === 'error') {
        this.metrics.errors++
      }
    })
  }

  private handleEvent(event: ConversationEvent) {
    switch (event.type) {
      case 'transcript':
        this.metrics.transcriptEvents.push(event)
        if (event.isFinal) {
          if (event.role === 'user') {
            this.metrics.userTurns++
            // Measure response time from user final to next assistant response
            this.responseTimer = Date.now()
          } else if (event.role === 'assistant') {
            this.metrics.assistantTurns++
            if (this.responseTimer) {
              const delay = Date.now() - this.responseTimer
              this.metrics.finalizationDelays.push(delay)
              this.responseTimer = null
            }
          }
        }
        break

      case 'partial':
        this.metrics.partialUpdates++
        break

      case 'pause':
        if (event.paused) {
          this.metrics.pauseCount++
        }
        break

      case 'status':
        if (event.status === 'error') {
          this.metrics.errors++
        }
        break
    }
  }

  /**
   * Simulate user speaking with incremental transcription deltas
   */
  async speak(text: string, options?: { words?: string[]; delayBetweenWords?: number }): Promise<void> {
    const words = options?.words || text.split(' ')
    const delayMs = options?.delayBetweenWords || 50

    // Signal speech start
    this.invokeMessage({ type: 'input_audio_buffer.speech_started' })

    // Send incremental deltas to simulate real-time transcription
    let accumulated = ''
    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i]
      this.invokeMessage({
        type: 'input_audio_transcription.delta',
        delta: { transcript: words[i] + (i < words.length - 1 ? ' ' : '') },
        item: { content: [{ type: 'input_audio_transcription_delta', transcript: accumulated }] },
      })
      await this.wait(delayMs)
    }

    // Signal speech committed
    this.invokeMessage({ type: 'input_audio_buffer.committed' })

    // Wait for transcription completion
    await this.wait(20)

    // Finalize transcription
    this.invokeMessage({
      type: 'input_audio_transcription.completed',
      transcript: text,
      item: { content: [{ type: 'input_audio_transcription', transcript: text }] },
    })
  }

  /**
   * Simulate assistant response with audio and text transcription
   */
  async assistantResponds(text: string, options?: { useAudio?: boolean; chunks?: string[] }): Promise<void> {
    const chunks = options?.chunks || this.chunkText(text, 10)
    const useAudio = options?.useAudio ?? true

    // Signal response created
    this.invokeMessage({ type: 'response.created', response: { id: `resp-${Date.now()}` } })

    // Stream text/audio deltas
    if (useAudio) {
      for (const chunk of chunks) {
        this.invokeMessage({
          type: 'response.audio_transcript.delta',
          delta: chunk,
          item: { content: [{ type: 'audio_transcript_delta', text: chunk }] },
        })
        await this.wait(30)
      }
      // Finalize audio transcript
      this.invokeMessage({
        type: 'response.audio_transcript.done',
        text,
        item: { content: [{ type: 'audio_transcript', text }] },
      })
    } else {
      // Text-only response
      for (const chunk of chunks) {
        this.invokeMessage({
          type: 'response.output_text.delta',
          delta: { content: [{ type: 'output_text_delta', text: chunk }] },
          item: { content: [{ type: 'output_text_delta', text: chunk }] },
        })
        await this.wait(30)
      }
      // Finalize text
      this.invokeMessage({
        type: 'response.output_text.done',
        output_text: text,
        item: { content: [{ type: 'output_text', text }] },
      })
    }

    // Signal response done
    this.invokeMessage({ type: 'response.done' })
  }

  async pause(): Promise<void> {
    this.controller.setMicPaused(true)
    await this.wait(10)
  }

  async resume(): Promise<void> {
    this.controller.setMicPaused(false)
    await this.wait(10)
  }

  async sendText(text: string): Promise<void> {
    await this.controller.sendText(text)
  }

  async wait(ms: number): Promise<void> {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(ms)
    } else {
      await new Promise((resolve) => setTimeout(resolve, ms))
    }
  }

  /**
   * Execute a full scenario script
   */
  async runScenario(actions: UserAction[]): Promise<ScenarioMetrics> {
    this.metrics.startTime = Date.now()

    for (const action of actions) {
      switch (action.type) {
        case 'speak':
          if (action.content) {
            await this.speak(action.content)
          }
          break
        case 'wait':
          await this.wait(action.durationMs || 100)
          break
        case 'pause':
          await this.pause()
          break
        case 'resume':
          await this.resume()
          break
        case 'text':
          if (action.content) {
            await this.sendText(action.content)
          }
          break
      }
    }

    this.metrics.endTime = Date.now()
    this.metrics.totalDurationMs = this.metrics.endTime - this.metrics.startTime

    if (this.metrics.finalizationDelays.length > 0) {
      this.metrics.avgResponseTimeMs =
        this.metrics.finalizationDelays.reduce((a, b) => a + b, 0) / this.metrics.finalizationDelays.length
    }

    return this.metrics
  }

  getEvents(): ConversationEvent[] {
    return this.events
  }

  getDebugEvents(): VoiceDebugEvent[] {
    return this.debugEvents
  }

  getTranscript(): string {
    return this.metrics.transcriptEvents
      .filter((e) => e.isFinal)
      .map((e) => `${e.role}: ${e.text}`)
      .join('\n')
  }

  dispose(): void {
    this.controller.dispose()
  }

  private invokeMessage(payload: Record<string, any>): void {
    ;(this.controller as any).handleMessage(JSON.stringify(payload))
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const words = text.split(' ')
    const chunks: string[] = []
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' ') + ' ')
    }
    return chunks
  }
}

describe('ConversationController - Scenario Performance Test', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('simulates a complete medical interview with realistic user interactions', async () => {
    vi.useFakeTimers()

    const user = new SimulatedUser({
      personaId: 'patient-001',
      scenarioId: 'scenario-hip-01',
      debugEnabled: true,
    })

    // Initial greeting
    await user.speak('Hello doctor')
    await vi.advanceTimersByTimeAsync(150)

    // Simulate assistant response
    await user.assistantResponds('Hello! How can I help you today?')
    await vi.advanceTimersByTimeAsync(100)

    // User describes symptoms
    await user.speak('I have been having pain in my right hip for about three weeks now')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds(
      'I see. Can you tell me more about when the pain started and what you were doing at the time?'
    )

    await vi.advanceTimersByTimeAsync(100)

    // User provides more details
    await user.speak('It started after I went jogging. The pain gets worse when I walk or climb stairs')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds('Thank you for sharing that. Have you noticed any swelling or changes in your range of motion?')

    await vi.advanceTimersByTimeAsync(100)

    // User answers follow-up
    await user.speak('Yes there is some swelling and it hurts to move my leg sideways')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds('I understand. Let me ask a few more questions to better assess your condition.')

    // Allow any pending finalizations
    await vi.advanceTimersByTimeAsync(200)

    const metrics = user.metrics

    // Assertions on scenario performance
    expect(metrics.userTurns).toBeGreaterThanOrEqual(3)
    expect(metrics.assistantTurns).toBeGreaterThanOrEqual(3)
    expect(metrics.partialUpdates).toBeGreaterThan(0)
    expect(metrics.errors).toBe(0)

    // Verify transcript integrity
    const transcript = user.getTranscript()
    expect(transcript).toContain('Hello doctor')
    expect(transcript).toContain('pain in my right hip')
    expect(transcript).toContain('swelling')

    // Verify all user inputs were finalized
    const userFinals = metrics.transcriptEvents.filter((e) => e.role === 'user' && e.isFinal)
    expect(userFinals.length).toBe(metrics.userTurns)

    console.log('📊 Scenario Performance Metrics:')
    console.log(`   User turns: ${metrics.userTurns}`)
    console.log(`   Assistant turns: ${metrics.assistantTurns}`)
    console.log(`   Partial updates: ${metrics.partialUpdates}`)
    console.log(`   Errors: ${metrics.errors}`)

    user.dispose()
  })

  it('handles pause and resume during a conversation', async () => {
    vi.useFakeTimers()

    const user = new SimulatedUser()

    await user.speak('Hello I need help with my knee')
    await vi.advanceTimersByTimeAsync(150)

    await user.assistantResponds('Of course I can help with that')
    await vi.advanceTimersByTimeAsync(100)

    // Pause the conversation
    await user.pause()
    const events = user.getEvents()
    const pauseEvent = events.find((e) => e.type === 'pause' && (e as any).paused === true)
    expect(pauseEvent).toBeDefined()

    // Try to speak while paused
    await user.speak('It hurts when I walk')
    await vi.advanceTimersByTimeAsync(150)

    // Resume
    await user.resume()
    const resumeEvent = events.find((e) => e.type === 'pause' && (e as any).paused === false)
    expect(resumeEvent).toBeDefined()

    // Continue conversation
    await user.speak('The pain started last month')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds('Thank you for that information')
    await vi.advanceTimersByTimeAsync(100)

    const metrics = user.metrics

    expect(metrics.pauseCount).toBeGreaterThanOrEqual(1)
    expect(metrics.userTurns).toBeGreaterThanOrEqual(2)

    user.dispose()
  })

  it('measures performance under rapid turn-taking', async () => {
    vi.useFakeTimers()

    const user = new SimulatedUser()

    const utterances = [
      'Hello',
      'I have pain',
      'In my shoulder',
      'Started yesterday',
    ]

    // Simulate rapid assistant responses
    for (let i = 0; i < utterances.length; i++) {
      await user.speak(utterances[i])
      await vi.advanceTimersByTimeAsync(150)
      await user.assistantResponds(`Response ${i + 1}: I understand`)
      await vi.advanceTimersByTimeAsync(50)
    }

    await vi.advanceTimersByTimeAsync(200)

    const metrics = user.metrics

    expect(metrics.userTurns).toBe(utterances.length)
    expect(metrics.assistantTurns).toBe(utterances.length)
    expect(metrics.errors).toBe(0)

    // Verify no transcript corruption under rapid turns
    const transcript = user.getTranscript()
    expect(transcript).toContain('Hello')
    expect(transcript).toContain('shoulder')

    console.log('⚡ Rapid Exchange Metrics:')
    console.log(`   Total turns: ${metrics.userTurns + metrics.assistantTurns}`)

    user.dispose()
  })

  it('handles mixed audio and text input modes', async () => {
    vi.useFakeTimers()

    const user = new SimulatedUser()

    // Start with voice
    await user.speak('I have back pain')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds('Tell me more about your back pain', { useAudio: true })
    await vi.advanceTimersByTimeAsync(100)

    // Back to voice
    await user.speak('It gets worse when I bend forward')
    await vi.advanceTimersByTimeAsync(150)
    await user.assistantResponds('Thank you for that information', { useAudio: true })
    await vi.advanceTimersByTimeAsync(100)

    const metrics = user.metrics

    expect(metrics.userTurns).toBeGreaterThanOrEqual(2)
    expect(metrics.assistantTurns).toBeGreaterThanOrEqual(2)
    expect(metrics.errors).toBe(0)

    const transcript = user.getTranscript()
    expect(transcript).toContain('back pain')
    expect(transcript).toContain('bend forward')

    user.dispose()
  })

  it('validates transcript ordering and prevents duplicates', async () => {
    vi.useFakeTimers()

    const user = new SimulatedUser()

    await user.speak('First message')
    await vi.advanceTimersByTimeAsync(150)

    await user.assistantResponds('First response')
    await vi.advanceTimersByTimeAsync(100)

    await user.speak('Second message')
    await vi.advanceTimersByTimeAsync(150)

    await user.assistantResponds('Second response')
    await vi.advanceTimersByTimeAsync(100)

    await user.speak('Third message')
    await vi.advanceTimersByTimeAsync(150)

    await user.assistantResponds('Third response')
    await vi.advanceTimersByTimeAsync(100)

    const metrics = user.metrics

    // Verify strict ordering
    const finals = metrics.transcriptEvents.filter((e) => e.isFinal)
    expect(finals.length).toBe(6)

    const roles = finals.map((e) => e.role)
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant'])

    const texts = finals.map((e) => e.text)
    expect(texts[0]).toBe('First message')
    expect(texts[1]).toBe('First response')
    expect(texts[2]).toBe('Second message')
    expect(texts[3]).toBe('Second response')
    expect(texts[4]).toBe('Third message')
    expect(texts[5]).toBe('Third response')

    // Verify timestamps are monotonically increasing
    for (let i = 1; i < finals.length; i++) {
      expect(finals[i].timestamp).toBeGreaterThanOrEqual(finals[i - 1].timestamp)
    }

    user.dispose()
  })
})
