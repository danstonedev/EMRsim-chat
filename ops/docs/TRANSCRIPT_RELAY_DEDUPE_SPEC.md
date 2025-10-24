# Transcript Relay Dedupe Specification

Last updated: 2025-10-02.

## Problem statement

- Voice transcripts arrive from two paths: OpenAI realtime data channel events and backend broadcast relays triggered by `relayTranscriptToBackend`.
- In `backendTranscriptMode`, the frontend suppresses final emissions and waits for backend broadcasts, but partials are still emitted locally. Missing or duplicated `itemId` and timestamp handling cause double rendering and stale bubbles.
- Multiple browser tabs can join the same session. Each currently relays identical payloads to the backend, resulting in duplicate broadcasts and inconsistent ordering for other listeners.

## Goals

1. Ensure each transcript item (identified by OpenAI `item_id`) is broadcast exactly once per role per session.
2. Preserve real-time partial updates while guaranteeing finals derive from a single authoritative source (backend broadcast when available).
3. Support catch-up/replay flows (`request-catchup`) without reintroducing duplicates in UI or stored transcripts.
4. Provide deterministic logging for metrics and debugging (ties into `VOICE_METRICS_SLA_PLAN.md`).

## Data sources & current hooks

- **Client**: `ConversationController.handleUserTranscript`, `handleAssistantTranscript`, and `relayTranscriptToBackend` maintain `lastRelayedItemId` and track pending speech state.
- **Backend REST**: `backend/src/controllers/transcriptRelayController.js` forwards payloads to Socket.IO via `transcript_broadcast` service without dedupe.
- **Backend socket**: `transcript_broadcast` uses rooms `session:{sessionId}` to emit `{ role, text, isFinal, timestamp, itemId, source }`.
- **Catch-up**: `initializeBackendSocket` `request-catchup` handler expects backend to filter transcripts since last timestamp.

## Dedupe strategy

### Identifiers

- Primary key: tuple `(sessionId, role, itemId)` when `itemId` is present.
- Fallback key: `(sessionId, role, normalizedText, isFinal, timestampBucket)` when `itemId` missing (e.g., partials or older API payloads). `timestampBucket = Math.floor(timestamp / 250)` to absorb jitter.

### Client responsibilities

- Maintain a bounded LRU cache (size 100 per role) keyed by primary or fallback key.
- Before emitting or relaying:
  - If entry exists and `isFinal === false`, allow partial to pass (UI may need most recent delta); always update cache with latest text but do **not** relay duplicate partials when identical payload reappears.
  - If entry exists and `isFinal === true`, skip emission/relay and log `metric=dedupe.client.skip_final`.
- When backend broadcast received:
  - Compare payload against cache; if duplicate, skip UI emit but update timestamp to support freshness drift metric.
  - If new final arrives for existing partial key, promote cache entry to final state and emit once.
- On reconnection / catch-up responses: seed cache with returned items before replaying them to listeners.

### Backend responsibilities

- Introduce per-session in-memory dedupe map in `transcript_broadcast` (LRU capped at 500 entries) keyed by `(role, itemId)`; clear when session inactive for >30 minutes.
- In `relayTranscript` controller:
  - If `itemId` missing and `isFinal === true`, log warning and accept but mark payload `dedupeKey` using fallback hashing.
  - If key already broadcast with same text + final flag, return `204` without emitting and include header `X-Transcript-Dedupe: skipped` for observability (optional now, future instrumentation).
- Socket layer: when `request-catchup` runs, reuse same dedupe map to avoid re-emitting duplicates introduced by race conditions.

### Storage / downstream consumers

- Export dedupe result in logs (`dedupe_action = emitted|skipped|promoted`).
- Ensure any future persistence layer (e.g., `saveSpsTurns`) receives final transcripts only once; plan to hook dedupe decisions there.

## Test matrix

| Scenario | Steps | Expected result |
| --- | --- | --- |
| Single tab, backend mode on | Speak phrase once; OpenAI emits deltas + completion; frontend relays once; backend broadcasts once | UI shows single bubble; backend logs `dedupe_action=emitted`; cache size increments then evicts oldest entries over 100 |
| Multiple tabs, simultaneous relay | Two tabs relay identical payload (same `itemId`) | Backend dedupe skips second broadcast; both tabs receive exactly one final via socket; metrics record skip |
| Missing `itemId` finals | Backend returns completion without `itemId` | Fallback key prevents duplicate finals; warning logged with `dedupe_fallback=true` |
| Catch-up replay | Disconnect, speak, reconnect after 10s; backend sends catch-up | Client seeds cache before emitting; no duplicate bubbles |
| Rapid partial spam | OpenAI sends repeated identical partial delta | UI updates only when text changes; relay suppressed for duplicates (no redundant network calls) |
| Text-only entry (non-voice) | Input text committed manually | Final dedupe path still applies; itemId may be absent so fallback key used |

## Implementation notes

- Use lightweight helper `createDedupeCache({ maxEntries })` shared by controller and future transport module; expose `checkAndInsert(payload)` returning `{ action: 'emit' | 'skip' | 'promote', reason }`.
- Consider moving backend dedupe state into Redis or another shared store if horizontal scaling is required; initial implementation may stay in-process.
- Coordinate with transport extraction so dedupe cache lives alongside new module rather than UI layer.
- Update existing tests (`backend/tests/transcriptRelayController.test.ts` and frontend transcript scenarios) to cover new behavior.

## Open questions

- Should backend always be authoritative for finals even when `backendTranscriptMode === false`? (Likely yes for consistency; confirm with product.)
- What is acceptable staleness window for catch-up? Decide whether to expire cache entries after 5 minutes to avoid memory pressure.
- Where to surface dedupe metrics (logs vs. telemetry endpoint) in conjunction with the metrics plan.
