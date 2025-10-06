# Driver Interfaces (Provider-Agnostic)

Keep the UI stable and swap providers here. Implement OpenAI first; add others later if needed.

## LLMDriver
- `stream(promptParts, options) → AsyncIterable<{ deltaText, done? }>`
  - Emits token deltas immediately (SSE/fetch stream)
  - Options: system, messages, temperature, max_tokens, tools?

## STTDriver
- `stream(pcmFrames, options) → AsyncIterable<{ type: 'partial'|'final', text }>`
  - Accept 16-bit PCM frames at fixed sample rate (e.g., 16k/24k)
  - Emit partials within 300 ms (P95) on Realtime; 800 ms on manual

## TTSDriver
- `stream(text, options) → AsyncIterable<AudioChunk>`
  - Start audio within 400 ms; support chunked transfer and early playback

## RealtimeTransport
- `connect(token, opts) → { sendAudio(chunk), on('partial'|'final'|'audio', fn), close() }`
  - Primary: WebRTC; fallback: WebSocket (later)

## Security
- No raw API keys exposed to client
- Server mints **short-lived** tokens for Realtime connections

## References
- OpenAI Realtime (WebRTC/WebSocket), Streaming responses, Audio (TTS/STT) streaming
