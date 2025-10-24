# Conversation Controller Refactor Continuation

Last updated: 2025-10-08

## Why this doc exists

We just split the instruction sync logic and the session lifecycle handler out of `ConversationController`. This guide captures the remaining roadmap so the next engineer can pick up the modularization work without context loss.

## Current status snapshot

- `ConversationController` delegates instruction refreshes through `createInstructionSyncManager` (`features/voice/conversation/instructions/instructionSync.ts`).
- Session creation/update handling now lives in `handleSessionEvent` (`features/voice/conversation/events/sessionEvents.ts`). The helper already exposes a TODO to extend coverage for more lifecycle events (e.g. `session.failed`).
- The bulk of `handleMessage` still lives inside the controller, especially the branches that coordinate:
  - user speech detection + endpointing fallbacks,
  - transcription deltas/completions/failures,
  - assistant response streaming (text + audio),
  - conversation item bookkeeping and backend relay triggers.
- Latest validation: `npm run type-check` (Oct 8, 2025) completes with no diagnostics.

## Remaining workstreams

### Phase 3 — Message event stratification

1. **Introduce an event classifier** that groups WebRTC data-channel payloads into families (session, input audio, transcription, assistant response, conversation items, misc). This can be a pure helper that returns `{ family, type, payload }` to simplify downstream dispatch.
2. **Extract context-neutral factories** (similar to the instruction & session helpers) for each family:
   - `createSpeechEventHandlers` — owns speech started/stopped, buffer commit, and VAD/endpointing coordination.
   - `createTranscriptionEventHandlers` — finalizes user turns, relays to backend when `backendTranscriptMode` is enabled, and manages STT fallback timers.
   - `createAssistantStreamHandlers` — handles assistant response lifecycle, delta aggregation, media markers, mic guard release, and backend relays.
   - `createConversationItemHandlers` — centralizes `conversation.item.*` events plus replay logic for reused sessions.
3. **Wire the helpers** into `ConversationController.handleMessage` by injecting the dependencies they need (endpointing, transcriptEngine, transcriptCoordinator, eventEmitter, stateManager, etc.). Keep the controller-side method responsible only for JSON parsing, debug logging, and delegating to the first helper that claims the event.
4. **Preserve guard rails**: logging semantics (`this.logDebug` and `emitDebug`) should stay consistent so downstream monitoring dashboards do not regress.

### Phase 4 — Lifecycle finishing touches

1. Flesh out the `// TODO(voice-refactor)` in `sessionEvents.ts` by covering failure / teardown cases (`session.failed`, `session.expired`, acknowledgement timeout escalations).
2. Audit remaining controller methods for opportunities to convert into narrow helpers (e.g. mic pause auto-guard, remote audio reset) once message handling is modular.
3. Prepare follow-up unit tests targeted at each helper:
   - Use `vitest` with dependency injection + spies to assert the helpers emit the correct state transitions.
   - Focus first on the speech/transcription pipeline because it carries the most edge cases (empty transcripts, timeout fallbacks, 429 errors).

### Phase 5 — Integration hardening & documentation

1. Backfill tests around backend relay behavior (`backendTranscriptMode`) to ensure we emit/skip transcripts at the right moments.
2. Update developer docs (`frontend/docs/conversation-controller-map.md`) with the new helper boundaries and data flow diagrams.
3. Confirm the refactor does not regress e2e behavior by running the critical flows Playwright spec once helper extraction is complete.

## Implementation guardrails

- **Dependency injection first**: build helper factories that accept a typed `deps` object. This mirrors the existing patterns (`SessionReadyManager`, `SessionReuseHandlers`) and makes future unit testing straightforward.
- **Avoid temporal coupling**: when extracting handlers, ensure state transitions (e.g. `markTurnFinalized`, `setAutoMicPaused`) stay in lockstep with the events that previously triggered them. Add inline comments if the ordering feels fragile.
- **Maintain telemetry parity**: every `emitDebug` today is relied upon during live incident response. When migrating code, copy the log message verbatim or centralize it inside the helper.
- **Keep backend-relay semantics**: when `backendTranscriptMode` is true, user finals must be skipped locally while assistant finals still relay upstream.

## Validation checklist per phase

1. `npm run type-check` — should pass after each extraction.
2. `npm run test` — add/maintain unit coverage for the new helpers.
3. `npm run lint` — optional but recommended before submitting PRs.
4. Manual voice smoke test:
   - Launch both backend & frontend (`npm run dev` in each project).
   - Start a voice session, confirm speech detection, transcription, and assistant replies still flow. Watch the in-app debug console for any missing events.
   - Verify UI receives `voice-ready` within expected timeline.

## Handoff checklist (TL;DR)

- [ ] Classifier helper created and `handleMessage` delegates to family-specific handlers.
- [ ] Speech, transcription, assistant, and item handlers extracted with injected dependencies.
- [ ] Session lifecycle helper extended beyond created/updated events.
- [ ] Unit tests for new helpers merged and passing (`vitest`).
- [ ] Docs & debug log parity confirmed.

Once these are complete, `ConversationController` should mostly orchestrate high-level flow, making future roadmap items (e.g. telemetry enrichment, retries, conversation history replay) far easier to implement.
