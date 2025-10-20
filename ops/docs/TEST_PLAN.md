# TEST PLAN (Perf-First, Stream-Everywhere)

## 1) Smoke (Playwright)

- Loads page under 1s (localhost)
- Send text → see streamed deltas
- TTFT captured in UI and metrics log

## 2) Audio Harness (CLI)

- Run 3 prerecorded WAVs (quiet speech, moderate, noisy room)
- Assert STT partial time and finalization within budgets
- Confirm playback begins before full TTS completes

## 3) Transport Negotiation (when enabled)

- Block WebRTC (devtools/network rules) → fallback engages < 500 ms
- Validate E2E turn < 2.5 s P95 on fallback

## 4) Personas & Scenarios

- Persona lock holds tone; no_go_topics respected
- Scenario gates unlock only when cues are met
- Fixed seed → deterministic rubric pass/fail across runs

## 5) Banners & Metrics

- STT chip: capture→partial, partial→final update each turn
- LLM chip: TTFT + total gen + tokens in/out
- TTS chip: synthesis start + first audible + underruns + buffered ms
- Downloadable per-session JSON logs

## 6) Accessibility

- Keyboard-only: all controls reachable; visible focus ring
- Contrast AA: 4.5:1 for normal text, 3:1 for focus indicator & large text
- Reduced motion and high-contrast modes toggle

## 7) Go/No-Go Gates (P95)

- TTFT ≤ 800 ms
- STT partial ≤ 300 ms (Realtime) / 800 ms (manual)
- TTS first audible ≤ 400 ms
- Voice E2E < 1.7 s (Realtime) / 2.5 s (fallback)

## 8) Regression Canary (CI)

- Scripted 25-turn convo (text then voice)
- Fail CI if any P95 budget breaches or error rate >1% per 100 turns
