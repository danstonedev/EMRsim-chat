import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { ConversationController } from './ConversationController';
import type { ConversationEvent, VoiceDebugEvent } from './types';
import type { BackendSocketClient } from './types/backendSocket';

const invokeControllerMessage = (controller: ConversationController, payload: Record<string, any>) => {
  (controller as any).handleMessage(JSON.stringify(payload));
};

// Mock socket factory for tests
const createMockSocketFactory = () => {
  return () => {
    const mockSocket: BackendSocketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isEnabled: vi.fn(() => true),
      setEnabled: vi.fn(),
      joinSession: vi.fn(),
      requestCatchup: vi.fn(),
      resetFailureCount: vi.fn(),
      updateLastReceivedTimestamp: vi.fn(),
      getSnapshot: vi.fn(() => ({
        isConnected: false,
        isEnabled: true,
        failureCount: 0,
        lastReceivedTimestamp: 0,
        hasSocket: false,
        currentSessionId: null,
      })),
    };
    return mockSocket;
  };
};

describe('ConversationController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('finalizes user transcript when fallback timer expires without an explicit completion', async () => {
    vi.useFakeTimers();

    const controller = new ConversationController({
      sttFallbackMs: 25,
      sttExtendedMs: 25,
      debugEnabled: false,
      socketFactory: createMockSocketFactory(),
    });
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial') {
        partials.push(event);
      }
      if (event.type === 'transcript') {
        transcripts.push(event);
      }
    });

    invokeControllerMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeControllerMessage(controller, { type: 'input_audio_transcription.delta', delta: 'Hello world' });
    invokeControllerMessage(controller, { type: 'input_audio_buffer.committed' });

    const latestPartial = partials[partials.length - 1];
    expect(latestPartial?.role).toBe('user');
    expect(latestPartial?.text).toBe('Hello world');

    await vi.advanceTimersByTimeAsync(1000);

    const finalEvent = transcripts.filter(event => event.isFinal && event.role === 'user');
    expect(finalEvent.length).toBeGreaterThanOrEqual(1);
    expect(finalEvent[finalEvent.length - 1]?.text).toBe('Hello world');

    controller.dispose();
  });

  it('promotes text deltas even while audio transcript is streaming', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial') {
        partials.push(event);
      }
      if (event.type === 'transcript') {
        transcripts.push(event);
      }
    });

    invokeControllerMessage(controller, { type: 'response.audio_transcript.delta', delta: 'Audio hello' });
    expect(partials.length).toBeGreaterThan(0);
    expect(partials[partials.length - 1]?.text).toBe('Audio hello');

    invokeControllerMessage(controller, { type: 'response.output_text.delta', delta: 'Text override' });
    expect(partials.length).toBeGreaterThan(0);
    const afterTextDelta = partials[partials.length - 1]?.text ?? '';
    expect(afterTextDelta).toContain('Text override');

    invokeControllerMessage(controller, { type: 'response.audio_transcript.delta', delta: 'Audio again' });
    const afterAudioRetry = partials[partials.length - 1]?.text ?? '';
    expect(afterAudioRetry).toBe(afterTextDelta);

    invokeControllerMessage(controller, { type: 'response.output_text.done', text: 'Text override final' });
    const finalText = transcripts.filter(event => event.isFinal && event.role === 'assistant');
    expect(finalText[finalText.length - 1]?.text).toBe('Text override final');

    invokeControllerMessage(controller, { type: 'response.audio_transcript.done', text: 'Audio hello' });
    const assistantFinals = transcripts.filter(event => event.isFinal && event.role === 'assistant');
    expect(assistantFinals[assistantFinals.length - 1]?.text).toBe('Text override final');

    controller.dispose();
  });

  it('sends text payloads when the active data channel is open', async () => {
    const controller = new ConversationController({ debugEnabled: false });
    const send = vi.fn();

    // Mock webrtcManager to return an open channel
    const mockChannel = {
      readyState: 'open',
      send,
    };
    vi.spyOn((controller as any).webrtcManager, 'getActiveChannel').mockReturnValue(mockChannel);

    await controller.sendText('Clinical summary');

    expect(send).toHaveBeenCalledTimes(3);

    const [appendPayload, donePayload, responsePayload] = send.mock.calls.map(([raw]) => JSON.parse(raw));
    expect(appendPayload.type).toBe('input_text.append');
    expect(appendPayload.text).toBe('Clinical summary');
    expect(donePayload.type).toBe('input_text.done');
    expect(responsePayload.type).toBe('response.create');
    expect(responsePayload.response?.modalities).toEqual(['text', 'audio']);

    controller.dispose();
  });

  it('records diagnostics once debug is enabled at runtime', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const debugEvents: any[] = [];
    controller.addDebugListener(event => debugEvents.push(event));
    (controller as any).eventEmitter.emitDebug({ t: new Date().toISOString(), kind: 'info', src: 'app', msg: 'before enable' });
    expect(debugEvents.length).toBe(0);

    controller.setDebugEnabled(true);
    // Backlog is flushed first, then a 'debug enabled' info event is emitted
    expect(debugEvents.length).toBe(2);
    expect(debugEvents[0]?.msg).toBe('before enable');
    expect(debugEvents[1]?.msg).toBe('debug enabled');
    (controller as any).eventEmitter.emitDebug({ t: new Date().toISOString(), kind: 'info', src: 'app', msg: 'after enable' });
    expect(debugEvents.length).toBe(3);
    expect(debugEvents[2]?.msg).toBe('after enable');

    controller.dispose();
  });

  it('aggregates user transcription delta payloads without duplicating content', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial') partials.push(event);
      if (event.type === 'transcript') transcripts.push(event);
    });

    invokeControllerMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: { transcript: 'Hello' },
      item: { content: [{ type: 'input_audio_transcription_delta', transcript: 'Hello' }] },
    });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: { transcript: ' there' },
      item: { content: [{ type: 'input_audio_transcription_delta', transcript: ' there' }] },
    });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'Hello there',
      item: { content: [{ type: 'input_audio_transcription', transcript: 'Hello there' }] },
    });

    const nonEmptyPartials = partials.filter(p => p.role === 'user' && p.text.trim().length > 0);
    expect(nonEmptyPartials[0]?.text).toBe('Hello');
    expect(nonEmptyPartials[nonEmptyPartials.length - 1]?.text).toBe('Hello there');

    const finalUserEvents = transcripts.filter(t => t.type === 'transcript' && t.role === 'user' && t.isFinal);
    expect(finalUserEvents.length).toBeGreaterThan(0);
    expect(finalUserEvents[finalUserEvents.length - 1]?.text).toBe('Hello there');

    controller.dispose();
  });

  it('handles assistant output_text delta payloads with nested content arrays', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial') partials.push(event);
      if (event.type === 'transcript') transcripts.push(event);
    });

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.output_text.delta',
      delta: { content: [{ type: 'output_text_delta', text: 'Good' }] },
      item: { content: [{ type: 'output_text_delta', text: 'Good' }] },
    });
    invokeControllerMessage(controller, {
      type: 'response.output_text.delta',
      delta: { content: [{ type: 'output_text_delta', text: ' morning' }] },
      item: { content: [{ type: 'output_text_delta', text: ' morning' }] },
    });
    invokeControllerMessage(controller, {
      type: 'response.output_text.done',
      output_text: 'Good morning',
      item: { content: [{ type: 'output_text', text: 'Good morning' }] },
    });

    const assistantPartials = partials.filter(p => p.role === 'assistant' && p.text.trim().length > 0);
    expect(assistantPartials[0]?.text).toBe('Good');
    expect(assistantPartials[assistantPartials.length - 1]?.text).toBe('Good morning');

    const finalAssistant = transcripts.filter(t => t.role === 'assistant' && t.isFinal);
    expect(finalAssistant.length).toBeGreaterThan(0);
    expect(finalAssistant[finalAssistant.length - 1]?.text).toBe('Good morning');

    controller.dispose();
  });

  it('guards audio on reused sessions but still transcribes the first assistant response', () => {
    vi.useFakeTimers();
    const remoteAudioElement: any = { muted: false, volume: 0.75 };
    const controller = new ConversationController({ debugEnabled: true, remoteAudioElement });
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial' && event.role === 'assistant') {
        partials.push(event);
      }
      if (event.type === 'transcript' && event.role === 'assistant') {
        transcripts.push(event);
      }
    });
    (controller as any).handleSessionReuse(true);

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.output_text.delta',
      delta: { text: 'Guarded hello' },
      item: { content: [{ type: 'output_text_delta', text: 'Guarded hello' }] },
    });
    invokeControllerMessage(controller, {
      type: 'response.output_text.done',
      output_text: 'Guarded hello',
      item: { content: [{ type: 'output_text', text: 'Guarded hello' }] },
    });

    expect(partials.length).toBeGreaterThan(0);
    expect(transcripts.filter(event => event.isFinal).map(event => event.text)).toContain('Guarded hello');
    expect(controller.isMicPaused()).toBe(true);
    expect(remoteAudioElement.muted).toBe(true);

    vi.advanceTimersByTime(400);

    expect(controller.isMicPaused()).toBe(false);
    expect(remoteAudioElement.muted).toBe(false);
    expect(remoteAudioElement.volume).toBeCloseTo(0.75);

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.output_text.delta',
      delta: { text: 'Normal reply' },
      item: { content: [{ type: 'output_text_delta', text: 'Normal reply' }] },
    });
    invokeControllerMessage(controller, {
      type: 'response.output_text.done',
      output_text: 'Normal reply',
      item: { content: [{ type: 'output_text', text: 'Normal reply' }] },
    });

    const finalAssistantTexts = transcripts.filter(event => event.isFinal).map(event => event.text);
    expect(finalAssistantTexts).toContain('Normal reply');

    controller.dispose();
    vi.useRealTimers();
  });

  it('emits debug events for user transcript updates', () => {
    const controller = new ConversationController({ debugEnabled: true });
    const debugEvents: VoiceDebugEvent[] = [];
    controller.addDebugListener(event => debugEvents.push(event));

    invokeControllerMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.delta',
      delta: { transcript: 'Testing one' },
      item: { content: [{ type: 'input_audio_transcription_delta', transcript: 'Testing one' }] },
    });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.completed',
      transcript: 'Testing one two',
      item: { content: [{ type: 'input_audio_transcription', transcript: 'Testing one two' }] },
    });

    const deltaEvent = debugEvents.find(event => event.kind === 'event' && event.msg === 'transcript.user.delta');
    const finalEvent = debugEvents.find(event => event.kind === 'event' && event.msg === 'transcript.user.final');

    expect(deltaEvent).toBeDefined();
    expect(deltaEvent?.data?.length).toBeGreaterThan(0);
    expect(finalEvent).toBeDefined();
    expect(finalEvent?.data?.preview).toContain('Testing one two');

    controller.dispose();
  });

  it('emits debug events for assistant transcript updates', () => {
    const controller = new ConversationController({ debugEnabled: true });
    const debugEvents: VoiceDebugEvent[] = [];
    controller.addDebugListener(event => debugEvents.push(event));

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.output_text.delta',
      delta: { content: [{ type: 'output_text_delta', text: 'Sure,' }] },
      item: { content: [{ type: 'output_text_delta', text: 'Sure,' }] },
    });
    invokeControllerMessage(controller, {
      type: 'response.output_text.done',
      output_text: 'Sure, here are the details.',
      item: { content: [{ type: 'output_text', text: 'Sure, here are the details.' }] },
    });

    const deltaEvent = debugEvents.find(event => event.kind === 'event' && event.msg === 'transcript.assistant.delta');
    const finalEvent = debugEvents.find(event => event.kind === 'event' && event.msg === 'transcript.assistant.final');

    expect(deltaEvent).toBeDefined();
    expect(deltaEvent?.data?.preview).toContain('Sure,');
    expect(finalEvent).toBeDefined();
    expect(finalEvent?.data?.length).toBeGreaterThan(0);

    controller.dispose();
  });

  it('prefers text content over late audio transcript finals for the same response', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'transcript') transcripts.push(event);
    });

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.audio_transcript.delta',
      delta: { transcript: 'don know' },
      item: { content: [{ type: 'output_audio_transcript_delta', transcript: 'don know' }] },
    });

    const canonicalText = "I don't know for sure, but it feels better when I stretch.";

    invokeControllerMessage(controller, {
      type: 'response.content_part.added',
      content_part: {
        type: 'output_text',
        text: canonicalText,
        content: [{ type: 'output_text', text: canonicalText }],
      },
    });

    invokeControllerMessage(controller, {
      type: 'response.content_part.done',
      content_part: {
        type: 'output_text',
        text: canonicalText,
        content: [{ type: 'output_text', text: canonicalText }],
      },
    });

    invokeControllerMessage(controller, {
      type: 'response.audio_transcript.done',
      transcript: 'don know it like my hip catching',
      item: { content: [{ type: 'output_audio_transcript', transcript: 'don know it like my hip catching' }] },
    });

    const assistantFinals = transcripts.filter(event => event.role === 'assistant' && event.isFinal);
    expect(assistantFinals.length).toBe(1);
    expect(assistantFinals[0]?.text).toBe(canonicalText);

    controller.dispose();
  });

  it('replaces mid-stream audio gibberish with content_part text and suppresses later audio deltas', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const partials: Array<Extract<ConversationEvent, { type: 'partial' }>> = [];
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'partial') partials.push(event);
      if (event.type === 'transcript') transcripts.push(event);
    });

    const canonicalText = 'Let me share those details with you now.';

    invokeControllerMessage(controller, { type: 'response.created' });
    invokeControllerMessage(controller, {
      type: 'response.audio_transcript.delta',
      delta: { transcript: 'mmm skrrttt' },
      item: { content: [{ type: 'output_audio_transcript_delta', transcript: 'mmm skrrttt' }] },
    });

    expect(partials[partials.length - 1]?.text).toBe('mmm skrrttt');

    invokeControllerMessage(controller, {
      type: 'response.content_part.added',
      content_part: {
        type: 'output_text',
        text: canonicalText,
        content: [{ type: 'output_text', text: canonicalText }],
      },
    });

    expect(partials[partials.length - 1]?.text).toBe(canonicalText);

    invokeControllerMessage(controller, {
      type: 'response.audio_transcript.delta',
      delta: { transcript: 'blrrrp' },
      item: { content: [{ type: 'output_audio_transcript_delta', transcript: 'blrrrp' }] },
    });

    expect(partials[partials.length - 1]?.text).toBe(canonicalText);

    invokeControllerMessage(controller, {
      type: 'response.content_part.done',
      content_part: {
        type: 'output_text',
        text: canonicalText,
        content: [{ type: 'output_text', text: canonicalText }],
      },
    });

    invokeControllerMessage(controller, {
      type: 'response.audio_transcript.done',
      transcript: 'blrrrp zoom',
      item: { content: [{ type: 'output_audio_transcript', transcript: 'blrrrp zoom' }] },
    });

    const assistantFinals = transcripts.filter(event => event.role === 'assistant' && event.isFinal);
    expect(assistantFinals.length).toBe(1);
    expect(assistantFinals[0]?.text).toBe(canonicalText);

    controller.dispose();
  });

  it('starts a new user transcript when deltas arrive without a speech_started event', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'transcript') transcripts.push(event);
    });

    const makeCompletedPayload = (text: string) => ({
      transcript: text,
      item: { content: [{ type: 'input_audio_transcription', transcript: text }] },
    });

    // First turn with explicit speech_started signal
    invokeControllerMessage(controller, { type: 'input_audio_buffer.speech_started' });
    invokeControllerMessage(controller, {
      type: 'input_audio_transcription.delta',
      transcript: 'First hello',
      item: { content: [{ type: 'input_audio_transcription_delta', transcript: 'First hello' }] },
    });
    invokeControllerMessage(controller, {
      type: 'conversation.item.input_audio_transcription.completed',
      ...makeCompletedPayload('First hello'),
    });

    // Second turn without speech_started — only conversation item and deltas
    invokeControllerMessage(controller, { type: 'conversation.item.created', item: { role: 'user' } });
    invokeControllerMessage(controller, {
      type: 'conversation.item.input_audio_transcription.delta',
      transcript: 'Second intro',
      item: { content: [{ type: 'input_audio_transcription_delta', transcript: 'Second intro' }] },
    });
    invokeControllerMessage(controller, {
      type: 'conversation.item.input_audio_transcription.completed',
      ...makeCompletedPayload('Second intro'),
    });

    const userFinals = transcripts.filter(event => event.role === 'user' && event.isFinal).map(event => event.text);
    expect(userFinals).toEqual(['First hello', 'Second intro']);

    controller.dispose();
  });

  it('finalizes assistant transcripts even when the final text repeats the previous turn', () => {
    const controller = new ConversationController({ debugEnabled: false });
    const transcripts: Array<Extract<ConversationEvent, { type: 'transcript' }>> = [];

    controller.addListener(event => {
      if (event.type === 'transcript') transcripts.push(event);
    });

    const emitAssistantTurn = () => {
      invokeControllerMessage(controller, { type: 'response.created' });
      invokeControllerMessage(controller, {
        type: 'response.audio_transcript.delta',
        delta: "I'm here",
      });
      invokeControllerMessage(controller, {
        type: 'response.audio_transcript.done',
        text: "I'm here to help.",
      });
    };

    emitAssistantTurn();
    emitAssistantTurn();

    const assistantFinals = transcripts.filter(event => event.role === 'assistant' && event.isFinal);
    expect(assistantFinals.length).toBe(2);
    expect(assistantFinals[assistantFinals.length - 1]?.text).toBe("I'm here to help.");

    controller.dispose();
  });

  it('refreshInstructions forwards new payloads via session.update on the realtime channel', async () => {
    const controller = new ConversationController({ debugEnabled: false });
    const send = vi.fn();
    (controller as any).sessionId = 'session-123';

    // Mock stateManager methods
    vi.spyOn((controller as any).stateManager, 'isSessionReady').mockReturnValue(true);
    vi.spyOn((controller as any).stateManager, 'isAwaitingSessionAck').mockReturnValue(false);

    // Mock webrtcManager methods
    const mockChannel = { readyState: 'open', send };
    vi.spyOn((controller as any).webrtcManager, 'getActiveChannel').mockReturnValue(mockChannel);
    vi.spyOn((controller as any).webrtcManager, 'isActiveChannelOpen').mockReturnValue(true);

    const instructionEvents: Array<Extract<ConversationEvent, { type: 'instructions' }>> = [];
    controller.addListener(event => {
      if (event.type === 'instructions') instructionEvents.push(event);
    });

    const spy = vi.spyOn(api, 'getVoiceInstructions').mockResolvedValue({
      instructions: 'Stay calm and assess vitals first.',
      phase: 'intake',
      outstanding_gate: ['Confirm pain scale'],
    });

  await controller.refreshInstructions('test');

    expect(spy).toHaveBeenCalledTimes(1);
    // Options are now forwarded (e.g., audience). Accept any options object.
    expect(spy).toHaveBeenCalledWith(
      'session-123',
      expect.objectContaining({
        // audience default is 'student' in UI; accept any provided value
      })
    );
    expect(send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(send.mock.calls[0][0]);
    expect(payload.type).toBe('session.update');
    expect(payload.session.instructions).toContain('assess vitals');

    expect(instructionEvents.length).toBe(1);
    expect(instructionEvents[0]).toEqual({
      type: 'instructions',
      instructions: 'Stay calm and assess vitals first.',
      phase: 'intake',
      outstandingGate: ['Confirm pain scale'],
    });

    const encounter = controller.getEncounterState();
    expect(encounter.phase).toBe('intake');
    expect(encounter.outstandingGate).toEqual(['Confirm pain scale']);

    controller.dispose();
  });

  it('dedupes refreshInstructions calls based on instructions, phase, and outstanding gates', async () => {
    const controller = new ConversationController({ debugEnabled: false });
    const send = vi.fn();
    (controller as any).sessionId = 'session-321';

    // Mock stateManager methods
    vi.spyOn((controller as any).stateManager, 'isSessionReady').mockReturnValue(true);
    vi.spyOn((controller as any).stateManager, 'isAwaitingSessionAck').mockReturnValue(false);

    // Mock webrtcManager methods
    const mockChannel = { readyState: 'open', send };
    vi.spyOn((controller as any).webrtcManager, 'getActiveChannel').mockReturnValue(mockChannel);
    vi.spyOn((controller as any).webrtcManager, 'isActiveChannelOpen').mockReturnValue(true);

    const instructionEvents: Array<Extract<ConversationEvent, { type: 'instructions' }>> = [];
    controller.addListener(event => {
      if (event.type === 'instructions') instructionEvents.push(event);
    });

    const spy = vi
      .spyOn(api, 'getVoiceInstructions')
      .mockResolvedValueOnce({
        instructions: 'Open with a warm greeting and active listening cues.',
        phase: 'subjective',
        outstanding_gate: ['Warm greeting'],
      })
      .mockResolvedValueOnce({
        instructions: 'Open with a warm greeting and active listening cues.',
        phase: 'subjective',
        outstanding_gate: ['Warm greeting'],
      })
      .mockResolvedValueOnce({
        instructions: 'Open with a warm greeting and active listening cues.',
        phase: 'subjective',
        outstanding_gate: ['Warm greeting', 'Obtain consent'],
      });

    await controller.refreshInstructions('initial');
    await controller.refreshInstructions('duplicate');
    await controller.refreshInstructions('gate-update');

    expect(spy).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledTimes(2);
    expect(instructionEvents.length).toBe(2);
    expect(instructionEvents[1]?.outstandingGate).toEqual(['Warm greeting', 'Obtain consent']);

    const encounter = controller.getEncounterState();
    expect(encounter.phase).toBe('subjective');
    expect(encounter.outstandingGate).toEqual(['Warm greeting', 'Obtain consent']);

    controller.dispose();
  });

  it('waits for session.updated before sending initial session.update payload', async () => {
    const controller = new ConversationController({ debugEnabled: false });
    const send = vi.fn();
    (controller as any).sessionId = 'session-init-1';

    // Mock webrtcManager methods
    const mockChannel = { readyState: 'open', send };
    vi.spyOn((controller as any).webrtcManager, 'getActiveChannel').mockReturnValue(mockChannel);
    vi.spyOn((controller as any).webrtcManager, 'isActiveChannelOpen').mockReturnValue(true);

    const instructions = {
      instructions: 'Open with a warm greeting and active listening cues.',
      phase: 'subjective',
      outstanding_gate: ['Warm greeting'],
    };

    const spy = vi.spyOn(api, 'getVoiceInstructions').mockResolvedValue(instructions);

    invokeControllerMessage(controller, { type: 'session.created' });

    await Promise.resolve();

    const sessionInstructionUpdatesBeforeAck = send.mock.calls
      .map(([raw]) => JSON.parse(raw))
      .filter(payload => payload?.type === 'session.update' && typeof payload?.session?.instructions === 'string');

    expect(spy).not.toHaveBeenCalled();
    expect(sessionInstructionUpdatesBeforeAck.length).toBe(0);

    invokeControllerMessage(controller, {
      type: 'session.updated',
      session: {
        input_audio_transcription: {
          model: 'gpt-4o-mini-transcribe',
        },
      },
    });

    // Wait for session.updated → markSessionReady → drainPendingInstructionSync → syncRealtimeInstructions
    await Promise.resolve();
    await Promise.resolve();

    // Wait for the API promise to resolve
    const refreshPromise = spy.mock.results[0]?.value;
    if (refreshPromise && typeof (refreshPromise as Promise<any>).then === 'function') {
      await refreshPromise;
    }

    // Additional yields to allow syncRealtimeInstructions to complete and send the message
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const sessionInstructionUpdatesAfterAck = send.mock.calls
      .map(([raw]) => JSON.parse(raw))
      .filter(payload => payload?.type === 'session.update' && typeof payload?.session?.instructions === 'string');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(sessionInstructionUpdatesAfterAck.length).toBe(1);
    expect(sessionInstructionUpdatesAfterAck[0]?.session.instructions).toContain('Open with a warm greeting');

    controller.dispose();
  });
});
