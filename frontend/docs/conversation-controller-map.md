# ConversationController Responsibility Audit

Last updated: 2025-10-02

## Snapshot

- **File**: `src/shared/ConversationController.ts`
- **Size**: ~2,000 lines after initial transcript extraction
- **Primary Roles**: voice session orchestrator, transport wiring, transcript fan-out, adaptive endpointing, instruction sync, diagnostics.

This audit identifies cohesive responsibility groups and recommends extraction order so we can continue shrinking the controller into composable modules.

## Responsibility Groups

### 1. Bootstrap helpers & environment resolution

- Functions: `resolveDebug`, `resolveBargeIn`, `resolveIceServers`, enum/typedefs.
- Scope: Pure helpers to read env/local storage & set defaults.
- Status: ICE wait helper now lives in `transport/RealtimeTransport.ts`; remaining helpers still inline.
- Recommendation: Move into `shared/voice/config.ts` to keep globals reusable across modules.

### 2. Configuration & dependency wiring

- Constructor config plumbing, state defaults, `ConversationSnapshot` accessor, debug toggles.
- Couplings: depends on helper functions above and `TranscriptEngine` callbacks.
- Recommendation: Keep lightweight in controller; expose a `ConversationState` interface if we later extract runtime state into a store.

### 3. Listener management & debug backlog

- Methods: `addListener`, `addDebugListener`, `emit`, `emitDebug`, `updateStatus`, `setDebugEnabled`.
- Description: Handles event subscriptions plus mic meter lifecycle.
- Extraction candidate: `VoiceEventHub` handling queueing/backlog + mic meter so controller only forwards events. Could share with future analytics module.

### 4. Persona / session identity management

- Methods: `setPersonaId`, `setScenarioId`, `setExternalSessionId`, `getEncounterState`, `updateEncounterState`, `prepareInstructionOptions`.
- Notes: tightly coupled with instruction sync and cleanup due to `resetTranscripts`.
- Recommendation: When instruction sync is extracted, move these setter flows into that module to centralize scenario state + pending refresh logic.

### 5. Backend transcript relay (Socket.IO + REST relay)

- Methods: `initializeBackendSocket`, `relayTranscriptToBackend`, socket event handlers, `lastRelayedItemId` tracking, backend-mode branches inside transcript handlers.
- Recommendation: Extract into `TranscriptRelayClient` with interface `{ join(sessionId); emitFinal(role, text, timestamp, itemId?); dispose(); }`.

### 6. Voice session lifecycle & WebRTC transport

- Methods: `startVoice`, `attemptConnection`, `stopVoice`, `dispose`, transport callbacks (`handleIceConnectionStateChange`, `handleConnectionStateChange`, `handleRemoteStream`), plus PC/channel state fields.
- Notes: `RealtimeTransport` module now encapsulates peer connection setup, ICE gathering, and data channel creation. Controller orchestrates higher-level handshake (mic capture, session/token fetch, SDP exchange) and progress events.
- Next steps: Continue shrinking controller by moving retry/backoff policy and progress emissions into transport, leaving the controller to coordinate tokens + transcripts.

### 7. Data channel message router & turn management

- Methods: `handleMessage`, `handleUserTranscript`, `handleAssistantTranscript`.
- Responsibilities: Parse OpenAI realtime payloads, coordinate transcript engine, timers, backend relay, smart patience, finalize flows.
- Couplings: Transcript engine, timers, adaptive VAD, backend relay, instruction sync.
- Recommendation: After transport extraction, split into (a) `RealtimeEventRouter` for payload parsing, (b) `TurnState` for timers/finalization.

### 8. Adaptive VAD & smart patience timers

- Fields and methods: `startMeter`, `updateAdaptiveNoise`, `getAdaptiveSnapshot`, timer scheduling around `userCommitTimer`, fallback/extended timeouts.
- Notes: Heavily math-driven, interacts with DC to send `session.update` updates and manipulates fallback durations.
- Recommendation: Extract into `AdaptiveEndpointController` exposing hooks like `onMicLevel(rms)`, `onSpeechStarted/Stopped`, `scheduleFallbacks`, `currentTimeouts`.

### 9. Instruction synchronization & encounter state

- Methods: `refreshInstructions`, `syncRealtimeInstructions`, state fields `instructionSync*`, `encounterPhase`, `encounterGate`, `outstandingGate`.
- Recommendation: Move into `InstructionSyncService` that manages polling, dedupe signatures, and outstanding gate updates, consuming controller events via callbacks.

### 10. Transcript engine integration

- Already extracted engine in `transcript/TranscriptEngine.ts`; controller retains glue code for backend relay and UI emission.
- Future work: once backend relay client exists, controller’s transcript handlers can forward to `TranscriptEngine` + `TranscriptRelayClient` without business logic branches.

### 11. Diagnostics & utility state

- Items: `emitDebug` backlog management, mic meter animation frame, `applyRemoteFadeIn`, connection progress events.
- Recommendation: As transport extraction occurs, move UI-affecting utilities such as fade-in and progress reporting into transport module or a UI-facing helper.

## Extraction Roadmap

1. **RealtimeTransport (high priority)**
   - Encapsulate WebRTC setup, peer connection, data channel registration, audio attachment, retry strategy.
   - API sketch:

     ```ts
     type TransportEvents = {
       onProgress(update: ConnectionProgress): void
       onChannelMessage(raw: string): void
       onChannelOpen(): void
       onRemoteStream(stream: MediaStream): void
       onError(err: Error): void
     }
     ```

   - Controller becomes a consumer; reduces ~500 lines immediately.

2. **TranscriptRelayClient**
   - Wrapper for Socket.IO + REST relay with debounced catch-up handling.
   - Simplifies backend mode branches inside controller.

3. **AdaptiveEndpointController** + **TurnFinalizer**
   - Extract smart patience, fallback timers, and state flags (`userHasDelta`, `userFinalized`, etc.).
   - Will enable isolated unit tests around timeout behavior.

4. **InstructionSyncService**
   - Manage encounter state, instruction dedupe, outstanding gate tracking.

5. **VoiceEventHub / Diagnostics module**
   - Final pass to move listener and debug backlog logic, leaving `ConversationController` to orchestrate high-level sequencing only.

## Notes for Implementers

- Maintain existing public API (`startVoice`, `stopVoice`, `setPersonaId`, etc.) while delegating internals.
- Each extraction should include focused tests (e.g., transport handshake mocks, adaptive timer scenarios).
- Preserve existing logging and debug events; move emission responsibility into the new modules instead of dropping instrumentation.
- After each extraction, re-run `npm test -- src/shared/__tests__/ConversationController.scenario.test.ts` to verify regressions haven’t been introduced.
