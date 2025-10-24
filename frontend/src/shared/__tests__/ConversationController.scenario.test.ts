/**
 * Integration test: curated scenario coverage for ConversationController.
 * The scenarios below were trimmed to keep Vitest memory usage reasonable while still
 * exercising multi-turn voice interactions end to end.
 */

import { describe, expect, it, vi } from 'vitest'
import { ConversationController } from '../ConversationController'
import type { ConversationEvent } from '../types'

type TurnScript = {
  final: string
  fragments?: string[]
}

type ScenarioTurn = {
  user: TurnScript
  assistant?: TurnScript
}

type ScenarioDefinition = {
  name: string
  personaId: string
  scenarioId: string
  turns: ScenarioTurn[]
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    name: 'hip pain follow-up',
    personaId: 'patient-hip-pain',
    scenarioId: 'hip-performance-01',
    turns: [
      {
        user: { final: 'Hello doctor', fragments: ['Hello', ' doctor'] },
        assistant: {
          final: 'Hello! What brings you in today?',
          fragments: ['Hello! ', 'What brings you in today?'],
        },
      },
      {
        user: { final: 'I have pain in my right hip', fragments: ['I have pain ', 'in my right hip'] },
        assistant: { final: 'When did the pain start?', fragments: ['When did ', 'the pain start?'] },
      },
      {
        user: {
          final: 'About three weeks ago after running stairs',
          fragments: ['About three weeks ago ', 'after running stairs'],
        },
        assistant: {
          final: 'Any other symptoms such as swelling or stiffness?',
          fragments: ['Any other symptoms ', 'such as swelling or stiffness?'],
        },
      },
      {
        user: {
          final: 'Mostly stiffness in the morning but no swelling',
          fragments: ['Mostly stiffness in the morning ', 'but no swelling'],
        },
        assistant: { final: 'Noted. We will continue with the exam now.' },
      },
    ],
  },
  {
    name: 'abdominal pain triage',
    personaId: 'patient-abdominal-pain',
    scenarioId: 'abdomen-performance-02',
    turns: [
      {
        user: { final: 'Good afternoon doctor', fragments: ['Good', ' afternoon doctor'] },
        assistant: {
          final: 'Good afternoon. What symptoms are you experiencing?',
          fragments: ['Good afternoon. ', 'What symptoms are you experiencing?'],
        },
      },
      {
        user: { final: 'Sharp abdominal pain on the lower left side' },
        assistant: {
          final: 'When did the pain begin and does anything make it better?',
          fragments: ['When did the pain begin ', 'and does anything make it better?'],
        },
      },
      {
        user: {
          final: 'It started this morning and eases slightly when I lie down',
          fragments: ['It started this morning ', 'and eases slightly when I lie down'],
        },
        assistant: {
          final: 'Any nausea, fever, or changes in appetite?',
          fragments: ['Any nausea, fever, ', 'or changes in appetite?'],
        },
      },
      {
        user: { final: 'Some nausea but no fever and my appetite is low' },
        assistant: { final: 'Thanks for the details. Let us check your vitals next.' },
      },
    ],
  },
  {
    name: 'post-operative wound check',
    personaId: 'patient-post-op',
    scenarioId: 'postop-performance-03',
    turns: [
      {
        user: {
          final: 'Hello doctor I am here for my surgery follow up',
          fragments: ['Hello doctor ', 'I am here for my surgery follow up'],
        },
        assistant: {
          final: 'Welcome back. How has the incision been healing?',
          fragments: ['Welcome back. ', 'How has the incision been healing?'],
        },
      },
      {
        user: {
          final: 'It looks fine but there is some redness around the edges',
          fragments: ['It looks fine ', 'but there is some redness around the edges'],
        },
        assistant: {
          final: 'Are you experiencing any drainage or fever?',
          fragments: ['Are you experiencing any drainage ', 'or fever?'],
        },
      },
      {
        user: {
          final: 'No drainage but I have had a mild fever at night',
          fragments: ['No drainage ', 'but I have had a mild fever ', 'at night'],
        },
        assistant: {
          final: 'Please start monitoring the temperature twice a day and keep the area clean.',
          fragments: [
            'Please start monitoring the temperature ',
            'twice a day ',
            'and keep the area clean.',
          ],
        },
      },
      {
        user: {
          final: 'Should I come back if the fever continues through the weekend',
          fragments: ['Should I come back ', 'if the fever continues ', 'through the weekend'],
        },
        assistant: {
          final: 'Yes return immediately if the fever stays high or the redness spreads.',
          fragments: [
            'Yes return immediately ',
            'if the fever stays high ',
            'or the redness spreads.',
          ],
        },
      },
      {
        user: {
          final: 'Understood I will keep a close watch and call if anything changes',
          fragments: [
            'Understood ',
            'I will keep a close watch ',
            'and call if anything changes',
          ],
        },
      },
    ],
  },
  {
    name: 'pediatric fever consult',
    personaId: 'parent-pediatric-fever',
    scenarioId: 'peds-performance-04',
    turns: [
      {
        user: {
          final: 'Hi doctor my son has had a fever since last night',
          fragments: ['Hi doctor ', 'my son has had a fever since last night'],
        },
        assistant: {
          final: 'How high has the fever been and how old is he?',
          fragments: ['How high has the fever been ', 'and how old is he?'],
        },
      },
      {
        user: {
          final: 'It reached one hundred two degrees and he is five years old',
          fragments: ['It reached one hundred two degrees ', 'and he is five years old'],
        },
        assistant: {
          final: 'Is he drinking fluids and urinating normally?',
          fragments: ['Is he drinking fluids ', 'and urinating normally?'],
        },
      },
      {
        user: {
          final: 'He is sipping water but not eating much and his last bathroom visit was this morning',
          fragments: [
            'He is sipping water ',
            'but not eating much ',
            'and his last bathroom visit was this morning',
          ],
        },
        assistant: {
          final: 'Monitor his fluids closely and alternate acetaminophen with ibuprofen as directed.',
          fragments: [
            'Monitor his fluids closely ',
            'and alternate acetaminophen ',
            'with ibuprofen as directed.',
          ],
        },
      },
      {
        user: {
          final: 'Should I bring him in if the fever lasts more than two days',
          fragments: ['Should I bring him in ', 'if the fever lasts ', 'more than two days'],
        },
        assistant: {
          final: 'Yes please schedule an in person visit if the fever persists beyond forty eight hours.',
          fragments: [
            'Yes please schedule an in person visit ',
            'if the fever persists beyond ',
            'forty eight hours.',
          ],
        },
      },
      {
        user: {
          final: 'Thank you I will monitor him closely tonight',
          fragments: ['Thank you ', 'I will monitor him closely tonight'],
        },
        assistant: {
          final: 'Call the emergency line if he develops difficulty breathing or rash.',
          fragments: [
            'Call the emergency line ',
            'if he develops difficulty breathing ',
            'or rash.',
          ],
        },
      },
    ],
  },
]

type TranscriptCapture = {
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
}

const invokeMessage = (controller: ConversationController, payload: Record<string, unknown>) => {
  ;(controller as any).handleMessage(JSON.stringify(payload))
}

const captureTranscripts = (controller: ConversationController): TranscriptCapture[] => {
  const transcripts: TranscriptCapture[] = []
  controller.addListener((event: ConversationEvent) => {
    if (event.type === 'transcript') {
      transcripts.push({ role: event.role, text: event.text, isFinal: event.isFinal })
    }
  })
  return transcripts
}

const simulateUserTurn = async (controller: ConversationController, script: TurnScript) => {
  const fragments = script.fragments ?? [script.final]
  invokeMessage(controller, { type: 'input_audio_buffer.speech_started' })
  for (const fragment of fragments) {
    invokeMessage(controller, { type: 'input_audio_transcription.delta', delta: fragment })
  }
  invokeMessage(controller, { type: 'input_audio_buffer.committed' })
  await vi.advanceTimersByTimeAsync(150)
  invokeMessage(controller, {
    type: 'input_audio_transcription.completed',
    transcript: script.final,
  })
}

const simulateAssistantTurn = async (controller: ConversationController, script: TurnScript) => {
  const fragments = script.fragments ?? [script.final]
  invokeMessage(controller, { type: 'response.created' })
  for (const fragment of fragments) {
    invokeMessage(controller, { type: 'response.audio_transcript.delta', delta: fragment })
  }
  invokeMessage(controller, { type: 'response.audio_transcript.done', text: script.final })
  invokeMessage(controller, { type: 'response.done' })
  await vi.advanceTimersByTimeAsync(50)
}

describe('ConversationController - Scenario Performance Test', () => {
  it.each(SCENARIOS)('replays %s without transcript loss', async ({ personaId, scenarioId, turns }) => {
    vi.useFakeTimers()

    const controller = new ConversationController({
      personaId,
      scenarioId,
      sttFallbackMs: 100,
      debugEnabled: false,
    })

    ;(controller as any).backendTranscriptMode = false

    const transcripts = captureTranscripts(controller)

    try {
      for (const turn of turns) {
        await simulateUserTurn(controller, turn.user)
        if (turn.assistant) {
          await simulateAssistantTurn(controller, turn.assistant)
        }
      }

      const finalTranscripts = transcripts.filter(t => t.isFinal)
      const expectedSequence = turns.flatMap(turn => {
        const sequence: Array<{ role: 'user' | 'assistant'; text: string }> = []
        sequence.push({ role: 'user', text: turn.user.final })
        if (turn.assistant) {
          sequence.push({ role: 'assistant', text: turn.assistant.final })
        }
        return sequence
      })

      expect(finalTranscripts.map(t => ({ role: t.role, text: t.text }))).toEqual(expectedSequence)
      expect(new Set(finalTranscripts.map(t => `${t.role}:${t.text}`)).size).toBe(finalTranscripts.length)
    } finally {
      controller.dispose()
      vi.useRealTimers()
    }
  })
})
