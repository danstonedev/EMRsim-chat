# Transcripts: Root Causes and Fixes

Last updated: 2025-10-26

## Symptoms observed

- Duplicate chat bubbles during/after reconnects
- Out-of-order bubbles (finals appearing late vs. started timestamps)
- Occasional double persistence of final transcripts

## Root causes

- Local fallback finals emitted when socket was down, followed by backend broadcast of the same final once socket recovered.
- Multi-client sessions relaying the same final (e.g., multiple tabs or observers) without idempotency.
- Catch-up replay after reconnect re-sent recent finals that were already shown locally.
- Persistence layer accepting duplicates when the broadcast had already emitted that final.

## Fixes implemented

- Frontend
  - Recent transcript registry keyed by `itemId` (or signature fallback) with separate live and catch-up windows.
  - Local fallback finals are registered so later backend events are dropped client-side.
  - Relay dedupe guard to avoid resending identical finals within a short window.
- Backend
  - TTL-based dedupe at the broadcast layer (modes: off | memory | redis). Prefers `itemId`; falls back to signature of `role + startedAtMs + hash(text) + length`.
  - Database insert gated on successful broadcast to prevent double persistence when a duplicate is dropped.
  - History buffer maintains ordering by finalized timestamp with started/emitted timestamps preserved.
- Storage
  - SQLite unique index on `turns(fingerprint)` protects against duplicate inserts when a fingerprint is provided.

## Operational knobs

- `TRANSCRIPT_DEDUPE_MODE` = `off` | `memory` | `redis` (default: `memory`)
- `TRANSCRIPT_DEDUPE_TTL_SECONDS` (default: 30)

## Metrics

- `/api/metrics` now includes `transcripts` section:
  - `mode`, `ttlSeconds`
  - `broadcasted.user|assistant`
  - `dedupeDrops.user|assistant`
  - `cacheSize`

## Recommended follow-ups

- Consider surfacing dedupe counters in Prometheus text metrics if needed.
- If horizontally scaling, set `TRANSCRIPT_DEDUPE_MODE=redis` to coordinate idempotency across instances.
- Continue preferring `itemId` on all transcript events; keep signature fallback for robustness.
