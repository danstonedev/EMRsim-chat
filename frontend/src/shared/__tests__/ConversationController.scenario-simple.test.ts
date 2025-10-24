/**
 * Simple scenario test: Validates that ConversationController accurately captures
 * user input and assistant responses in a realistic medical interview scenario.
 */

import { describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../ConversationController';
import type { ConversationEvent } from '../types';

const invokeMessage = (controller: ConversationController, payload: Record<string, any>) => {
  (controller as any).handleMessage(JSON.stringify(payload));
};

describe('ConversationController - Scenario Accuracy Test', () => {
  it('accurately captures a complete medical interview scenario', async () => {
    vi.useFakeTimers();

    const controller = new ConversationController({
      personaId: 'patient-hip-pain',
      scenarioId: 'hip-scenario-01',
      sttFallbackMs: 100,
      debugEnabled: false,
    });

    // Disable backend mode for testing - we want local transcript events
    (controller as any).backendTranscriptMode = false;

    const transcripts: Array<{ role: string; text: string; isFinal: boolean }> = [];

    controller.addListener((event: ConversationEvent) => {
      if (event.type === 'transcript') {
        transcripts.push({
          role: event.role,
          text: event.text,
          isFinal: event.isFinal,
        });
      }
    });

    // ========== Turn 1: Greeting ==========
    invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeMessage(controller, { type: 'input_audio_transcription.delta', delta: 'Hello doctor' });
    invokeMessage(controller, { type: 'input_audio_buffer.committed' });
    await vi.advanceTimersByTimeAsync(150);
    invokeMessage(controller, { type: 'input_audio_transcription.completed', transcript: 'Hello doctor' });

    // Verify user greeting was captured
    const userGreeting = transcripts.find(t => t.role === 'user' && t.isFinal && t.text === 'Hello doctor');
    expect(userGreeting).toBeDefined();

    // Assistant responds
    invokeMessage(controller, { type: 'response.created' });
    invokeMessage(controller, { type: 'response.audio_transcript.delta', delta: 'Hello! How can I help you today?' });
    invokeMessage(controller, { type: 'response.audio_transcript.done', text: 'Hello! How can I help you today?' });
    invokeMessage(controller, { type: 'response.done' });

    const assistantGreeting = transcripts.find(
      t => t.role === 'assistant' && t.isFinal && t.text === 'Hello! How can I help you today?'
    );
    expect(assistantGreeting).toBeDefined();

    // ========== Turn 2: Chief Complaint ==========
    invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: 'I have been having pain in my right hip',
    });
    invokeMessage(controller, { type: 'input_audio_buffer.committed' });
    await vi.advanceTimersByTimeAsync(150);
    invokeMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'I have been having pain in my right hip',
    });

    const chiefComplaint = transcripts.find(
      t => t.role === 'user' && t.isFinal && t.text === 'I have been having pain in my right hip'
    );
    expect(chiefComplaint).toBeDefined();

    // Assistant asks follow-up
    invokeMessage(controller, { type: 'response.created' });
    invokeMessage(controller, {
      type: 'response.audio_transcript.delta',
      delta: 'I see. Can you tell me when this started?',
    });
    invokeMessage(controller, {
      type: 'response.audio_transcript.done',
      text: 'I see. Can you tell me when this started?',
    });
    invokeMessage(controller, { type: 'response.done' });

    const followUp = transcripts.find(
      t => t.role === 'assistant' && t.isFinal && t.text === 'I see. Can you tell me when this started?'
    );
    expect(followUp).toBeDefined();

    // ========== Turn 3: History Details ==========
    invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: 'It started about three weeks ago after I went jogging',
    });
    invokeMessage(controller, { type: 'input_audio_buffer.committed' });
    await vi.advanceTimersByTimeAsync(150);
    invokeMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'It started about three weeks ago after I went jogging',
    });

    const historyDetail = transcripts.find(
      t => t.role === 'user' && t.isFinal && t.text === 'It started about three weeks ago after I went jogging'
    );
    expect(historyDetail).toBeDefined();

    // Assistant acknowledges
    invokeMessage(controller, { type: 'response.created' });
    invokeMessage(controller, {
      type: 'response.audio_transcript.delta',
      delta: 'Thank you for that information. Does anything make it better or worse?',
    });
    invokeMessage(controller, {
      type: 'response.audio_transcript.done',
      text: 'Thank you for that information. Does anything make it better or worse?',
    });
    invokeMessage(controller, { type: 'response.done' });

    // ========== Turn 4: Aggravating Factors ==========
    invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: 'It gets worse when I walk up stairs or stand for a long time',
    });
    invokeMessage(controller, { type: 'input_audio_buffer.committed' });
    await vi.advanceTimersByTimeAsync(150);
    invokeMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'It gets worse when I walk up stairs or stand for a long time',
    });

    const aggravatingFactors = transcripts.find(
      t => t.role === 'user' && t.isFinal && t.text === 'It gets worse when I walk up stairs or stand for a long time'
    );
    expect(aggravatingFactors).toBeDefined();

    // Verify transcript ordering - should alternate user/assistant
    const finalTranscripts = transcripts.filter(t => t.isFinal);
    const roles = finalTranscripts.map(t => t.role);

    // Should have at least 6 turns (3 user + 3 assistant minimum)
    expect(finalTranscripts.length).toBeGreaterThanOrEqual(6);

    // First should be user, then alternating
    expect(roles[0]).toBe('user');
    expect(roles[1]).toBe('assistant');
    expect(roles[2]).toBe('user');
    expect(roles[3]).toBe('assistant');

    // Verify no duplicate transcripts
    const uniqueTexts = new Set(finalTranscripts.map(t => `${t.role}:${t.text}`));
    expect(uniqueTexts.size).toBe(finalTranscripts.length);

    // Print transcript for visual verification
    console.log('\nScenario Transcript:');
    console.log('═'.repeat(60));
    finalTranscripts.forEach((t, i) => {
      const label = t.role === 'user' ? 'Student' : 'Patient';
      console.log(`${i + 1}. ${label}: ${t.text}`);
    });
    console.log('═'.repeat(60));
    console.log(`Captured ${finalTranscripts.length} turns accurately\n`);

    controller.dispose();
    vi.useRealTimers();
  });

  it('handles rapid back-and-forth exchanges without loss', async () => {
    vi.useFakeTimers();

    const controller = new ConversationController({
      sttFallbackMs: 100,
      debugEnabled: false,
    });

    // Disable backend mode for testing
    (controller as any).backendTranscriptMode = false;

    const transcripts: Array<{ role: string; text: string; isFinal: boolean }> = [];

    controller.addListener((event: ConversationEvent) => {
      if (event.type === 'transcript' && event.isFinal) {
        transcripts.push({
          role: event.role,
          text: event.text,
          isFinal: event.isFinal,
        });
      }
    });

    // Rapid exchanges
    const exchanges = [
      { user: 'My knee hurts', assistant: 'Which knee?' },
      { user: 'The right one', assistant: 'When did it start?' },
      { user: 'Two days ago', assistant: 'Any swelling?' },
      { user: 'Yes a little', assistant: 'Can you bend it?' },
    ];

    for (const exchange of exchanges) {
      // User speaks
      invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
      invokeMessage(controller, { type: 'input_audio_transcription.delta', delta: exchange.user });
      invokeMessage(controller, { type: 'input_audio_buffer.committed' });
      await vi.advanceTimersByTimeAsync(150);
      invokeMessage(controller, { type: 'input_audio_transcription.completed', transcript: exchange.user });

      // Assistant responds
      invokeMessage(controller, { type: 'response.created' });
      invokeMessage(controller, { type: 'response.audio_transcript.delta', delta: exchange.assistant });
      invokeMessage(controller, { type: 'response.audio_transcript.done', text: exchange.assistant });
      invokeMessage(controller, { type: 'response.done' });

      await vi.advanceTimersByTimeAsync(50);
    }

    // Verify all exchanges were captured
    expect(transcripts.length).toBe(exchanges.length * 2); // user + assistant per exchange

    // Verify content accuracy
    for (let i = 0; i < exchanges.length; i++) {
      expect(transcripts[i * 2].role).toBe('user');
      expect(transcripts[i * 2].text).toBe(exchanges[i].user);
      expect(transcripts[i * 2 + 1].role).toBe('assistant');
      expect(transcripts[i * 2 + 1].text).toBe(exchanges[i].assistant);
    }

    console.log(`\nAll ${exchanges.length} rapid exchanges captured accurately`);

    controller.dispose();
    vi.useRealTimers();
  });

  it('maintains accuracy when user speech is interrupted', async () => {
    vi.useFakeTimers();

    const controller = new ConversationController({
      sttFallbackMs: 100,
      debugEnabled: false,
    });

    // Disable backend mode for testing
    (controller as any).backendTranscriptMode = false;

    const transcripts: Array<{ role: string; text: string; isFinal: boolean }> = [];

    controller.addListener((event: ConversationEvent) => {
      if (event.type === 'transcript' && event.isFinal) {
        transcripts.push({
          role: event.role,
          text: event.text,
          isFinal: event.isFinal,
        });
      }
    });

    // User starts speaking
    invokeMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeMessage(controller, { type: 'input_audio_transcription.delta', delta: 'I have pain in my' });

    // Speech continues
    invokeMessage(controller, { type: 'input_audio_transcription.delta', delta: ' shoulder and it' });

    // Finalize
    invokeMessage(controller, { type: 'input_audio_buffer.committed' });
    await vi.advanceTimersByTimeAsync(150);
    invokeMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'I have pain in my shoulder and it hurts',
    });

    // Should get the complete final transcript
    const userTranscript = transcripts.find(t => t.role === 'user');
    expect(userTranscript).toBeDefined();
    expect(userTranscript?.text).toBe('I have pain in my shoulder and it hurts');

    controller.dispose();
    vi.useRealTimers();
  });
});
