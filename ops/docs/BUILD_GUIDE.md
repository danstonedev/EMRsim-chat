# UND Simulated-Patient Chatbot — BUILD GUIDE

This guide gets you from zero to a running **walking skeleton** (streaming text), then adds **one voice path**, with a rock-solid foundation for future features.

---

## 1) Prereqs (local dev)

- Node LTS (>= 18)
- pnpm or npm
- Mac/Win/Linux with mic access (for voice path)
- Two terminals (frontend + backend)

---

## 2) Project layout (scaffold, no app code)

app/
  frontend/             # Vite + React (single page to start)
    src/
      components/       # headless components
      features/         # chat, voice, personas, banners (empty stubs ok)
      lib/              # api client, audio helpers (no secrets)
      tokens/           # brand.json
      styles/           # brand.css
  backend/              # Node tiny proxy
    src/
      routes/           # personas, sessions, voice token, metrics (stubs ok)
      services/         # drivers/, persona-engine/, metrics/
      db/               # prisma/drizzle schema + seeds
  ops/
    docs/               # (this file + others)
    qa/                 # wavs/, scripts/ (placeholders)

---

## 3) Environment files (placeholders only)

- `frontend/.env.local` from `.env.local.example`
- `backend/.env` from `.env.example`

> Never commit secrets. Backend issues **short-lived** tokens to clients.

---

## 4) Run it locally

### Frontend

- `pnpm i`
- `pnpm dev` → Vite HMR on `http://localhost:5173`

### Backend

- `pnpm i`
- `pnpm dev` → `http://localhost:3001`
- `GET /api/health` should return `{ ok: true, ... }`

---

## 5) Voice path choice (do ONE first)

**A) OpenAI Realtime API (WebRTC)** — minimal latency, speech-in/out over one connection.  
**B) Manual pipeline** — mic → Speech-to-Text → LLM → Text-to-Speech, all streaming.

Start with A (preferred). Add B later as fallback.

---

## 6) Feature flags (env or config)

- VOICE_ENABLED (default false until v0.2)
- BANNERS_ENABLED (true for dev)
- NEGOTIATOR_ENABLED (false until v0.5)
- GRADING_ENABLED (false until v0.6)

---

## 7) Latency budgets (release gates)

- TTFT (text): ≤ 800 ms (P95)
- STT partial: ≤ 300 ms P95 (Realtime) / ≤ 800 ms (manual)
- TTS first audible: ≤ 400 ms P95
- Voice turn E2E: < 1.7 s P95 (Realtime) / < 2.5 s P95 (fallback)

Fail the build if P95 budgets regress (see TEST_PLAN).

---

## 8) Branding & accessibility

- UND tokens in `frontend/src/tokens/brand.json` + `styles/brand.css`
- WCAG 2.2 AA contrast; visible focus indicators
- Reduced-motion & high-contrast toggles

---

## 9) HMR proof (first run smoke test)

1. Load app → pick a persona → send “Hello” → verify streamed text.
2. Toggle metrics chip → see TTFT values.
3. (After voice path) Enable VOICE_ENABLED → press mic → speak → hear reply.

---

## 10) References you’ll likely consult next

- OpenAI Realtime (WebRTC/WebSocket), Streaming Responses, Audio (TTS/STT)
- UND brand color tokens
- WCAG 2.2 contrast & focus guidelines
