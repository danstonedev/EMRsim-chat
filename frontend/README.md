# Frontend (Vite + React)

## Quickstart

```powershell
cd frontend
npm i
npm run dev
```

- Opens `http://localhost:5173`
- Expects backend at `http://localhost:3001` (config: `VITE_API_BASE_URL`)
- On Windows the dev server falls back to file-polling; set `CHOKIDAR_USEPOLLING=1` if you need tighter reloads.

## Env

Copy `.env.local.example` to `.env.local` and adjust as needed.

### Voice UI

- Set `VITE_VOICE_ENABLED=true` (frontend) and `VOICE_ENABLED=true` (backend) to show the mic controls.
- Voice sessions request their own short-lived session and WebRTC token; ensure the backend is reachable at the configured base URL.

#### Additional Voice Configuration

Add these to `.env.local` (see `.env.local.example`):

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_VOICE_BARGE_IN` | `true` \| `false` (truthy strings) | `false` | When true, relaxes echo/noise suppression to improve capturing speech while assistant is talking. |
| `VITE_STT_FALLBACK_MS` | Number (milliseconds) | `800` | Forces a final transcript commit if the provider never sends `completed`. Lower values shorten visible lag. |
| `VITE_ADAPTIVE_VAD` | `true` \| `false` | `true` | Learns mic noise/SNR and auto-tunes server VAD threshold/silence and local STT fallbacks to reduce stuck turns in noisy or hesitant speech. |
| `VITE_ADAPTIVE_VAD_DEBUG` | `true` \| `false` | `false` | Emits periodic debug events describing adaptive noise level, SNR, and chosen VAD params. |
| `VITE_ADAPTIVE_VAD_BADGE` | `true` \| `false` | `false` | Shows a small "Quiet/Noisy/Very Noisy" badge next to the waveform for quick operator visibility. |

Behavior notes:

- Enabling barge‑in may increase audible echo on open speakers; prefer a headset for best quality.
- With adaptive VAD on, the app will occasionally send `session.update` to the realtime model with tuned `turn_detection` values when the environment changes. Updates are rate-limited to avoid churn.
- The badge only renders when `VITE_ADAPTIVE_VAD_BADGE=true` (or when `VITE_ADAPTIVE_VAD_DEBUG=true`) and the voice session is connected.

Testing sequence:

1. Enable overlap test: set `VITE_VOICE_BARGE_IN=true`, restart dev server, then talk while the assistant is mid‑reply—your transcript should continue updating instead of being suppressed.
2. Validate finalization under background noise: set `VITE_ADAPTIVE_VAD_BADGE=true`, open a session, and observe the badge switch between Quiet/Noisy/Very Noisy as you introduce ambient noise. Turns should finalize reliably without having to over-emphasize sentence endings.
