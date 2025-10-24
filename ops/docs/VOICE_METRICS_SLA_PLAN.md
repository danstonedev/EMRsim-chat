# Voice Conversation Metrics & SLA Plan

Last updated: 2025-10-02.

## Purpose

Accelerate modularization by giving the refactor team and reliability owners a shared, instrumented view of voice-session health. The plan documents which KPIs we must capture, where to hook them in the current `ConversationController`, and how we will surface SLAs and alerts once the controller is decomposed into smaller modules.

## Scope

- **Frontend**: `frontend/src/shared/ConversationController.ts` and child utilities (`TranscriptEngine`, transport wiring, playback pipeline).
- **Backend**: `backend/src/controllers/transcriptRelayController.js`, WebSocket relay, REST session routes, and any middleware that issues voice tokens or transcripts.
- **Out of scope (for now)**: downstream analytics warehouse ingestion, long-term retention, redaction policy updates.

## KPI catalog

| Metric name | Definition | Target SLA (p95) | Capture location | Notes |
| --- | --- | --- | --- | --- |
| Connection setup time | `Date.now()` delta from `attemptConnection` entry to first `pc.connectionState === 'connected'` | ≤ 3.5s | Instrument around `ConversationController.attemptConnection` and the `connectionstatechange` listener | Emits `{step:"connect_ready"}` milestone events on success; include retry count on failure. |
| Mic acquisition latency | Time from `getUserMedia` request to resolved stream | ≤ 750ms | Wrap the `navigator.mediaDevices.getUserMedia` await in `attemptConnection` | Include hardware fingerprint hash to correlate slow devices. |
| Session bootstrap latency | Time to create/reuse session via `createSessionWithLogging` | ≤ 600ms | Extend `createSessionWithLogging` to emit structured debug + metric payloads | Attach `reused` flag to separate cold vs warm starts. |
| Voice token fetch latency | `api.getVoiceToken` call duration | ≤ 450ms | Add timer inside the `Promise.all` in `attemptConnection` | Log model + language options for diagnostics. |
| ICE gathering duration | Time spent waiting for `waitForIceGatheringComplete` | ≤ 1.2s | Instrument inside `prepareWebRTCConnection` after `pc.setLocalDescription` | Capture `pc.iceGatheringState` transitions and candidate count. |
| First remote audio | Time from `pc.connectionState === 'connected'` to first audio track `ontrack` | ≤ 400ms | Hook into the `pc.addEventListener('track')` handler | Enrich event with codec info and jitter buffer size. |
| User partial latency | Time from VAD speech start to first partial transcript event | ≤ 900ms | Emit from `handleUserTranscript` when `!isFinal` | Use `userSpeechStartMs` already tracked in controller. |
| User finalization latency | Time from speech start to `isFinal === true` | ≤ 1.8s | Same location as above when `isFinal` | Surface fallback path (native vs backend). |
| Assistant first token | Time from `handleUserTranscript` final user event to first assistant partial | ≤ 1.2s | Span across `TranscriptEngine` callbacks for assistant role | Tag with current scenario/persona. |
| Assistant finalization latency | Time from user final to assistant `isFinal` | ≤ 2.5s | Use assistant branch of `handleAssistantTranscript` | Export to backend for SLA dashboards. |
| Transcript relay turnaround | Round-trip from `relayTranscriptToBackend` POST to backend ack | ≤ 300ms | Measure inside `relayTranscriptToBackend` and mirror on backend controller | Include backend item id + dedupe decision. |
| Transcript freshness drift | Difference between backend broadcast timestamp and client receipt | ≤ 150ms | When socket receives `transcript` event, diff `Date.now()` and payload timestamp | Used to detect socket throttling. |
| Drop / retry rate | Ratio of failed voice sessions (error/aborted) to total starts | ≤ 2% | Consolidate `updateStatus('error', …)` paths + backend failures | Emit reason codes for alerting. |

## Event instrumentation blueprint

### Frontend additions

1. **Metric publisher shim**: introduce a lightweight `metrics` helper in `frontend/src/shared/metrics.ts` to collect `performance.now()` deltas and forward them to a debug listener or backend logging endpoint. Until the module split happens, we can inject it into `ConversationController` via optional deps to avoid circular imports.
2. **Milestone beacons**: reuse `emitDebug` to deliver structured events (e.g., `{kind:'metric', metric:'connect_setup', value:1234, extra:{retry:0}}`). This keeps short-term visibility without a separate pipeline.
3. **Speech timing**: wrap the existing VAD state transitions (`userSpeechPending`, `userSpeechStartMs`) to emit `speech_start`, `partial_first`, `final_emit` metrics.
4. **Assistant timing**: inside `handleAssistantTranscript`, start a timer the moment we process the final user utterance and flush when the assistant first/final responses arrive.
5. **Playback quality**: instrument buffer stats inside whichever module manages audio playback (currently inline in controller). Capture jitter, `remoteAudioElement` ready state, and underruns (counts of silence frames streamed).

### Backend additions

1. **Express middleware timers**: wrap `/api/sessions`, `/api/voice/token`, and `/api/transcript/relay/:sessionId` handlers with simple `process.hrtime.bigint()` timers logged via the structured logger used elsewhere in `backend/src`.
2. **Socket broadcast markers**: when `transcriptRelayController` broadcasts to clients, attach the server timestamp and dedupe rule applied. This allows the client freshness metric to match on `itemId`.
3. **Metrics sink**: emit logs in ECS/JSON format so CloudWatch / Application Insights / ELK can parse and graph without additional work. Include `sessionId` tail (last 6 chars), persona, scenario, and environment.

## Data transport

- **Short term**: metrics are emitted as structured debug messages and optionally POSTed to `/api/metrics` (to be added) for aggregation. If the endpoint doesn’t exist yet, write to `console.info` with a `METRIC:` prefix that the backend task runner can scrape.
- **Mid term**: pipe frontend metrics through the same socket used for transcript relay under a new namespace `metrics:update`. Backend receiver will batch to the logging layer.
- **Retention**: store raw logs 7 days (debug), aggregated dashboards 30 days.

## SLA guardrails

- Alert when any KPI exceeds SLA for three consecutive 5-minute windows.
- Distinguish between **user environment issues** (mic blocked, network down) and **service regression** (token timeout, backend 5xx). Include failure taxonomy in metric payload.
- Provide runbook entries (in `ops/docs/RUNBOOK_VOICE_METRICS.md`, to be created) with triage steps per metric.

## Implementation steps

1. Ship the frontend metric shim + milestone events (no backend dependency).
2. Add backend middleware timers and log schema (ensures POST metrics have a sink).
3. Create Grafana / DataDog dashboard with the KPI list above and define alert thresholds.
4. After controller modularization, move instrumentation into the new transport/session modules, keeping the same metric names so dashboards remain stable.

## Next actions

- **Owner**: Voice reliability (this agent) for frontend hooks, Platform observability for backend sinks.
- **ETA**: Initial metrics in staging by 2025-10-09; production dash ready by 2025-10-16.
- **Dependencies**: agreement on log schema, credentials for metrics store, review with modularization agent once interface boundaries are final.
