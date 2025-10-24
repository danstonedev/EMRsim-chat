# Conversation Transport Path Survey

Last updated: 2025-10-02.

## Objectives

- Document every hop used by `ConversationController` to communicate with backend and OpenAI services.
- Highlight duplication and cross-cutting concerns that need attention before extracting the transport/session wiring module.
- Provide the parallel modularization agent with concrete context to stage the first extraction.

## Current transport surfaces

| Channel | Initiator | Endpoint(s) | Purpose | Notes |
| --- | --- | --- | --- | --- |
| WebRTC media | Browser (`ConversationController.prepareWebRTCConnection`) | OpenAI Realtime (via token from `/api/voice/token`) | Streams microphone audio upstream; receives synthesized assistant audio | Tracks stored in `RTCPeerConnection`; local data channel `oai-events` created before session bootstrap. |
| WebRTC data channel (`oai-events`) | Browser creates; server responds | OpenAI Realtime | Receives realtime JSON events (transcripts, instructions) and sends `response.create`, `session.update`, ping/pong | Active channel stored in `this.activeChannel`; reused for instruction refresh and VAD tuning commands. |
| REST `POST /api/sessions` | Browser (`api.createSession`) | Backend `sessionsRouter` → OpenAI session service | Creates SPS conversation session and returns `session_id` | Bypassed when reusing session via `setExternalSessionId`. |
| REST `POST /api/voice/token` | Browser | Backend `voiceRouter` | Exchanges `session_id` for OpenAI voice token + model metadata | Timed in metrics plan; input/reply language normalization happens client-side. |
| REST `POST /api/voice/sdp` | Browser | Backend `voiceRouter` | Sends local SDP offer, receives remote SDP answer for WebRTC negotiation | Timeout 30s; still used when fallback negotiation needed. |
| REST `POST /api/transcript/relay/:sessionId` | Browser (`relayTranscriptToBackend`) | Backend `transcriptRouter` → `transcriptRelayController` | Mirrors every transcript delta/final back to backend for broadcast | In backend transcript mode, controller suppresses final emission until broadcast arrives. |
| Socket.IO `/socket.io/` | Browser (`initializeBackendSocket`) | Backend `transcript_broadcast` service | Joins `session:{id}` room, receives `transcript`, `transcript-error`, `catchup-transcripts` | Also used to request missed transcripts via `request-catchup`. |
| REST `POST /api/voice/instructions` | Browser (`api.getVoiceInstructions`) | Backend instructions service | Retrieves latest instruction payload based on encounter phase/gate | Triggered from data channel open + manual refresh. |

## Observed duplication & leaks

- **Session lifecycle**: `ConversationController` manually coordinates REST calls, WebRTC setup, and transcript broadcasting. Transport logic, UI state, and telemetry are interwoven.
- **Transcript flow**: Finals go through both OpenAI channel and backend relay, requiring dedupe logic on the controller side (`backendTranscriptMode` flag, `lastRelayedItemId`).
- **Instruction sync**: Data channel is multitasking—used both for OpenAI-specific messaging and app-specific instruction refresh triggers, complicating extraction.
- **WebRTC resilience**: Retry logic lives alongside UI updates; `attemptConnection` manages mic prompts, ICE progress, and progress events simultaneously.

## Extraction candidate (transport/session module)

- **Responsibilities to isolate**:
  - Session bootstrap: orchestrate `createSessionWithLogging`, token fetch, `prepareWebRTCConnection`, and socket registration behind a single async state machine.
  - Transcript relay bridge: own `relayTranscriptToBackend`, backend socket initialization, and dedupe strategy so UI can subscribe to a clean transcript stream.
  - Instruction channel: expose `sendInstructionUpdate` / `refreshInstructions` interfaces without leaking raw `RTCDataChannel` references.
- **Proposed interface**:
  - `TransportController.start(params): Promise<TransportHandle>` where handle exposes:
    - `on(event, listener)` for status updates (`connection-progress`, `transcript`, `error`).
    - `refreshInstructions(options)` returning ack metadata.
    - `stop()` to tear down Mic/WebRTC/socket resources.
  - Encapsulate metrics emission so UI layer only consumes derived events.
- **Required collaborators**:
  - `TranscriptEngine` for text assembly (likely injected).
  - Future metrics shim (from metrics plan) for instrumentation.
  - Barge-in / adaptive VAD (keep in higher layer until dedicated module exists).

## Known dependencies

- Backend `transcript_broadcast` service must remain initialized (`initTranscriptBroadcast` in `backend/src/index.js`).
- Socket namespace uses `session:${sessionId}` rooms; any new module should preserve this routing or provide migration plan.
- REST endpoints rely on `import.meta.env.VITE_API_BASE_URL`; refactor should accept this via configuration to ease testing.
- `backendTranscriptMode` toggles whether client emits finals; transport module must expose a flag or strategy hook for dedupe.

## Next steps

1. Confirm with modularization agent that transport/session wiring is the first extraction target.
2. Prototype a `TransportController` wrapper that mirrors existing events without UI coupling.
3. Move `initializeBackendSocket` + `relayTranscriptToBackend` into the wrapper, exposing a clean transcript observable for dedupe work (todo #7).
4. Document new boundaries in `ops/docs/UNIFIED_TRANSCRIPT_ARCHITECTURE.md` once interface stabilizes.
