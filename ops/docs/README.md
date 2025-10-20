# UND Simulated-Patient Chatbot — README (Framework)

**Goal:** Low-latency simulated patient encounters with **text + true voice**, built incrementally from a walking skeleton to a robust, assessment-ready app.

## Modes

- **Text** (streaming)
- **Voice** (Realtime preferred; fallback later)

## Stack

- **Frontend:** Vite + React; headless UI + CSS variables for UND tokens
- **Backend:** Node tiny proxy; short-lived tokens for model access; SQLite (dev) → Postgres (later)
- **Drivers:** `LLMDriver`, `STTDriver`, `TTSDriver` interfaces (provider-agnostic)

## Local Dev

1) Copy `.env.example` files (frontend/backend).  
2) Run servers (Vite on 5173, Node on 3001).  
3) Text MVP first; add **ONE** voice path (Realtime) next.

## Performance Targets (P95)

- TTFT ≤ 800 ms; STT partial ≤ 300 ms (Realtime) / 800 ms (manual)
- TTS first audible ≤ 400 ms; Voice E2E < 1.7 s (Realtime) / 2.5 s (fallback)
- Local FCP < 1 s; initial JS < 150 KB gz (v0.1), < 250 KB by v0.5

## Personas vs Scenarios

- **Persona** = who the patient is (tone, voice, boundaries)
- **Scenario** = learning objectives, today’s facts, disclosure gates, grading rubric

## Banners (dev)

Toggle STT / LLM / TTS banners. Each shows minimal live stats + logs downloadable.

## Accessibility & Brand

- UND tokens (green/white/gray/black; orange for logo use) with WCAG AA contrast and clear focus states.

## Safety & Privacy

- Dev data is synthetic; no real PHI.  
- Use short-lived tokens; proxy API calls through backend.

## References

- See API_CONTRACTS.md, DATA_MODEL.md, TEST_PLAN.md
