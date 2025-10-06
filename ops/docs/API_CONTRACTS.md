# API Contracts (Stable Shapes, No App Code)

All endpoints are **stubs first**; flesh them out as milestones unlock. Streaming is required wherever specified.

## Personas
### GET /api/personas
→ 200 `[ { id, display_name, headline?, tags?[] } ]`

### GET /api/personas/:id
→ 200 `{ id, display_name, system_directives, answer_style?, no_go_topics?[], speaking_rate?, voice_id?, ... }`

### POST /api/personas/validate
Body: `{ persona }`
→ 200 `{ warnings: string[] }`

## Sessions
### POST /api/sessions
Body: `{ persona_id, mode: 'text'|'voice' }`
→ 201 `{ session_id }`

### POST /api/sessions/:id/message  (TEXT MODE)
Streamed response: `event: delta` → `{ role, delta_text }`, then `event: done`

### POST /api/sessions/:id/end
→ 200 `{ summary, metrics }`

## Voice
### POST /api/voice/token
→ 200 `{ rtc_token, model, tts_voice, opts }`
Notes: This is a **short-lived** credential used to establish a **WebRTC/WebSocket** session with the Realtime API.

### POST /api/voice/fallback-stt  (only if manual path enabled)
Input: streaming PCM frames
Streamed response: `{ type: 'partial'|'final', text }`

## Metrics
### POST /api/metrics/turn
Body: `{ session_id, timings: { stt?, llm?, tts? }, tokens?, audio? }`
→ 200 `{ ok: true }`

### GET /api/metrics/session/:id
→ 200 `{ aggregates: {...}, p50, p95, p99 }`

## Health
### GET /api/health
→ 200 `{ ok, uptime_s, db: 'ok'|'err', openai: 'ok'|'err' }`

## Streaming Expectations
- Text: use **server-sent streaming** or fetch streams; emit deltas as they arrive.
- Voice (Realtime): establish **WebRTC**; send microphone audio; receive partial transcripts + audio out.
- Voice (Manual): chunk PCM to STT; on final text, stream LLM output; feed segments to TTS and start playback early.

## Security Expectations
- No raw API keys in the client.
- Backend mints **time-boxed tokens** for Realtime; revoke if idle.
